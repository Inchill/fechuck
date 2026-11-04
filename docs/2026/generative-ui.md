---
date: 2026-11-04
outline: deep
tags: [Agent, 前端, Generative UI]
description: 业务 AI 助手的回复里要出现图表、日志查询语句、PDF、Excel、可点击卡片和表单，SSE 只吐文本已经不够了。从一个柱状图需求出发，整理一套"块流"协议的设计：事件怎么定、数据从哪来、文件和交互怎么处理、前端怎么渲染，再对照 AG-UI、A2UI、MCP Apps 这几个业界标准。
---

# Generative UI：让 AI 助手的回复不止是文字

最近在给业务做 AI 助手。后端返回的是 SSE 流，一开始只要把模型吐出来的 Markdown 渲染好就行。很快需求就变了：问"Q3 各区域销售怎么样"，希望直接出一张柱状图；问"线上 500 多不多"，希望给一条能点一下就执行的日志查询语句；再往后还有 PDF、Excel、可点击的卡片、能填写提交的表单。

这类需求在业界有个名字，叫 **Generative UI**：由 agent 在运行时决定界面上出现什么，而不只是返回一段文字。这篇文章从一个柱状图需求出发，一步步推到一套通用的方案，最后再拿它和 AG-UI、A2UI、MCP Apps 这几个已有标准做对照。

先看最终想要的效果：一条回复里，文字、图表、查询语句、文件、表单各自是一个独立的"块"。

![一条 AI 回复，五种块](/2026/generative-ui/message-blocks.svg){data-zoomable}

## 从文本流到块流

### 只有文本的问题

最常见的 AI 对话实现，SSE 里每个事件就是一小段文本增量，前端拼起来交给 Markdown 渲染器。这种做法在纯问答时没问题，一遇到富内容就开始别扭：

- **图表只能退化**：要么让模型输出 Markdown 表格，要么生成一张图片，都没法交互。
- **交互全靠模型拼字符串**：想要一个按钮，只能让模型输出一个链接，点了之后发生什么完全不可控。
- **数据不可信**：表格里的数字是模型"写"出来的，模型没看到真实数据时就会编。
- **前端没法区别对待**：图表要懒加载 ECharts、文件要预览、表单要校验，在一段文本里这些都无从下手。

### 改成"块的流"

核心思路只有一句话：**把 AI 的输出从"一段文本流"改成"一组有类型的块（block）的流"**。一条消息不再是一个字符串，而是一个块数组；SSE 里的每个事件都带上类型和所属的块 ID，前端用一个 reducer 把事件合并成块数组，再按块的类型找对应的组件渲染。

![从文本流到块流](/2026/generative-ui/text-vs-blocks.svg){data-zoomable}

这样一来，柱状图只是"块"的一种。后面加日志查询、文件、表单，都是在同一套机制里多注册一个类型，主流程不用改。

### 两种实现路线

具体怎么让 SSE 带上"类型"，有两条路，取决于你能不能改后端。

**路线 A：后端发结构化事件。** 后端自己定义事件类型，文本和图表分开发：

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

**路线 B：后端只透传模型文本。** 约定模型在 Markdown 里用带语言标记的代码块输出图表配置，比如用 `chart` 作为语言名，代码块内容是 JSON。前端在流里识别这个代码块的开始和闭合，把中间内容当作图表块处理。

| | 路线 A：结构化事件 | 路线 B：Markdown 约定 |
| --- | --- | --- |
| 后端改动 | 要改，需要定义事件 | 几乎不用改 |
| 可靠性 | 高，格式由代码保证 | 依赖模型严格遵守格式，JSON 写坏要兜底 |
| 数据来源 | 后端取真实数据 | 模型自己写数字，容易编 |
| 扩展到文件、表单 | 自然 | 很别扭，交互几乎做不了 |
| 适合 | 正式方案 | 原型、过渡期 |

很多团队是先 B 后 A。如果一开始就能改后端，直接选 A，下面也都按 A 来展开。

## Generative UI 的三种模式

