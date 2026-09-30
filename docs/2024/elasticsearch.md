---
date: 2024-09-20
outline: deep
description: 做前端错误监控时，用 Node.js 往 Elasticsearch 批量写入和做聚合统计踩过的坑：写入怎么限流，聚合查询怎么变快。
---

# 用 Node.js 写 Elasticsearch：批量写入限流与聚合查询优化

之前做过一个前端错误监控平台：页面里的 SDK 捕获报错后上报到一个 Node.js 服务，服务把数据写进 Elasticsearch，再由一个聚合页面按项目、时间、错误类型、浏览器等维度做各种统计。

听起来就是「写进去、查出来」，真做起来有两个地方最费劲：

- **写入**：报错是突发的，一次发布出问题，几分钟内上报量能涨几十倍。一条一条写会把 ES 打挂，不加控制地批量写也一样。
- **查询**：聚合页面要算的东西很多，趋势、Top 错误、影响用户数、浏览器分布……每个面板一个查询，页面一打开就是一串慢请求。

这篇把当时的做法整理一下。

## 整体链路

```
浏览器 SDK ──上报──▶ Node.js 接收服务 ──批量写入──▶ Elasticsearch ◀──聚合查询── 监控聚合页面
                       │
                       └─ 内存队列：攒批 + 限流 + 背压
```

接收服务只做三件事：校验上报数据、补充字段（指纹、UA 解析等）、塞进写入队列，然后立刻返回 `202`。真正写 ES 是队列在后台做的，不让上报请求等 ES。

## 连接：一个进程一个 Client

用官方的 `@elastic/elasticsearch`。Client 内部自带连接池，**全进程共用一个实例**就行，不要每次请求都 `new`：

```js
// es.js
import { Client } from '@elastic/elasticsearch'

export const es = new Client({
  node: process.env.ES_NODE,
  auth: {
    username: process.env.ES_USER,
    password: process.env.ES_PASS
  },
  maxRetries: 3, // 连接失败、502/503/504 时由 Client 自动重试
  requestTimeout: 30_000,
  compression: true // bulk 请求体很大，开 gzip 能省不少带宽
})
```

## 先把索引设计好

很多查询慢的问题，根源在写入时的索引设计，查询阶段只能补救。我用的是索引模板加按天建索引（`fe-errors-2024.09.20` 这样的命名）：

```json
PUT _index_template/fe-errors
{
  "index_patterns": ["fe-errors-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "refresh_interval": "30s"
    },
    "mappings": {
      "dynamic": "strict",
      "properties": {
        "@timestamp":  { "type": "date" },
        "project":     { "type": "keyword" },
        "fingerprint": { "type": "keyword" },
        "type":        { "type": "keyword" },
        "message": {
          "type": "text",
          "fields": { "raw": { "type": "keyword", "ignore_above": 512 } }
        },
        "stack":       { "type": "text", "index": false },
        "url_path":    { "type": "keyword" },
        "release":     { "type": "keyword" },
        "browser":     { "type": "keyword" },
        "os":          { "type": "keyword" },
        "user_id":     { "type": "keyword" },
        "session_id":  { "type": "keyword" }
      }
    }
  }
}
```

几个关键选择：

- **按天建索引**：查「最近 24 小时」只会碰到一两个索引；过期数据直接删整个索引，比 `delete_by_query` 便宜得多；历史索引不再写入，查询缓存能长期命中（后面会讲）。
- **要聚合的字段一律 `keyword`**：`terms` 聚合只能用在 `keyword` 这类有 doc_values 的字段上。`message` 既要全文搜索又要聚合，就用 `fields` 同时存一份 `keyword`。
- **`stack` 不建索引**：堆栈只用来展示，不用来搜索，`"index": false` 能省下不少写入开销和磁盘。
- **`refresh_interval` 调到 30s**：错误监控不需要写入后 1 秒就能搜到。refresh 越少，写入越省力，查询缓存失效也越少。
- **`dynamic: strict`**：SDK 一旦上报了多余字段，写入会直接报错，而不是悄悄把 mapping 撑爆。代价是字段校验要在接收服务里做好。

## 批量写入与限流

### 为什么要自己写一个队列

一条一条 `index` 显然不行，每次写入都是一次 HTTP 往返，ES 那边也要逐条处理。改成 `bulk` 之后，又会遇到下一个问题：ES 的写线程池和队列是有上限的，写得太猛，它会返回 `429`（`es_rejected_execution_exception`），告诉你「写不动了，慢一点」。

