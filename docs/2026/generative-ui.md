---
date: 2026-11-04
outline: deep
tags: [Agent, 前端, Generative UI]
description: 业务 AI 助手要在回复里渲染图表、日志查询语句、PDF、Excel、卡片和表单。记录一下 SSE 事件协议、后端取数、各类块的 schema 和前端渲染的设计，以及和 AG-UI、A2UI、MCP Apps 这几个标准的对比。
---

# AI 助手如何渲染图表、文件和表单

## 背景

最近在给业务做 AI 助手，后端返回 SSE 流，前端把模型输出的 Markdown 渲染出来。后来需求多了：问"Q3 各区域销售怎么样"，要直接出一张柱状图；问"线上 500 多不多"，要给一条能直接执行的日志查询语句；再往后还有 PDF、Excel、可点击的卡片和能提交的表单。

这类由 agent 在运行时决定界面内容的做法，现在一般叫 Generative UI。下面是我们的方案，以及和几个现有标准的对比。

一条回复里，文字、图表、查询语句、文件、表单各是一个独立的块：

![一条 AI 回复，五种块](/2026/generative-ui/message-blocks.svg){data-zoomable}

## 只有文本流的问题

常见的实现是 SSE 每个事件带一小段文本，前端拼起来交给 Markdown 渲染器。纯问答没问题，遇到富内容就不好办了：

- 图表只能让模型输出 Markdown 表格或者一张图片，没法交互。
- 想要按钮，只能让模型输出一个链接，点了之后会发生什么不可控。
- 表格里的数字是模型写出来的，它没看到真实数据时就会编。
- 图表要懒加载 ECharts、文件要预览、表单要校验，在一段文本里没法区别处理。

## 把消息拆成块

我们的做法是把一条消息从一个字符串改成一个块数组。SSE 的每个事件都带上类型和所属块的 ID，前端用 reducer 把事件合并成块数组，再按块的类型找对应的组件渲染。

![从文本流到块流](/2026/generative-ui/text-vs-blocks.svg){data-zoomable}

柱状图就是其中一种块。之后加日志查询、文件、表单，都是多注册一个类型，主流程不用动。

## 两种实现方式

让 SSE 事件带上类型，有两种做法。

方式 A 是后端发结构化事件，文本和图表分开发：

```text
event: text_delta
data: {"blockId":"b1","delta":"上季度各区域销售额如下："}

event: block_start
data: {"blockId":"b2","type":"chart"}

event: block_end
data: {"blockId":"b2","payload":{"type":"bar","title":"Q3 区域销售额", ...}}

event: text_delta
data: {"blockId":"b3","delta":"华东领先明显……"}

event: done
data: {}
```

方式 B 是后端只透传模型的文本，约定模型用带 `chart` 语言标记的代码块输出图表配置，前端在流里识别这个代码块，把里面的 JSON 当作图表块处理。

| | A：结构化事件 | B：Markdown 约定 |
| --- | --- | --- |
| 后端改动 | 需要定义事件 | 基本不用改 |
| 可靠性 | 格式由代码保证 | 依赖模型遵守格式，JSON 写坏要兜底 |
| 数据来源 | 后端取真实数据 | 模型自己写数字 |
| 扩展到文件、表单 | 容易 | 交互基本做不了 |

B 改动小，适合先做原型；能改后端的话直接用 A。下文都按 A 来写。

## Generative UI 的三种模式

社区里一般按"界面由谁定义"把 Generative UI 分成三种：

![Generative UI 的三种模式](/2026/generative-ui/patterns.svg){data-zoomable}

- 受控型：前端写好一组组件，agent 只决定用哪个组件、传什么参数。常见做法是把组件和工具调用绑在一起，模型调了某个工具，前端就渲染对应的组件。样式和交互都在前端手里，代价是每种界面都要写一个组件。
- 声明式：前端提供一个组件目录，agent 用目录里的组件拼出一棵组件树（JSON），前端负责映射成真实组件。agent 可以组合出新布局，但只能用目录里有的组件。Google 的 A2UI 和 OpenAI 的 Open-JSON-UI 属于这种。
- 开放式：agent 或第三方服务直接返回 HTML，前端放进沙箱 iframe 里运行。最灵活，但样式统一、无障碍和安全都不好保证。MCP Apps 是这种。

业务内部的助手，图表、文件、卡片、表单的种类有限，又要符合自己的设计规范，用受控型就够了。图表这类块的 schema 后面会往声明式靠一些。

## 数据由后端取

图表里的数据应该由后端调业务接口拿，模型只负责判断要不要画、画哪个。