在继续设计之前，先看看业界怎么划分这件事。现在社区大致把 Generative UI 分成三种模式，区别在于"界面由谁来定义"：

![Generative UI 的三种模式](/2026/generative-ui/patterns.svg){data-zoomable}

- **受控型（Controlled）**：前端事先写好一组组件，agent 只决定"用哪个组件、传什么参数"。最常见的实现就是把组件和工具调用绑在一起：模型调了某个工具，前端就渲染对应组件。控制力最强，样式和交互完全由前端掌握，代价是每加一种界面都要写一个组件。
- **声明式（Declarative）**：前端提供一个"组件目录"，agent 用目录里的组件拼出一棵组件树（JSON），前端负责把 JSON 映射成真实组件。agent 能组合出新布局，但只能用目录里有的东西。Google 的 A2UI、OpenAI 开放出来的 Open-JSON-UI 属于这一类。
- **开放式（Open-ended）**：agent 或第三方服务直接给一段 HTML，前端放在沙箱 iframe 里运行。表达力最强，但品牌一致性、无障碍和安全都最难保证。MCP Apps 是这一类的代表。

业务内部的 AI 助手，绝大部分场景用受控型就够了：图表、文件、卡片、表单的种类有限，而且都需要符合自己的设计规范。本文的方案以受控型为主；组件类型多起来以后，图表这类块的 schema 会自然地向声明式靠拢。

## 数据从哪来：模型只决定"画什么"

这一点比渲染更重要。业务数据应该来自**工具调用**，由后端去查业务接口；模型只负责决定"要不要画图、画哪个"，而不是自己写一堆数字。

### 把"展示图表"定义成工具

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

模型只给出意图参数（哪个季度、什么图），没有任何业务数字。

> 顺带一提，Chat Completions 里 `tools` 和 `tool_calls` 的 `type` 长期只有 `function` 一种，后来 OpenAI 加了 `custom` 类型，参数是自由文本而不是 JSON，主要给新模型用。国内大多数"OpenAI 兼容"的模型和网关还是只支持 `function`，对这个场景来说也完全够用。

### 后端拦截工具调用

模型发出 `tool_call` 之后，后端（下面叫"编排服务"）不把它透传给前端，而是自己处理：

1. 先给前端发 `block_start`，让前端立刻出一个骨架屏占位；
2. 带着当前用户的身份去调业务接口，拿到真实数据；
3. 把数据拼成图表 schema，发 `block_end`；
4. 把数据摘要作为工具结果交回模型，让模型基于真实数据继续写分析。

![一轮对话的完整时序](/2026/generative-ui/sequence.svg){data-zoomable}

第 4 步很容易被忽略。数据是后端取的，但旁边那句"华东领先明显"是模型说的。如果模型没看到真实数据，它就可能说错，而且图和文对不上比没有图更糟。所以工具结果里要带上数据（或者摘要），让模型"看着图说话"。

工具结果里最好也明确告诉模型"图表已经展示给用户了"，否则模型很可能再用一个 Markdown 表格把数字重复一遍。

### 编排服务的主循环

把上面几步写成代码，大致是这样（Node.js + OpenAI SDK，省略了非 UI 工具和错误重试）：

```ts
// 能产生界面的工具：执行后得到一个块
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
      // 流式返回时，tool_calls 的参数是分片到达的，按 index 拼起来
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
    // 带着工具结果进入下一次循环，模型会接着写分析
  }
  sse.send('done', {});
}
```

注意 `tool_calls` 从头到尾都没有发给前端。前端只认识编排服务自己定义的事件，以后换模型厂商，前端协议不受影响。

## 协议设计

### 统一的事件外壳

所有事件用同一个外壳，方便扩展、去重和排查：

```ts
type SSEEnvelope<T> = {
  v: 1;            // 协议版本
  msgId: string;   // 所属消息
  blockId: string; // 所属块
  seq: number;     // 单调递增序号，用于去重和断线续传
  data: T;
};
```

事件类型固定为下面几种：