所以写入这一侧要解决四件事：

1. **攒批**：按条数、字节数、时间三个条件，满足任一就发一批。
2. **限并发**：同时在途的 bulk 请求不超过 N 个。
3. **只重试失败的那几条**：bulk 是部分成功的，一批里可能只有几条被拒，不能整批重发。
4. **背压**：ES 持续写不动时，队列不能无限涨把 Node 进程撑爆。

### BulkWriter

```js
// bulk-writer.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class BulkWriter {
  constructor(client, opts = {}) {
    this.client = client
    this.maxDocs = opts.maxDocs ?? 1000 // 每批最多多少条
    this.maxBytes = opts.maxBytes ?? 5 * 1024 * 1024 // 每批最多多少字节
    this.concurrency = opts.concurrency ?? 2 // 同时在途的 bulk 请求数
    this.maxQueue = opts.maxQueue ?? 50_000 // 内存里最多积压多少条
    this.maxRetries = opts.maxRetries ?? 5

    this.buffer = [] // 正在攒的这一批
    this.bytes = 0
    this.pending = [] // 攒好了、等空位发送的批次
    this.inflight = 0

    // 量小的时候靠定时器兜底，保证数据最多延迟 flushMs 就写进去
    this.timer = setInterval(() => this.flush(), opts.flushMs ?? 1000)
    this.timer.unref()
  }

  get queued() {
    return this.buffer.length + this.pending.reduce((n, b) => n + b.length, 0)
  }

  /** 返回 false 表示队列已满，由调用方决定丢弃还是采样 */
  push(index, doc) {
    if (this.queued >= this.maxQueue) return false
    this.buffer.push({ index, doc })
    this.bytes += Buffer.byteLength(JSON.stringify(doc))
    if (this.buffer.length >= this.maxDocs || this.bytes >= this.maxBytes) {
      this.flush()
    }
    return true
  }

  flush() {
    if (!this.buffer.length) return
    this.pending.push(this.buffer)
    this.buffer = []
    this.bytes = 0
    this.drain()
  }

  // 有空位就发，没空位就留在 pending 里排队
  drain() {
    while (this.inflight < this.concurrency && this.pending.length) {
      const batch = this.pending.shift()
      this.inflight++
      this.send(batch).finally(() => {
        this.inflight--
        this.drain()
      })
    }
  }

  async send(batch, attempt = 0) {
    let res
    try {
      res = await this.client.bulk({
        operations: batch.flatMap(({ index, doc }) => [{ index: { _index: index } }, doc])
      })
    } catch (err) {
      // 整个请求失败（超时、网络、集群整体不可用）：整批退避重试
      return this.retry(batch, attempt, err)
    }

    if (!res.errors) return

    // 部分失败：429 是「写不动」，值得重试；400 这类是数据本身有问题，重试也没用
    const retryable = []
    res.items.forEach((item, i) => {
      const r = item.index
      if (!r?.error) return
      if (r.status === 429) retryable.push(batch[i])
      else console.warn('[es] drop doc:', r.error.type, r.error.reason)
    })
    if (retryable.length) return this.retry(retryable, attempt)
  }

  async retry(batch, attempt, err) {
    if (attempt >= this.maxRetries) {
      console.error(`[es] give up ${batch.length} docs`, err?.message ?? '')
      return
    }
    // 指数退避 + 随机抖动，避免所有批次同一时刻一起重试
    const delay = Math.min(30_000, 500 * 2 ** attempt) * (0.5 + Math.random())
    await sleep(delay)
    return this.send(batch, attempt + 1)
  }

  async close() {
    clearInterval(this.timer)
    this.flush()
    while (this.inflight || this.pending.length) await sleep(50)
  }
}
```

有几个细节值得单独说：

- **退避期间不释放并发名额。** `retry` 的等待发生在 `send` 内部，`inflight` 一直占着。ES 在喊「慢一点」的时候，新的批次也会跟着等，写入速度自然降下来。这其实就是一个简单的自适应限流。
- **按 `items` 的下标对回原文档。** bulk 响应里 `items` 的顺序和请求一致，所以 `batch[i]` 就是被拒的那条，只重发它。
- **区分可重试和不可重试的错误。** 字段类型不对、`strict` 模式下出现了未知字段，这类 `400` 错误重试一百次也不会成功，记下来丢掉就好，否则会一直卡在重试里。
- **同时限制条数和字节数。** 错误数据里带着堆栈，单条大小差别很大。只按条数攒批，偶尔会攒出一个几十 MB 的请求。