### 把展示图表定义成工具

以 OpenAI 风格的 function calling 为例：

```json
{
  "type": "function",
  "function": {
    "name": "show_sales_chart",
    "description": "当用户询问区域销售数据时调用，向用户展示区域销售额图表",
    "parameters": {
      "type": "object",
      "properties": {
        "quarter": { "type": "string", "description": "季度，例如 2026Q3" },
        "chartType": { "type": "string", "enum": ["bar", "line", "pie"] }
      },
      "required": ["quarter"]
    }
  }
}
```

模型只给出季度和图表类型这些参数，不涉及业务数字。

Chat Completions 里 `tools` 和 `tool_calls` 的 `type` 以前只有 `function`，后来 OpenAI 加了参数为自由文本的 `custom` 类型。国内大多数兼容 OpenAI 的模型和网关目前只支持 `function`，这个场景也只需要 `function`。

### 后端拦截工具调用

模型返回 `tool_call` 后，编排服务不把它转给前端，而是自己处理：

1. 给前端发 `block_start`，前端先显示骨架屏；
2. 用当前用户的身份调业务接口取数；
3. 把数据拼成图表 schema，发 `block_end`；
4. 把数据摘要作为工具结果交回模型，模型接着写分析。

![一轮对话的完整时序](/2026/generative-ui/sequence.svg){data-zoomable}

第 4 步不能省。数据是后端取的，但"华东领先明显"这句话是模型写的，模型没看到数据就可能写错，图和文字对不上。

工具结果里最好写明"图表已经展示给用户"，不然模型经常会再输出一个 Markdown 表格，把数字重复一遍。

### 编排服务的主循环

上面几步写成代码大致如下（Node.js + OpenAI SDK，省略了非 UI 工具和重试）：

```ts
// 会产生界面的工具，执行后得到一个块
const uiTools = {
  show_sales_chart: {
    blockType: 'chart',
    async run(args, ctx) {
      // 用当前用户的身份查数，权限沿用业务系统自己的
      const rows = await salesApi.byRegion(args.quarter, { user: ctx.user });
      return {
        payload: {
          version: 1,
          type: args.chartType ?? 'bar',
          title: `${args.quarter} 区域销售额`,
          unit: '万元',
          x: { field: 'region' },
          series: [{ field: 'amount', name: '销售额' }],
          data: rows,
        },
        summary: rows.map((r) => `${r.region} ${r.amount}`).join('；'),
      };
    },
  },
};

async function runTurn(messages, sse, ctx) {
  while (true) {
    const stream = await llm.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOL_DEFINITIONS,
      stream: true,
    });

    const textBlockId = newId();
    let text = '';
    const calls = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        text += delta.content;
        sse.send('text_delta', { blockId: textBlockId, delta: delta.content });
      }
      // 流式返回时 tool_calls 的参数是分片到达的，按 index 拼起来
      for (const part of delta?.tool_calls ?? []) mergeToolCallDelta(calls, part);
    }

    messages.push({ role: 'assistant', content: text || null, tool_calls: calls.length ? calls : undefined });
    if (calls.length === 0) break; // 没有工具调用，这一轮结束

    for (const call of calls) {
      const tool = uiTools[call.function.name];
      const blockId = newId();
      sse.send('block_start', { blockId, type: tool.blockType });
      try {
        const { payload, summary } = await tool.run(JSON.parse(call.function.arguments), ctx);
        sse.send('block_end', { blockId, payload });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: `图表已展示给用户，不要再用表格重复数字。数据：${summary}`,
        });
      } catch (err) {
        sse.send('block_error', { blockId, code: 'DATA_FETCH_FAILED', message: '销售数据暂时无法获取' });
        messages.push({ role: 'tool', tool_call_id: call.id, content: '取数失败，请告诉用户稍后重试' });
      }
    }
    // 带着工具结果进入下一次循环，模型接着写分析
  }
  sse.send('done', {});
}
```

`tool_calls` 不会发给前端，前端只处理编排服务定义的事件。以后换模型厂商，前端协议不用改。

## 事件协议

### 事件外壳

所有事件用同一个外壳，方便去重和排查：

```ts
type SSEEnvelope<T> = {
  v: 1;            // 协议版本
  msgId: string;   // 所属消息
  blockId: string; // 所属块
  seq: number;     // 递增序号，用于去重和断线续传
  data: T;
};
```

事件类型有这几种：