| 事件 | 作用 | 关键字段 |
| --- | --- | --- |
| `text_delta` | 文本增量 | `delta` |
| `block_start` | 一个非文本块开始，前端出占位 | `type`、可选的 `meta`（如标题、预估高度） |
| `block_delta` | 块的增量更新（可选） | JSON Patch 数组 |
| `block_end` | 块完成，带完整 payload | `payload` |
| `block_error` | 这个块失败了 | `code`、`message`、是否可重试 |
| `done` | 整条消息结束 | 用量统计等 |
| `error` | 整轮失败 | `code`、`message` |

两条兼容性约定：

- **前端遇到不认识的事件类型直接忽略。** 这样后端加新类型不会把旧版前端搞坏。
- **前端遇到不认识的块类型，显示 `fallback` 文本。** 下文会讲 `fallback` 字段。

`block_delta` 是为大块准备的：比如一张几百行的表格，可以先发表头，再分批追加行。用 JSON Patch（RFC 6902）描述变化，和 AG-UI 的 `STATE_DELTA` 是同一个思路，大部分场景用不到。

### 块可以"晚到"

后端取数可能要几百毫秒到几秒。合理的顺序是：先发 `block_start`，前端立刻出骨架屏；文字继续往下流；数据回来后再发 `block_end`。

这意味着块的到达顺序和显示顺序不一致。前端必须**按 `blockId` 回填到原来的位置**，而不是按到达顺序追加到末尾：

![图表晚到：占位、继续出字、原位回填](/2026/generative-ui/late-block.svg){data-zoomable}

骨架屏的高度要和图表最终高度一致，否则回填时页面会跳一下，用户正在读的文字被顶下去。可以在 `block_start` 的 `meta` 里带一个预估高度。

### 失败、重试和断线

**单个块失败**发 `block_error`，前端在原位显示错误态和重试按钮。重试不必重跑整轮对话，走一个普通 HTTP 接口就行，比如 `POST /chat/blocks/:blockId/retry`，后端用当时记下的工具参数重新取数，返回新的 payload。

**断线续传**靠 `seq`。浏览器原生的 `EventSource` 会自动带 `Last-Event-ID` 重连，但它只支持 GET；AI 对话一般是 POST，要用 fetch 自己读流，重连逻辑也要自己写：记住最后一个 `seq`，重连时带上，后端从这之后补发。后端做不到补发的话，至少保证 `done` 之后能从历史接口拿到完整的块数组。

## 块的分类与 schema

### 按处理方式分三类

块的种类会越来越多，但按处理方式只有三类，难点各不相同：

| 类别 | 例子 | 数据方向 | 核心问题 |
| --- | --- | --- | --- |
| 展示类 | 图表、日志查询语句、代码、表格 | 服务端 → 前端 | 怎么渲染、怎么统一样式 |
| 资源类 | PDF、图片、Excel 等文件 | 对象存储 ↔ 前端 | 内容不走 SSE，只传引用 |
| 交互类 | 可点击卡片、表单、确认框 | 双向 | 需要回传通道、状态和幂等 |

### 统一的块结构

```ts
type Block = {
  id: string;
  type: string;           // 'text' | 'chart' | 'query' | 'file' | 'card' | 'form' ...
  version: number;        // 这个类型 schema 的版本
  status: 'loading' | 'done' | 'error';
  payload?: unknown;      // 各类型自己的 schema
  fallback?: string;      // 前端不认识这个类型时显示的纯文本
  actions?: Action[];     // 交互类才有
  state?: unknown;        // 服务端维护的交互状态，例如表单是否已提交
};
```

`fallback` 很重要：老版本前端、小程序端能力不全的时候、把对话导出成纯文本或者转给另一个模型看的时候，都靠它。比如图表块的 `fallback` 可以是"Q3 区域销售额：华东 320、华南 210……"。

### 展示类：图表

图表 schema 有个关键决定：后端直接填 ECharts 的 `option`，还是填一份业务语义的 schema，由前端映射成 `option`？