### 接收服务里怎么用

```js
import { es } from './es.js'
import { BulkWriter } from './bulk-writer.js'

const writer = new BulkWriter(es, { concurrency: 2 })

app.post('/api/report', (req, res) => {
  const doc = normalize(req.body) // 校验字段 + 补充指纹、UA 解析等
  const index = `fe-errors-${doc['@timestamp'].slice(0, 10).replaceAll('-', '.')}`

  if (!writer.push(index, doc)) {
    // 队列满了：说明 ES 已经持续写不动一段时间了。
    // 监控数据丢一部分可以接受，把接收服务拖垮就不行了。
    metrics.dropped.inc()
  }
  res.status(202).end()
})

process.on('SIGTERM', async () => {
  await writer.close() // 发版重启前把队列里的数据写完
  process.exit(0)
})
```

队列满了就丢，听起来有点粗暴，但对错误监控来说是对的取舍：出问题的时候，同一个错误往往会重复上报成千上万次，丢掉一部分并不影响判断「哪里坏了」。更讲究一点的做法是在 SDK 或接收层按指纹采样，同一个错误每分钟只收前 N 条。

::: tip 官方的 bulk helper
`@elastic/elasticsearch` 自带 `client.helpers.bulk`，支持 `flushBytes`、`concurrency`、`retries`、`wait`，也会自动重试 429。它更适合「有一个数据源要整体导入」的场景，比如从文件或数据库迁移。我们的数据是 HTTP 请求一条条推进来的，还需要队列上限和背压，所以自己写了一个。
:::

## 查询优化

聚合页面最初的写法是每个面板一个接口，每个接口一个 `search`，查询条件也是想到哪写到哪。页面打开要等好几秒，数据量一大就更明显。下面是后来逐步做的优化，大致按收益从大到小排。

### 1. 写入时算好，别让查询时去算

最有效的一条。早期想统计「同一个错误出现了多少次」，是在查询时对 `message` 做聚合，但同一个错误的 message 里常常带着变量（ID、URL、数字），根本聚不到一起。后来改成在接收服务里算一个**错误指纹**，写进 `fingerprint` 字段：

```js
import { createHash } from 'node:crypto'

function fingerprint(e) {
  // 把 message 里的数字、引号里的内容抹掉，只留「错误模板」
  const msg = e.message
    .replace(/\d+/g, '{n}')
    .replace(/(['"]).*?\1/g, '{s}')
  // 堆栈第一帧去掉行列号（每次发版都会变），只留文件和函数
  const top = (e.stack?.split('\n').find((l) => l.includes(' at ')) ?? '')
    .replace(/:\d+:\d+/g, '')
    .trim()
  return createHash('sha1').update(`${e.type}|${msg}|${top}`).digest('hex').slice(0, 16)
}
```

同样，浏览器、操作系统在写入时就从 UA 解析好；URL 在写入时就去掉 query 并把 `/user/123` 归一成 `/user/:id`。查询时需要 `script` 才能算出来的东西，都应该挪到写入时算。

### 2. 过滤条件放进 filter

```js
query: {
  bool: {
    filter: [
      { term: { project } },
      { range: { '@timestamp': { gte: 'now-24h/h', lte: 'now/h' } } }
    ]
  }
}
```

聚合统计不需要相关性评分。放在 `filter` 里的条件不算分，而且结果能被 ES 缓存复用；放在 `must` 里的条件每次都要算分。

### 3. 一个请求算完一屏

一屏上的趋势图、Top 错误、影响用户数、浏览器分布，时间范围和项目条件都一样，完全可以放进同一个请求的 `aggs` 里，只扫一遍数据：