| 事件 | 作用 | 关键字段 |
| --- | --- | --- |
| `text_delta` | 文本增量 | `delta` |
| `block_start` | 非文本块开始，前端显示占位 | `type`，可选 `meta`（标题、预估高度等） |
| `block_delta` | 块的增量更新（可选） | JSON Patch 数组 |
| `block_end` | 块完成，带完整 payload | `payload` |
| `block_error` | 块失败 | `code`、`message`、是否可重试 |
| `done` | 消息结束 | 用量统计等 |
| `error` | 整轮失败 | `code`、`message` |

另外约定两点：前端遇到不认识的事件类型直接忽略，这样后端加新类型不会影响旧版前端；遇到不认识的块类型，显示块里的 `fallback` 文本。

`block_delta` 用在比较大的块上，比如几百行的表格，可以先发表头再分批追加行。增量用 JSON Patch（RFC 6902）描述，和 AG-UI 的 `STATE_DELTA` 一样。一般用不上。

### 块晚到

后端取数可能要几百毫秒到几秒。这期间先发 `block_start`，前端显示骨架屏，文字照常往下流，数据回来后再发 `block_end`。

所以块的到达顺序和显示顺序可能不一样，前端要按 `blockId` 更新原来位置的块，而不是追加到末尾：

![图表晚到：占位、继续出字、原位回填](/2026/generative-ui/late-block.svg){data-zoomable}

骨架屏的高度要和图表最终的高度一致，不然图表出来时页面会跳一下。可以在 `block_start` 的 `meta` 里带一个预估高度。

### 失败、重试和断线

单个块失败时发 `block_error`，前端在原位置显示错误和重试按钮。重试不用重新跑整轮对话，单独提供一个接口，比如 `POST /chat/blocks/:blockId/retry`，后端用当时的工具参数重新取数。

断线续传靠 `seq`。原生 `EventSource` 重连时会自动带上 `Last-Event-ID`，但它只支持 GET 请求。AI 对话一般用 POST，需要用 fetch 读流，重连也得自己实现：记下最后收到的 `seq`，重连时带上，后端从这之后补发。后端做不到补发的话，至少要保证 `done` 之后能从历史接口拿到完整的块数组。

## 块的类型

### 三类块

按处理方式，块可以分成三类：

| 类别 | 例子 | 数据方向 | 主要问题 |
| --- | --- | --- | --- |
| 展示类 | 图表、日志查询语句、代码、表格 | 服务端 → 前端 | 渲染和样式统一 |
| 资源类 | PDF、图片、Excel 等文件 | 对象存储 ↔ 前端 | 内容不走 SSE，只传引用 |
| 交互类 | 卡片、表单、确认框 | 双向 | 回传通道、状态、幂等 |

### 块的结构

```ts
type Block = {
  id: string;
  type: string;           // 'text' | 'chart' | 'query' | 'file' | 'card' | 'form' ...
  version: number;        // 该类型 schema 的版本
  status: 'loading' | 'done' | 'error';
  payload?: unknown;      // 各类型自己的 schema
  fallback?: string;      // 前端不认识该类型时显示的文本
  actions?: Action[];     // 交互类才有
  state?: unknown;        // 服务端维护的交互状态，比如表单是否已提交
};
```

`fallback` 在这些情况下会用到：老版本前端、能力不全的小程序端、把对话导出成纯文本、把对话交给另一个模型看。比如图表块的 `fallback` 可以写成"Q3 区域销售额：华东 320、华南 210……"。

### 图表

图表的 schema 要先定一件事：后端直接填 ECharts 的 `option`，还是填一份业务语义的 schema，由前端转成 `option`。

| | 直接下发 ECharts option | 语义 schema + 前端转换 |
| --- | --- | --- |
| 前端工作量 | 几乎没有 | 每种图写一个转换函数 |
| 新增图形 | 后端改，不用发版 | 前端要支持 |
| 样式统一 | 主题色、字体、暗色模式散落在后端 | 前端统一处理 |
| 数值格式化 | JSON 里不能放函数，只能用字符串模板 | 前端用函数格式化 |
| 响应式 | 后端不知道容器宽度 | 前端按宽度调整 |
| 换图表库或多端 | 后端跟着改 | 只改转换函数 |

建议用语义 schema：

```ts
type ChartSpec = {
  version: 1;
  type: 'bar' | 'line' | 'pie';
  title?: string;
  unit?: string;
  valueFormat?: 'number' | 'percent' | 'currency';
  x: { field: string };
  series: { field: string; name: string }[];
  data: Record<string, string | number>[];
  orientation?: 'vertical' | 'horizontal';
  stack?: boolean;
};
```

前端每种图写一个转换函数，再和基础主题合并：