| | 直接下发 ECharts option | 语义 schema + 前端映射 |
| --- | --- | --- |
| 前端工作量 | 几乎为零 | 每种图写一个 mapper |
| 新增图形 | 后端改就行，不用发版 | 要前端支持 |
| 样式统一 | 难，主题色、字体、暗色模式散落在后端 | 前端统一处理 |
| 数值格式化 | JSON 里放不了函数，只能写字符串模板 | 前端用函数随便格式化 |
| 响应式 | 后端不知道容器多宽 | 前端按宽度调整 |
| 换图表库或多端 | 后端跟着改 | 只改映射层 |

推荐以语义 schema 为主：

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

前端每种图写一个 mapper，再和基础主题合并：

```ts
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

function toBarOption(spec: ChartSpec) {
  // 类别多的时候横向柱状图更好读
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

再留一个逃生口：`{ "type": "echarts_raw", "option": {...} }`，给桑基图、地图这类少见的图形用。前端拿到后依然先合并基础主题再 `setOption`，并且只接受后端代码生成的 option，不接受模型输出的。等某种 raw 图形用多了，再把它提升成正式的语义类型。

### 展示类：日志查询语句

本质上是一个带语言标记的代码块，但值得做成独立类型，因为它几乎总是配着动作：

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

"执行查询"的结果可以作为一个新的表格块或图表块追加到消息里。执行这一步由后端完成：限制只读、限制时间范围、沿用用户自己的日志权限，不能因为是 AI 生成的语句就开后门。

### 资源类：文件只传引用

PDF、图片、Excel 的内容绝不要塞进 SSE。后端生成或取到文件后放进对象存储，事件里只带引用：

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

几个要点：

- **短期签名 URL**。链接过期后，前端调 `GET /assets/:id/url` 换一个新的。翻历史消息时一定会遇到过期的情况，别把签名 URL 当永久地址存死。
- **预览和下载分开**。图片直接显示缩略图；PDF 用 pdf.js 预览前几页；Excel 由后端顺带给前 N 行预览数据，前端不必下载、解析整个文件，需要完整查看时再用 SheetJS 打开或者跳转到在线预览。
- **生成慢的文件给进度**。比如导出一份大报表，先 `block_start`，中间用 `block_delta` 更新进度，完成后 `block_end` 带上链接。
- **大文件的预览数据也要有上限**。几十 KB 以内的单条 SSE 事件比较稳妥，超过就该拆或者改成按需拉取。

### 交互类：卡片与表单

交互类块和前两类的根本区别是：**SSE 是单向的，用户的操作需要另一条路回到后端**。

![交互块的回传通道](/2026/generative-ui/actions.svg){data-zoomable}

回传走一个独立接口：

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

关键设计是**动作的去向要在定义里写清楚**：

```ts
type Action = {
  id: string;
  label: string;
  kind: 'api' | 'prompt' | 'link' | 'local';
  // api:    直接调业务接口，不经过模型（提交审批、执行查询）
  // prompt: 转成一条用户消息发给模型（"展开华东各城市数据"）
  // link:   纯跳转
  // local:  纯前端行为（复制、展开收起）
  prompt?: string;   // kind 为 prompt 时，要发给模型的文本
  href?: string;     // kind 为 link 时的地址
  confirm?: string;  // 有副作用的动作，先弹二次确认
};
```

`prompt` 类动作是 AI 助手里很有价值的交互。比如柱状图的柱子可以点，点"华东"就自动发一句"展开华东各城市的数据"，比让用户自己打字顺手得多。这就是图表在对话里比在静态报表里更有用的地方。

表单的字段和校验建议直接用 JSON Schema，再配一份 uiSchema 描述控件，不用自己发明，前端可以直接用 react-jsonschema-form 这类现成的库渲染：

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

模型可以帮忙预填默认值（比如从对话里推断出时间范围），但字段本身来自后端的表单定义。

### 交互类的几个坑

- **状态要落库。** 表单提交后，服务端把这个块的 `state` 改成"已提交"并记下结果，前端据此锁定表单。刷新页面、换设备打开历史记录时，不能再提交一次。
- **幂等。** 每次动作带唯一的 `idempotencyKey`，后端按它去重，防止用户连点。
- **后端重新校验。** 前端的 JSON Schema 校验只管体验，后端要用同一份 schema（比如 ajv）再校验一遍，并且检查权限。
- **动作白名单。** 哪些表单、哪些 api 动作能出现，由后端的注册表决定；模型只能从中挑选和填参数，不能凭空造一个"调用某某接口"的按钮。这一点在安全部分还会再说。

## 前端实现

整体流水线如下：

![前端的处理流水线](/2026/generative-ui/frontend.svg){data-zoomable}

### 读流：用 fetch，不用 EventSource

AI 对话一般是 POST 请求，带着历史消息和各种参数，原生 `EventSource` 只支持 GET，所以要用 fetch 自己读：

```ts
export async function* readSSE(res: Response) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, '\n');
    let end: number;
    // SSE 用一个空行分隔事件
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

