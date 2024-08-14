# 如何统计页面的 PV&UV？

`PV`(page view) 是页面浏览量，`UV`(Unique visitor)用户访问量。`PV` 只要访问一次页面就算一次，`UV` 同一天内多次访问只算一次。

对于前端来说，只要每次进入页面上报一次 `PV` 就行，`UV` 的统计放在服务端来做，主要是分析上报的数据来统计得出 `UV`。

## 需要的数据

对于 `PV`，我们需要采集的核心数据指标其实就三个：

- 页面地址；
- 访问时间；
- 用户信息。

因为 `PV&UV` 的数据是采集的用户行为信息，如果要更进一步地做用户行为分析，我们还需要采集如下指标：

- 设备信息；
- 网络信息（比如 `IP`，用于做地域分布分析）。

下面以具体代码为例，看下应该怎么样采集到 `PV` 信息。首先封装一个数据上报函数：

```js
const reportPV = () => {
  const data = {
    time: Date.now(),
    pageUrl: document.location.href,
    deviceInfo: window.navigator.userAgent,
    userId: 'xxxx',
    extra: {}
  };

  navigator.sendBeacon(
    url: 'https://xxx.com',
    new Blob([JSON.stringify(data)], { type: 'application/json' })
  );
}
```

使用 `sendBeacon` 上报数据的好处是，即使页面被意外关闭，也仍然能够将数据进行上报，能保证不丢失数据。

```js
export const pageVisit = () => {
  window.addEventListener('load', reportPV);
};
```

对于 `IP` 信息的采集，需要通过服务端获取，以 `egg` 为例，可以通过 `request` 获取：

```js
const { ctx } = this;
const { ip } = ctx.request;
```

## 区分单页应用和多页应用

对于多页应用，可以在页面 `onload` 事件中进行 `PV` 上报。但是对于单页应用，只有一次 `onload` 事件，后续页面的切换是通过路由实现的，因此需要在路由切换时进行 `PV` 上报。

对于多页应用，需要监听 `hash` 或者 `history` 路由的变化，然后进行 `PV` 上报。

### hash 路由

如果是使用 `hash` 路由，可以通过监听 `hashchange` 事件来进行 `PV` 上报。

```js
window.addEventListener('hashchange', reportPV);
```

### history 路由

如果是使用 `history` 路由，会比 `hash` 路由稍微复杂一些，`window` 没有提供可以监听 history 路由的方法，所以需要重写 `pushState` 和 `replaceState` 事件来进行 `PV` 上报。

首先需要创建一个统一的重写事件函数：

```js
function createHistoryEvent(type) {
  const origin = history[type];
  return function () {
    const res = origin.apply(this, arguments);
    const event = new Event(type);
    window.dispatchEvent(event);
    return res;
  };
}
```

在这里，我们可以通过 `dispatchEvent` 来触发一个自定义事件，然后监听这个事件来进行 `PV` 上报。首先定义一个监听器函数：

```js
function onEvents(events, onReport) {
  events.forEach(function(event) {
    window.addEventListener(event, function(evt) {
      var target = evt.target;
      var href = target.location.href;
      var origin = target.location.origin;
      onReport({
        newURL: href,
        oldURL: origin
      });
    });
  });
}
```

有了这个事件重写函数，就可以重写 `pushState` 和 `replaceState` 事件，然后监听 `popstate` 事件来进行 `PV` 上报：

```js
onEvents(['pushState', 'replaceState'], reportPV)

window.history.pushState = createHistoryEvent('pushState')
window.history.replaceState = createHistoryEvent('replaceState')
```

### 动态路由导致 PV 不准确问题

在单页应用开发中，同一个页面有时候会采用动态路由的方式，路由发生变化则数据变化，但其实还是同一个页面。比如一个在线考试页面，动态路由里会存在题目 `ID` 等信息，当切换题目的时候，路由发生变化，如果单纯地在路由变化时上报 `PV`，这会导致 `PV` 数据偏大，`PV/UV` 之比会达到不合理的程度，那这样的数据就是不准确的。要解决这个问题，就需要拿到页面链接，还原路由定义，并缓存前一次的页面路由，当 `url` 发生变化的时候，如果属于同一个动态路由，就不上报 `PV` 数据。