```ts
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

function toBarOption(spec: ChartSpec) {
  // 类别多时用横向柱状图
  const horizontal = spec.orientation === 'horizontal' || spec.data.length > 8;
  const format = formatterOf(spec.valueFormat, spec.unit);
  const category = { type: 'category', data: spec.data.map((d) => d[spec.x.field]) };
  const value = { type: 'value', axisLabel: { formatter: format } };

  return {
    tooltip: { trigger: 'axis', valueFormatter: format },
    legend: spec.series.length > 1 ? {} : undefined,
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: spec.series.map((s) => ({
      type: 'bar',
      name: s.name,
      stack: spec.stack ? 'total' : undefined,
      data: spec.data.map((d) => d[s.field]),
    })),
  };
}

const mappers = { bar: toBarOption, line: toLineOption, pie: toPieOption };

export function toOption(spec: ChartSpec, theme: 'light' | 'dark') {
  return merge(baseTheme[theme], mappers[spec.type](spec));
}
```

另外保留一个 `{ "type": "echarts_raw", "option": {...} }` 类型，给桑基图、地图这种少见的图用。前端拿到后同样先合并基础主题再 `setOption`，并且只接受后端代码生成的 option，不接受模型输出的。某种 raw 图用得多了，再给它加一个正式的类型。

### 日志查询语句

本质是带语言标记的代码块，但一般要配几个操作，所以单独做成一个类型：

```json
{
  "type": "query",
  "payload": {
    "lang": "sls",
    "statement": "status:500 | stats count() by path",
    "timeRange": { "from": "now-1h", "to": "now" }
  },
  "actions": [
    { "id": "copy", "label": "复制", "kind": "local" },
    { "id": "run", "label": "执行查询", "kind": "api" },
    { "id": "open", "label": "在日志平台打开", "kind": "link", "href": "https://logs.example.com/..." }
  ]
}
```

点"执行查询"后，结果作为一个新的表格块或图表块追加到消息里。查询由后端执行，要限制只读、限制时间范围，权限用用户自己的日志权限。

### 文件

PDF、图片、Excel 的内容不要放进 SSE。后端把文件放到对象存储，事件里只带引用：

```json
{
  "type": "file",
  "payload": {
    "assetId": "a_123",
    "name": "Q3报表.xlsx",
    "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "size": 482133,
    "url": "https://oss.example.com/a_123?signature=...&expires=...",
    "preview": {
      "kind": "table",
      "rows": [["区域", "销售额"], ["华东", 320], ["华南", 210]]
    }
  },
  "fallback": "文件：Q3报表.xlsx（471 KB）"
}
```

需要注意的几点：

- URL 用短期签名。过期后前端调 `GET /assets/:id/url` 换新链接，翻历史消息时一定会碰到过期的情况。
- 预览和下载分开。图片显示缩略图；PDF 用 pdf.js 预览前几页；Excel 由后端顺便给前 N 行数据，前端不用下载整个文件解析，要看全部时再用 SheetJS 打开或者跳在线预览。
- 生成慢的文件，比如导出大报表，先发 `block_start`，中间用 `block_delta` 更新进度，完成后在 `block_end` 里带上链接。
- 预览数据也要控制大小，单条 SSE 事件在几十 KB 以内比较稳，再大就拆开或者改成按需拉取。

### 卡片和表单

SSE 是单向的，用户在卡片、表单上的操作要通过另一个接口回到后端：

![交互块的回传通道](/2026/generative-ui/actions.svg){data-zoomable}

```text
POST /chat/actions
{
  "msgId": "m_1",
  "blockId": "b5",
  "actionId": "submit",
  "payload": { "range": ["2026-07-01", "2026-09-30"], "reason": "季度复盘" },
  "idempotencyKey": "7f3c..."
}
```

每个动作要在定义里写明去向：

```ts
type Action = {
  id: string;
  label: string;
  kind: 'api' | 'prompt' | 'link' | 'local';
  // api:    直接调业务接口，不经过模型（提交审批、执行查询）
  // prompt: 转成一条用户消息发给模型（"展开华东各城市数据"）
  // link:   跳转
  // local:  纯前端行为（复制、展开收起）
  prompt?: string;   // kind 为 prompt 时发给模型的文本
  href?: string;     // kind 为 link 时的地址
  confirm?: string;  // 有副作用的动作，先弹二次确认
};
```

`prompt` 类动作在对话里挺好用。比如柱状图的柱子可以点，点"华东"就自动发一句"展开华东各城市的数据"，不用用户自己打字。