这是一个够用的最小实现。生产环境可以直接用 eventsource-parser 或 @microsoft/fetch-event-source，边界情况处理得更完整。

请求时顺便带上**能力声明**，告诉后端这一端支持哪些块类型和版本：

```ts
fetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Blocks': 'chart@1,query@1,file@1,form@1' },
  body: JSON.stringify({ messages }),
});
```

`X-Blocks` 是我们自己约定的头。Web、小程序、App 能力不同时很有用：后端遇到不支持的类型，可以降级成 `fallback` 文本或链接，而不是发一个前端渲染不了的块。

### reducer：按 blockId 合并

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
      return msg; // 不认识的事件直接忽略
  }
}

// 已有的块原地更新，新的块追加到末尾：这保证了晚到的块会回填到原位置
function upsert(msg: Message, id: string, fn: (b?: Block) => Block): Message {
  const i = msg.blocks.findIndex((b) => b.id === id);
  if (i === -1) return { ...msg, blocks: [...msg.blocks, fn()] };
  const blocks = msg.blocks.slice();
  blocks[i] = fn(blocks[i]);
  return { ...msg, blocks };
}
```

`block_end` 的 payload 用 zod 之类的库按类型校验一遍。校验不通过时，块进入错误态显示 `fallback`，而不是让整条消息崩掉。

### 合批：别让每个 token 都触发一次渲染

文字流每秒可能有几十个事件，每个都 `setState` 会很卡。先把事件放进队列，用 `requestAnimationFrame` 每帧合并一次：

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

### 渲染：组件注册表

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
  // 只有这个块自己变了才重渲染
  (prev, next) => prev.block === next.block,
);

export function MessageView({ message }: { message: Message }) {
  return message.blocks.map((b) => <BlockView key={b.id} block={b} />);
}
```

几个细节：

- **reducer 保持不可变更新**，没变化的块引用不变，`memo` 才能生效。否则文字每流一次，图表就会被重新 `setOption` 一次。
- **重组件懒加载**。ECharts、pdf.js、表单库体积都不小，只在第一次遇到对应块时才加载；ECharts 只引入用到的图表和组件。
- **每个块独立容错**。一个块渲染出错，只影响它自己，显示 `fallback`。
- **骨架屏固定高度**，前面讲过，避免回填时布局跳动。

## 对照业界标准

上面这套是自研的方案，但在设计时值得对照一下几个已有标准，事件命名、消息结构尽量向它们靠拢，以后接入现成生态的成本会低很多。先看它们各自管哪一段：

![几个协议各管一段](/2026/generative-ui/protocol-stack.svg){data-zoomable}

- **MCP** 连接 agent 和工具、数据；
- **A2A** 连接 agent 和其他 agent；
- **AG-UI** 连接 agent 和用户界面，是一条双向的事件流；
- **A2UI、Open-JSON-UI、MCP Apps** 是在这条事件流上传输的"UI 载荷"格式。

### AG-UI：agent 和前端之间的事件协议