```js
const res = await es.search({
  index: indicesFor(range), // 只查时间范围内的那几天索引
  size: 0, // 只要聚合结果，不要文档
  track_total_hits: false, // 不需要精确总数，省掉计数开销
  request_cache: true,
  query: {
    bool: {
      filter: [
        { term: { project } },
        { range: { '@timestamp': { gte: 'now-24h/h', lte: 'now/h' } } }
      ]
    }
  },
  aggs: {
    // 趋势：按小时分桶，没数据的小时也补 0，前端画图不用自己补
    trend: {
      date_histogram: {
        field: '@timestamp',
        fixed_interval: '1h',
        min_doc_count: 0,
        extended_bounds: { min: 'now-24h/h', max: 'now/h' }
      }
    },
    // Top 20 错误，每个错误再带上影响用户数、最近出现时间、一条样本
    top_issues: {
      terms: { field: 'fingerprint', size: 20, shard_size: 100 },
      aggs: {
        users: { cardinality: { field: 'user_id', precision_threshold: 1000 } },
        last_seen: { max: { field: '@timestamp' } },
        sample: { top_hits: { size: 1, _source: ['message', 'url_path', 'release'] } }
      }
    },
    affected_users: { cardinality: { field: 'user_id', precision_threshold: 3000 } },
    browsers: { terms: { field: 'browser', size: 10 } }
  }
})
```

如果不同面板的查询条件确实不一样（比如「今天」对比「昨天」），就用 `msearch` 把多个查询合成一次请求，ES 会并行执行，Node 这边也只有一次网络往返。

### 4. 让查询缓存真正命中

ES 有分片级的 **request cache**，专门缓存 `size: 0` 的聚合结果。但它有两个前提，不注意的话基本命中不了：

- **查询要一模一样。** `now-24h` 精确到毫秒，每次请求都不一样，缓存永远不会命中。写成 `now-24h/h`，按小时取整，一个小时内的请求就是同一个查询了。
- **分片数据不能变。** 分片一 refresh 出新数据，它的缓存就失效。这正是按天建索引的好处：昨天及更早的索引不再写入，缓存可以一直用；只有今天的索引缓存会随 refresh 失效。前面把 `refresh_interval` 调到 30s，也让这个失效没那么频繁。

### 5. 聚合精度和开销的取舍

- **`terms` 的 Top N 是近似的。** 每个分片先各自算出本地的 Top `shard_size`，再汇总。分片一多，排在第 20 名附近的错误计数可能不准。把 `shard_size` 调大能提高准确度，代价是更多内存；响应里的 `doc_count_error_upper_bound` 可以看出误差大概有多大。
- **`cardinality` 也是近似的**（基于 HyperLogLog++）。`precision_threshold` 以下基本精确，以上开始有误差，而内存大约按阈值 × 8 字节算，并且**每个桶一份**。所以外层的「总影响用户数」可以给高一点，嵌套在 Top 20 里面的给低一点。
- **错误列表翻页**：`terms` 本身不支持分页。按次数排序的列表，我用 `terms` 取较大的 `size` 再配合 `bucket_sort` 做 `from`/`size`；需要遍历全部指纹（比如导出）时，用 `composite` 聚合配合 `after_key` 往后翻。
- **明细列表**不要用很深的 `from`，比如翻到第 500 页。改用 `search_after`，按 `@timestamp` 加一个唯一字段排序往后翻。

### 6. 只查需要的索引

直接查 `fe-errors-*` 也能用，ES 会在 can_match 阶段跳过时间范围不相交的分片，但分片一多，这一步本身也有开销。我是按查询的时间范围算出具体要查哪几天的索引名，比如最近 3 天就只传 3 个索引。

## 怎么知道慢在哪

- **Profile API**：在查询里加 `profile: true`，能看到每个分片上 query 和各个聚合分别花了多少时间，适合定位「到底是哪个聚合慢」。
- **慢日志**：给索引配置 `index.search.slowlog.threshold.query.warn` 等参数，超过阈值的查询会被记下来，线上问题可以事后回看。
- **Node 这边也打点**：每个接口记下 ES 的 `took` 字段（ES 内部耗时）和整个请求的耗时。两者差得多，就说明时间花在网络或序列化上，而不是 ES 本身。

## 小结

回头看，这个项目里的 ES 优化基本都是一个思路：**把能提前做的事情尽量往前挪。**

- 写入侧：攒批，限并发，只重试 429，队列满了就丢，别让突发流量拖垮链路。
- 索引设计：按天建索引，要聚合的字段用 `keyword`，不用来搜索的字段关掉索引，放宽 `refresh_interval`。
- 写入时预处理：指纹、UA 解析、URL 归一化在写入时就算好，查询时不再用 `script`。
- 查询侧：条件放进 `filter`，一屏合成一个请求，时间取整让缓存命中，按需调整聚合精度。