表单的字段和校验用 JSON Schema 描述，再加一份 uiSchema 描述控件，前端可以直接用 react-jsonschema-form 这类库渲染：

```json
{
  "type": "form",
  "payload": {
    "title": "申请导出全量明细",
    "schema": {
      "type": "object",
      "required": ["range"],
      "properties": {
        "range": { "type": "array", "items": { "type": "string", "format": "date" }, "minItems": 2, "maxItems": 2 },
        "reason": { "type": "string", "maxLength": 200 }
      }
    },
    "uiSchema": { "range": { "ui:widget": "dateRange" }, "reason": { "ui:widget": "textarea" } },
    "defaults": { "range": ["2026-07-01", "2026-09-30"] }
  },
  "actions": [{ "id": "submit", "label": "提交", "kind": "api", "confirm": "确认提交导出申请？" }]
}
```

模型可以帮忙预填默认值，比如从对话里推断时间范围，但表单有哪些字段由后端定义。

交互类块还有几个要处理的地方：

- 状态要落库。表单提交后，服务端把块的 `state` 改成已提交并记下结果，前端据此锁定表单，刷新页面或者换设备看历史时不能再提交一次。
- 幂等。每次动作带一个 `idempotencyKey`，后端按它去重，防止重复点击。
- 后端要重新校验。前端校验只是为了体验，后端用同一份 schema（比如用 ajv）再校验一遍，同时检查权限。
- 动作要有白名单。哪些表单、哪些 api 动作可以出现，由后端注册的列表决定，模型只能从里面选、填参数，不能自己造一个调用某个接口的按钮。

## 前端实现

整体流程：

![前端的处理流水线](/2026/generative-ui/frontend.svg){data-zoomable}

### 用 fetch 读流

对话请求一般是 POST，要带历史消息和其他参数，原生 `EventSource` 只支持 GET，所以用 fetch 读：

```ts
export async function* readSSE(res: Response) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, '\n');
    let end: number;
    // SSE 用空行分隔事件
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const evt = parseEvent(raw);
      if (evt) yield evt;
    }
  }
}

function parseEvent(raw: string) {
  let event = 'message';
  let id: string | undefined;
  const data: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue; // 冒号开头是注释，常用作心跳
    const i = line.indexOf(':');
    const field = i === -1 ? line : line.slice(0, i);
    const value = i === -1 ? '' : line.slice(i + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id') id = value;
  }
  if (data.length === 0) return null;
  return { event, id, data: JSON.parse(data.join('\n')) };
}
```

这是最简单的实现，生产环境可以用 eventsource-parser 或 @microsoft/fetch-event-source，边界情况处理得更全。

请求时可以带上当前端支持的块类型和版本：

```ts
fetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Blocks': 'chart@1,query@1,file@1,form@1' },
  body: JSON.stringify({ messages }),
});
```

`X-Blocks` 是我们自己定的请求头。Web、小程序、App 支持的块不一样，后端遇到不支持的类型就降级成 `fallback` 文本或者链接。

### reducer

```ts
type Message = { id: string; blocks: Block[] };

function reduce(msg: Message, evt: SSEEvent): Message {
  switch (evt.event) {
    case 'text_delta':
      return upsert(msg, evt.data.blockId, (b) => ({
        id: evt.data.blockId,
        type: 'text',
        version: 1,
        status: 'loading',
        payload: ((b?.payload as string) ?? '') + evt.data.delta,
      }));

    case 'block_start':
      return upsert(msg, evt.data.blockId, () => ({
        id: evt.data.blockId,
        type: evt.data.type,
        version: evt.data.version ?? 1,
        status: 'loading',
      }));

    case 'block_end': {
      const parsed = schemas[evt.data.type]?.safeParse(evt.data.payload);
      return upsert(msg, evt.data.blockId, (b) => ({
        ...b!,
        status: parsed?.success ? 'done' : 'error',
        payload: parsed?.success ? parsed.data : undefined,
        fallback: evt.data.fallback,
        actions: evt.data.actions,
      }));
    }

    case 'block_error':
      return upsert(msg, evt.data.blockId, (b) => ({ ...b!, status: 'error' }));

    default:
      return msg; // 不认识的事件忽略
  }
}

// 已有的块原地更新，新块追加到末尾，晚到的块因此会留在原来的位置
function upsert(msg: Message, id: string, fn: (b?: Block) => Block): Message {
  const i = msg.blocks.findIndex((b) => b.id === id);
  if (i === -1) return { ...msg, blocks: [...msg.blocks, fn()] };
  const blocks = msg.blocks.slice();
  blocks[i] = fn(blocks[i]);
  return { ...msg, blocks };
}
```