AG-UI（Agent–User Interaction Protocol）出自 CopilotKit，是一个开源的、基于事件的协议，常用 SSE 传输。注意它**不是** UI 规范，而是 agent 和应用之间的运行时连接；上面说的几种 UI 规范都可以在它上面跑。

它的事件按类别分成几组：

| 类别 | 事件 |
| --- | --- |
| 生命周期 | `RUN_STARTED`、`RUN_FINISHED`、`RUN_ERROR`、`STEP_STARTED`、`STEP_FINISHED` |
| 文本消息 | `TEXT_MESSAGE_START`、`TEXT_MESSAGE_CONTENT`、`TEXT_MESSAGE_END` |
| 工具调用 | `TOOL_CALL_START`、`TOOL_CALL_ARGS`、`TOOL_CALL_END`、`TOOL_CALL_RESULT` |
| 状态 | `STATE_SNAPSHOT`、`STATE_DELTA`、`MESSAGES_SNAPSHOT`、`ACTIVITY_SNAPSHOT`、`ACTIVITY_DELTA` |
| 推理 | `REASONING_START`、`REASONING_MESSAGE_CONTENT` 等 |
| 子 agent | `SUBAGENT_STARTED`、`SUBAGENT_FINISHED`、`SUBAGENT_ERROR` |
| 扩展 | `RAW`、`CUSTOM` |

流式内容统一用"开始—内容—结束"三段式，共享同一个 ID；`STATE_DELTA` 和 `ACTIVITY_DELTA` 用 JSON Patch 描述增量；`CUSTOM` 用 `name` + `value` 承载应用自定义数据。

拿它和我们的事件对照一下，几乎能一一对上：

| 本文的事件 | AG-UI 中的对应 |
| --- | --- |
| `text_delta` | `TEXT_MESSAGE_CONTENT` |
| `block_start` / `block_end` | `TOOL_CALL_START` / `TOOL_CALL_RESULT`（前端按工具名渲染），或 `ACTIVITY_SNAPSHOT`，或 `CUSTOM` |
| `block_delta` | `ACTIVITY_DELTA` / `STATE_DELTA`（JSON Patch） |
| `done` | `RUN_FINISHED` |
| `error` | `RUN_ERROR` |

所以如果是新项目，完全可以直接用 AG-UI 的事件命名，自定义的块放在 `CUSTOM` 或 `ACTIVITY_*` 里。

### A2UI：声明式的组件树

A2UI 是 Google 提出的声明式 Generative UI 规范，强调"传的是数据，不是代码"：agent 只描述界面，客户端用自己的原生组件渲染，不执行任何来自 agent 的代码。当前版本是 v0.9 系列（v1.0 还在候选阶段），消息只有四种：

| v0.9 消息 | 作用 | v0.8 中的旧名 |
| --- | --- | --- |
| `createSurface` | 创建一块界面，声明用哪个组件目录（`catalogId`） | `beginRendering` |
| `updateComponents` | 增量更新组件 | `surfaceUpdate` |
| `updateDataModel` | 更新数据模型 | `dataModelUpdate` |
| `deleteSurface` | 删除界面 | `deleteSurface` |

几个设计很值得借鉴：

- **组件是扁平列表，用 ID 引用子组件**，而不是嵌套的树。这对模型非常友好：可以一个一个地生成、增量地修改，某个组件写错了也只影响它自己。
- **组件目录（catalog）就是安全边界**。agent 只能使用客户端目录里有的组件，属性也要按目录里的 schema 校验。
- **界面结构和数据分离**。组件用 JSON Pointer 绑定数据，比如 `{"path": "/user/name"}`；数据变了，绑定的组件自动更新，不用重发组件。

```json
{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Text","text":{"path":"/user/name"}}]}}
{"version":"v0.9","updateDataModel":{"surfaceId":"main","path":"/","value":{"user":{"name":"Alice"}}}}
```

用户操作用 `action` 回传。组件上的动作分两种：`event` 会发回给 agent，`functionCall` 只在客户端本地执行（比如打开链接）。事件的 `context` 里可以引用数据模型里的路径，渲染器在发送前把它解析成实际值：

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