```js
let lastUrl; // 上一次路由

// 识别动态路由
const parseDynamicUrl = (url = '') => {
  // 使用正则表达式匹配 URL 中的数字，并替换为 "[id]"
  const parsedUrl = url.replace(/\/\d+/g, '/[id]');
  return parsedUrl;
};

const reportPV = (url = '') => {
  const route = url.split('?')?.[0];
  const currentUrl = parseDynamicUrl(route);
  if (currentUrl === lastUrl) return;
  lastUrl = currentUrl;
  // ...省略代码
}
```

这个是为了规避特定场景下的动态路由导致的 `PV` 偏大的问题，但是还是会带来新的问题。比如动态路由就是为了满足不同页面的内容的呈现，例如有一个新闻资讯网站，动态路由里存放的是每篇文章的 `ID`，当用户打开单页应用后没有关闭过，在这期间阅读了很多篇文章，但是由于缓存了前一次的动态路由，即使后面再怎么切换文章，路由都会被认为是同一个，会导致从始至终只上报了一次 `PV` 数据，此时数据会比实际的少很多，也是不准确的。

## UV 统计

如前所述，我们只上报 PV，UV 数据统计放在服务端做。在上报 PV 的时候，我们传递了用户信息，UV 是根据 PV 进行过滤得出的。上报的 PV 数据我存储在 `ElasticSearch` 上，然后通过 `ES` 的 `terms` 聚合来进行 UV 统计。

首先需要创建一个存放 pv 日志的索引，暂且叫做 `monitor_pv`，对应的 `elasticsearch` 字段映射类型如下：

```js
// PV 字段映射
export const pageVisitMappings = {
  // dynamic: false,
  properties: {
    apikey: {
      type: 'text',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
      },
    },
    deviceInfo: {
      type: 'text',
    },
    breadcrumb: {
      type: 'text',
    },
    sdkVersion: {
      type: 'text',
    },
    time: {
      type: 'date',
      format: 'epoch_millis',
    },
    userId: {
      type: 'text',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
      }, // 聚合查询必须是关键字类型，不然没法对文本类型聚合
    },
    uuid: {
      type: 'text',
    },
    pageUrl: {
      type: 'text',
    },
    ip: {
      type: 'text',
    },
  },
};
```

通过 `elasticsearch` 查询 `pv` 的时候，我们可以根据 `userId` 进一步聚合，得到 `uv` 数据。注意，在 `elasticsearch` 里面，文本类型字段是无法完成聚合操作的，需要定义为关键字类型。查询条件可以这么写：

```js
let uvAggs = {};
if (type === 'uv') {
  uvAggs = {
    unique_visitors: {
      cardinality: {
        field: 'userId.keyword',
      },
    },
  };
}

const params = {
  index: esIndex.pv,
  body: {
    size: 0, // 不返回文档，只返回聚合结果
    query: {
      bool,
    },
    aggs: {
      daily_count: {
        date_histogram: {
          field: 'time',
          interval: '1d',
        },
        aggs: uvAggs,
      },
    },
  },
};
```

关于 `elasticsearch` 的具体操作可以查阅官方文档，这里我就一笔带过了，主要就是为了描述通过 `cardinality` 聚合来进行 `UV` 的按天统计。值得注意的是，按天聚合得到的 UV 之和会比直接计算的时间区间 UV 总数要多，这是由 于 UV 在不同的时间范围内被计算两次导致的。

比如说，用户 A 在8月1日访问了你的网站，用户 A 和用户 B 在8月2日访问了你的网站。如果你按天计算 UV，那么8月1日的 UV 是1，8月2日的 UV 是2，所以 UV 的总和是3。但如果你计算这两天的总 UV，那么结果是2，因为用户 A 在这两天都访问了你的网站，但在计算总 UV 时只被计算一次。

这就是为什么按天计算的 UV 之和可能会大于总的 UV。如果你想要得到总的 UV，你应该在你想要的整个时间范围内进行一次 UV 聚合，而不是将每天的 UV 加起来。