`block_end` 的 payload 用 zod 之类的库按类型校验，不通过就把块标成错误，显示 `fallback`，不要让整条消息渲染失败。

### 合并更新

文字流每秒可能有几十个事件，每个都 `setState` 会卡。先把事件放进队列，每帧用 `requestAnimationFrame` 合并处理一次：

```ts
function useMessageStream() {
  const [message, setMessage] = useState<Message>(emptyMessage);
  const queue = useRef<SSEEvent[]>([]);
  const frame = useRef(0);

  const push = useCallback((evt: SSEEvent) => {
    queue.current.push(evt);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      const batch = queue.current;
      queue.current = [];
      frame.current = 0;
      setMessage((m) => batch.reduce(reduce, m));
    });
  }, []);

  return { message, push };
}
```

### 组件注册表

```tsx
const registry: Record<string, React.ComponentType<{ block: Block }>> = {
  text: TextBlock,
  chart: lazy(() => import('./blocks/ChartBlock')),
  query: QueryBlock,
  file: lazy(() => import('./blocks/FileBlock')),
  form: lazy(() => import('./blocks/FormBlock')),
};

const BlockView = memo(
  function BlockView({ block }: { block: Block }) {
    const Component = registry[block.type] ?? UnknownBlock;
    return (
      <ErrorBoundary fallback={<FallbackText block={block} />}>
        <Suspense fallback={<Skeleton type={block.type} />}>
          <Component block={block} />
        </Suspense>
      </ErrorBoundary>
    );
  },
  // 块本身没变就不重新渲染
  (prev, next) => prev.block === next.block,
);

export function MessageView({ message }: { message: Message }) {
  return message.blocks.map((b) => <BlockView key={b.id} block={b} />);
}
```

几个细节：

- reducer 用不可变更新，没变的块引用不变，`memo` 才有效。否则文字每更新一次，图表都会重新 `setOption`。
- ECharts、pdf.js、表单库都不小，用懒加载，第一次遇到对应的块才加载。ECharts 只引入用到的图表和组件。
- 每个块单独包一层 ErrorBoundary，一个块出错只影响它自己。
- 骨架屏高度固定，前面说过。

## 和现有标准的对比

上面是我们自己定的协议。几个现有标准的事件命名和消息结构可以参考，以后想接入现成的工具也方便。它们分别负责不同的部分：

![几个协议各管一段](/2026/generative-ui/protocol-stack.svg){data-zoomable}

- MCP：agent 和工具、数据之间；
- A2A：agent 和其他 agent 之间；
- AG-UI：agent 和前端之间的双向事件流；
- A2UI、Open-JSON-UI、MCP Apps：在事件流上传输的 UI 数据格式。

### AG-UI

AG-UI（Agent–User Interaction Protocol）由 CopilotKit 发起，是一个开源的事件协议，通常用 SSE 传输。它本身不规定 UI 长什么样，只负责 agent 和应用之间的通信，上面几种 UI 格式都可以通过它传。

事件分为这几类：

| 类别 | 事件 |
| --- | --- |
| 生命周期 | `RUN_STARTED`、`RUN_FINISHED`、`RUN_ERROR`、`STEP_STARTED`、`STEP_FINISHED` |
| 文本消息 | `TEXT_MESSAGE_START`、`TEXT_MESSAGE_CONTENT`、`TEXT_MESSAGE_END` |
| 工具调用 | `TOOL_CALL_START`、`TOOL_CALL_ARGS`、`TOOL_CALL_END`、`TOOL_CALL_RESULT` |
| 状态 | `STATE_SNAPSHOT`、`STATE_DELTA`、`MESSAGES_SNAPSHOT`、`ACTIVITY_SNAPSHOT`、`ACTIVITY_DELTA` |
| 推理 | `REASONING_START`、`REASONING_MESSAGE_CONTENT` 等 |
| 子 agent | `SUBAGENT_STARTED`、`SUBAGENT_FINISHED`、`SUBAGENT_ERROR` |
| 扩展 | `RAW`、`CUSTOM` |

流式内容都是开始、内容、结束三个事件，共用一个 ID。`STATE_DELTA` 和 `ACTIVITY_DELTA` 用 JSON Patch 描述增量，`CUSTOM` 用 `name` 和 `value` 传自定义数据。

和我们的事件对应关系如下：