对照我们的方案：`event` 对应 `api`/`prompt` 类动作，`functionCall` 对应 `link`/`local` 类动作。如果有一天业务方希望 agent 能自由组合"卡片 + 列表 + 按钮"这类布局，而不是每种都让前端写一个专门组件，A2UI 就是现成的答案。

### MCP Apps：沙箱里的 HTML

MCP Apps 是 MCP 的一个扩展（SEP-1865），2025 年 11 月提出，目前已是 Final 状态。它把社区项目 MCP-UI 和 OpenAI Apps SDK 的做法统一成了一个开放标准。要点：

- **UI 是预先声明的资源**，用 `ui://` 协议标识，MIME 类型是 `text/html;profile=mcp-app`。工具通过元数据 `_meta.ui.resourceUri` 关联到它的界面。这样宿主可以在调用工具前预取模板，也方便事先审查 HTML。
- **宿主把 HTML 放进沙箱 iframe 渲染**，iframe 和宿主之间用 MCP 自己的 JSON-RPC 通过 `postMessage` 通信：界面先发 `ui/initialize` 握手，宿主再推送工具的输入和结果（`ui/notifications/tool-input`、`ui/notifications/tool-result`），界面也可以反过来调用工具（`tools/call`）或者往对话里发消息（`ui/message`）。
- **安全靠多层机制**：强制沙箱、资源可审查、所有通信可记录、界面发起的工具调用可以要求用户确认。资源可以声明 CSP，不声明时默认禁止网络访问。
- **工具可见性**：工具可以设置只给模型用、只给界面用，或者两者都能用。

它解决的是"别人的 UI 怎么安全地嵌进我的对话"。如果你的助手要接第三方的 MCP 服务，并且对方自带界面，就用这条路；业务自己的组件则没必要走 iframe，样式、性能和交互都不如原生组件。

### Vercel AI SDK：受控型的典型做法

如果技术栈是 React + Next.js，AI SDK 的做法就是标准的受控型：工具在服务端定义和执行，前端从 `message.parts` 里读工具调用，类型是 `tool-<工具名>`，再根据它的状态渲染组件：

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

和本文的方案对照，`input-available` 相当于 `block_start`，`output-available` 相当于 `block_end`。思路完全一致，只是 AI SDK 把"块"直接等同于"工具调用"。

### 怎么选

| 场景 | 建议 |
| --- | --- |
| 业务自己的图表、文件、卡片、表单 | 受控型：自研块协议或 AI SDK tool parts，事件命名向 AG-UI 靠拢 |
| 组件很多、布局多变，希望 agent 自由组合 | 声明式：A2UI，按自己的设计规范做组件目录 |
| 接入第三方、不受控的界面 | 开放式：MCP Apps，沙箱 iframe |
| 技术栈 React，想少写协议代码 | AI SDK 或 CopilotKit |
| 多端（Web、小程序、App） | 自研协议 + 能力声明，或 A2UI（渲染器与框架无关） |

## 持久化、回放与可观测

**落库存的就是块数组。** 历史消息直接存结构化的 `blocks`，包括图表的最终数据，回放时不需要重新解析文本，也不需要重新取数。这里有个产品问题要提前对齐：回看历史时，图表应该显示**当时的快照**，还是**重新查一次最新数据**？大多数情况是快照更合理，否则"上周的分析"和"今天的图"对不上。可以在块上加个"刷新"动作，按需重新取数。

**签名 URL 不入库或者入库后能续期。** 存 `assetId`，展示时再换签名 URL。

**轨迹单独存一份。** 用户反馈"图表数据不对"时，需要看到模型调了什么工具、参数是什么、接口返回了什么。这部分可以按 [ATIF](/2026/atif) 这样的轨迹格式落一份，图表 schema、块 ID 这类前端专属信息放在 step 的 `extra` 里，和块数组通过消息 ID 关联起来。

## 安全

富内容带来的安全问题，主要集中在"谁能决定界面上出现什么"：