| 本文的事件 | AG-UI 中的对应 |
| --- | --- |
| `text_delta` | `TEXT_MESSAGE_CONTENT` |
| `block_start` / `block_end` | `TOOL_CALL_START` / `TOOL_CALL_RESULT`（前端按工具名渲染），或 `ACTIVITY_SNAPSHOT`，或 `CUSTOM` |
| `block_delta` | `ACTIVITY_DELTA` / `STATE_DELTA`（JSON Patch） |
| `done` | `RUN_FINISHED` |
| `error` | `RUN_ERROR` |

新项目可以直接用 AG-UI 的事件名，自定义的块放进 `CUSTOM` 或 `ACTIVITY_*`。

### A2UI

A2UI 是 Google 提出的声明式 UI 格式。agent 只传描述界面的数据，客户端用自己的组件渲染，不执行 agent 传来的代码。当前是 v0.9 系列，v1.0 还是候选版本。消息有四种：

| v0.9 消息 | 作用 | v0.8 中的名字 |
| --- | --- | --- |
| `createSurface` | 创建一块界面，指定组件目录（`catalogId`） | `beginRendering` |
| `updateComponents` | 增量更新组件 | `surfaceUpdate` |
| `updateDataModel` | 更新数据 | `dataModelUpdate` |
| `deleteSurface` | 删除界面 | `deleteSurface` |

几个设计点：

- 组件用扁平列表表示，子组件通过 ID 引用，不是嵌套结构。模型可以一个个生成、增量修改，某个组件写错也只影响它自己。
- agent 只能用客户端组件目录（catalog）里的组件，属性也按目录里的 schema 校验。
- 界面结构和数据分开。组件用 JSON Pointer 绑定数据，比如 `{"path": "/user/name"}`，数据更新后组件自动刷新，不用重发组件。

```json
{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Text","text":{"path":"/user/name"}}]}}
{"version":"v0.9","updateDataModel":{"surfaceId":"main","path":"/","value":{"user":{"name":"Alice"}}}}
```

用户操作通过 `action` 回传。组件上的动作有两种：`event` 发回给 agent，`functionCall` 只在客户端执行，比如打开链接。`event` 的 `context` 可以引用数据里的路径，发送前由渲染器替换成实际的值：

```json
{
  "version": "v0.9",
  "action": {
    "name": "submit_reservation",
    "surfaceId": "booking-surface",
    "sourceComponentId": "submit-btn",
    "timestamp": "2026-02-25T10:40:00Z",
    "context": { "time": "7:00 PM", "size": 4 }
  }
}
```

和我们的方案比，`event` 对应 `api` 和 `prompt` 类动作，`functionCall` 对应 `link` 和 `local` 类动作。如果以后需要 agent 自己组合卡片、列表、按钮这类布局，而不是每种都让前端写一个组件，可以考虑 A2UI。

### MCP Apps

MCP Apps 是 MCP 的一个扩展（SEP-1865），2025 年 11 月提出，现在是 Final 状态，合并了社区项目 MCP-UI 和 OpenAI Apps SDK 的做法：

- UI 是预先声明的资源，用 `ui://` 标识，MIME 类型是 `text/html;profile=mcp-app`，工具通过元数据 `_meta.ui.resourceUri` 关联界面。宿主可以在调用工具前预取模板，也可以提前审查 HTML。
- 宿主在沙箱 iframe 里渲染 HTML，iframe 和宿主之间用 `postMessage` 传 MCP 的 JSON-RPC 消息。界面先发 `ui/initialize` 握手，宿主推送工具的输入和结果（`ui/notifications/tool-input`、`ui/notifications/tool-result`），界面也可以调用工具（`tools/call`）或者往对话里发消息（`ui/message`）。
- 安全方面：强制沙箱，资源可以提前审查，通信可以记录，界面发起的工具调用可以要求用户确认。资源可以声明 CSP，不声明时默认不能访问网络。
- 工具可以设置成只给模型用、只给界面用，或者两者都能用。

MCP Apps 适合嵌入第三方的界面。如果助手要接别人的 MCP 服务，对方又提供了界面，就用它；业务自己的组件没必要放进 iframe。

### Vercel AI SDK

用 React + Next.js 的话，AI SDK 就是受控型的做法：工具在服务端定义和执行，前端从 `message.parts` 里读工具调用，类型是 `tool-<工具名>`，根据状态渲染组件：

```tsx
{message.parts.map((part, i) => {
  if (part.type === 'tool-showSalesChart') {
    switch (part.state) {
      case 'input-available':
        return <ChartSkeleton key={i} />;
      case 'output-available':
        return <SalesChart key={i} {...part.output} />;
      case 'output-error':
        return <ErrorCard key={i} text={part.errorText} />;
    }
  }
  if (part.type === 'text') return <Markdown key={i}>{part.text}</Markdown>;
})}
```

`input-available` 相当于我们的 `block_start`，`output-available` 相当于 `block_end`，区别是 AI SDK 里一个块就是一次工具调用。

### 选择

| 场景 | 建议 |
| --- | --- |
| 业务自己的图表、文件、卡片、表单 | 自研块协议或 AI SDK，事件名参考 AG-UI |
| 组件多、布局经常变，想让 agent 自己组合 | A2UI，按自己的设计规范做组件目录 |
| 嵌入第三方的界面 | MCP Apps |
| React 技术栈，不想自己写协议 | AI SDK 或 CopilotKit |
| 要同时支持 Web、小程序、App | 自研协议加能力声明，或 A2UI |

## 持久化和回放

数据库里直接存块数组，包括图表的数据，回放时不用重新解析文本，也不用重新取数。有个问题要和产品先确认：看历史消息时，图表显示当时的数据，还是重新查最新的？一般显示当时的数据更合理，不然上周写的分析和今天的图会对不上。可以在块上加一个刷新按钮，需要时重新取数。

文件存 `assetId`，展示时再换签名 URL。

另外把轨迹单独存一份。用户反馈图表数据不对时，要能看到模型调了什么工具、参数是什么、接口返回了什么。轨迹可以按 [ATIF](/2026/atif) 的格式存，图表 schema、块 ID 这些放在 step 的 `extra` 里，通过消息 ID 和块数组关联。

## 安全

- 不渲染模型输出的 HTML。Markdown 渲染器关掉原始 HTML 或者严格过滤，模型的输出可能被提示注入影响，比如它读的文档里藏了指令。
- 所有块的 payload 都做 schema 校验，后端生成的也一样。
- 动作只能来自后端注册的列表。模型可以决定展示哪个表单、预填什么值，但不能决定按钮调用哪个接口。api 动作执行时重新鉴权、校验参数。
- 提交、删除、发送这类有副作用的操作加 `confirm`，必须由用户点击触发。
- 第三方界面放进沙箱 iframe，声明严格的 CSP，通信走可记录的消息通道，和 MCP Apps 的做法一样。
- 取数、执行查询、生成文件都用当前用户的权限。

## 落地顺序

可以按这个顺序推进，每一步做完都能单独上线：

1. 定事件协议：外壳加 7 种事件，写成文档，前后端一起维护。
2. 先做图表块：后端拦截工具调用取数，前端做 reducer、注册表和图表组件，跑通占位、回填、模型根据数据继续写的流程。
3. 加上 `fallback` 和能力声明。
4. 文件块：对象存储、签名 URL、预览数据。
5. 动作接口和交互块：先做 `link`、`prompt` 这种没有副作用的，再做 `api` 类，同时做状态落库、幂等和二次确认。
6. 块数组入库，轨迹单独存。
7. 组件多到维护不过来时再看 A2UI，要接第三方界面时再看 MCP Apps。

## 小结

做法上就是把消息从一段文本改成一个块数组：SSE 事件带类型和块 ID，块可以晚到、失败和增量更新；数据由后端取，取完交回模型；文件只传引用，交互走单独的接口；前端用 reducer 合并、注册表分发，每个块单独容错。协议的命名可以参考 AG-UI，组件多了可以看 A2UI，第三方界面用 MCP Apps。

## 参考资料

- [AG-UI 文档：事件类型](https://docs.ag-ui.com/sdk/js/core/events)
- [A2UI：What is A2UI](https://a2ui.org/introduction/what-is-a2ui/)
- [A2UI：消息类型](https://a2ui.org/reference/messages/)
- [A2UI：Actions](https://a2ui.org/concepts/actions/)
- [SEP-1865：MCP Apps - Interactive User Interfaces for MCP](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [MCP Apps 规范（modelcontextprotocol/ext-apps）](https://github.com/modelcontextprotocol/ext-apps)
- [AI SDK：Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [CopilotKit：Generative UI Specs](https://showcase.copilotkit.ai/learn/generative-ui/specs)
- [CopilotKit/generative-ui](https://github.com/CopilotKit/generative-ui)
- [Generative UI in 2026: Controlled, A2UI Declarative, and Open-Ended Patterns on AG-UI](https://mer.vin/2026/06/generative-ui-in-2026-controlled-a2ui-declarative-and-open-ended-patterns-on-ag-ui/)
- [OpenAI Ruby SDK：ChatCompletionNamedToolChoiceCustom](https://rubydoc.info/gems/openai/OpenAI/Models/Chat/ChatCompletionNamedToolChoiceCustom)