1. **不渲染模型输出的 HTML。** Markdown 渲染器要关掉原始 HTML，或者严格过滤。模型的输出可能受到提示注入影响，比如它读到的某个文档里藏了一段指令。
2. **块 payload 全部做 schema 校验**，包括后端生成的。
3. **动作只能来自白名单。** 模型能决定"展示哪个表单""预填什么值"，但不能决定"这个按钮调用哪个接口"。api 类动作在后端注册表里定义，执行时重新鉴权、重新校验参数。
4. **有副作用的操作要用户确认。** 提交、删除、发送这类动作配上 `confirm`，并且由用户点击触发，模型不能替用户点。
5. **第三方界面一律进沙箱。** iframe 加 `sandbox`，声明严格的 CSP，通信走可审计的消息通道，这也是 MCP Apps 的做法。
6. **工具执行沿用用户身份。** 取数、执行查询、生成文件都用当前用户的权限，AI 助手不能成为越权访问数据的捷径。

## 落地清单

按顺序推进，每一步都能独立上线：

1. **定事件协议。** 外壳（`v`、`msgId`、`blockId`、`seq`）加 7 种事件，写成文档，前后端共同维护。
2. **先做图表块。** 后端用工具调用拦截取数，前端做 reducer、注册表和图表组件，跑通"占位—回填—模型基于真实数据续写"的完整链路。
3. **加 `fallback` 和能力声明。** 为多端和降级打基础。
4. **加文件块。** 对象存储、签名 URL、预览数据。
5. **加动作接口和交互块。** 先做 `link`、`prompt` 这种没有副作用的，再做 `api` 类；同步做好状态落库、幂等和二次确认。
6. **持久化和轨迹。** 块数组入库，轨迹单独存，方便排查和评测。
7. **按需引入标准。** 组件多到维护不过来时考虑 A2UI；要接第三方界面时上 MCP Apps。

## 总结

让 AI 助手的回复"不止是文字"，关键不在于找一个能画图的库，而在于把输出的单位从"文本"换成"块"：

- **协议上**，SSE 事件带上类型和块 ID，块可以晚到、可以失败、可以增量更新；
- **数据上**，模型只决定画什么，数字由后端取，取到后再交回给模型，保证图文一致；
- **组件上**，按展示类、资源类、交互类分别处理，文件只传引用，交互走单独的回传接口；
- **前端上**，reducer 合并、注册表分发、每个块独立容错；
- **标准上**，事件向 AG-UI 靠拢，组件多了看 A2UI，第三方界面用 MCP Apps。

这套结构和插件系统很像：每种块就是一个"前端插件"，有自己的 schema、版本、渲染组件和允许的动作。按插件的方式去管理它们，注册、升级、下线都会顺手很多。

## 参考资料

- [AG-UI 文档：事件类型](https://docs.ag-ui.com/sdk/js/core/events)
- [A2UI：What is A2UI](https://a2ui.org/introduction/what-is-a2ui/)
- [A2UI：消息类型](https://a2ui.org/reference/messages/)
- [A2UI：Actions](https://a2ui.org/concepts/actions/)
- [SEP-1865：MCP Apps - Interactive User Interfaces for MCP](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [MCP Apps 规范（modelcontextprotocol/ext-apps）](https://github.com/modelcontextprotocol/ext-apps)
- [AI SDK：Generative User Interfaces](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [CopilotKit：Generative UI Specs](https://showcase.copilotkit.ai/learn/generative-ui/specs)
- [CopilotKit/generative-ui：三种模式与协议的示例仓库](https://github.com/CopilotKit/generative-ui)
- [Generative UI in 2026: Controlled, A2UI Declarative, and Open-Ended Patterns on AG-UI](https://mer.vin/2026/06/generative-ui-in-2026-controlled-a2ui-declarative-and-open-ended-patterns-on-ag-ui/)
- [OpenAI Ruby SDK：ChatCompletionNamedToolChoiceCustom](https://rubydoc.info/gems/openai/OpenAI/Models/Chat/ChatCompletionNamedToolChoiceCustom)
