---
date: 2026-10-29
outline: deep
tags: [Agent, 可观测]
description: ATIF 是 Harbor 提出的 agent 轨迹交换格式，用一份 JSON 记下消息、推理、工具调用、观察结果和 token 成本，同一份数据能拿去回放、评测和训练。整理一下它的结构、在可观测里的位置，以及读轨迹时容易踩的坑。
---

# ATIF：Agent 可观测的轨迹标准

## 为什么 agent 可观测需要"轨迹"

传统服务的可观测靠日志、指标和链路追踪，排查问题时关心的是"哪个接口慢了、哪里报错了"。Agent 不一样：它的行为由模型在运行时决定，同样的输入可能走出完全不同的路径。要回答"它为什么这么做"，必须看到完整的决策过程：每一轮看到了什么、想了什么、调了哪个工具、工具返回了什么、花了多少 token。

这条完整的过程就是**轨迹（trajectory）**。问题在于，每个 agent 框架都有自己的日志格式：OpenHands 是事件文件，Claude Code 是 JSONL 会话日志，Gemini CLI 又是另一套。可视化工具、评测系统、训练流水线想消费这些数据，就得给每种 agent 单独写解析器。

ATIF（Agent Trajectory Interchange Format）就是为了解决这个碎片化问题而提出的统一轨迹格式。

## ATIF 是什么

ATIF 是一份基于 JSON 的规范，用来记录 LLM agent 的完整交互历史：消息、推理、工具调用、观察结果和指标。它由 agent 评测框架 [Harbor](https://docs.harborframework.com/agents/atif)（Terminal-Bench 背后的框架）以 RFC 0001 的形式提出，并作为 Harbor 的标准日志格式。

RFC 对"轨迹"的定义是：用户与 agent 之间的一串交互，包括 agent 的内部推理、动作和观察，覆盖单轮任务和多轮对话。它的设计目标是把三类需求统一起来：

- 对话日志（谁说了什么）
- 显式动作序列（MiniSweAgent 那种逐条命令的记录）
- 可回放的数据结构（OpenHands 那种事件流）

统一之后，同一份数据可以直接用于调试、可视化、监督微调（SFT）和强化学习（RL）。

### 版本演进

| 版本 | 主要变化 |
| --- | --- |
| v1.8 | 支持音频内容（按路径引用音频文件） |
| v1.7 | 子 agent 轨迹内嵌、`trajectory_id`、`llm_call_count`、上下文管理约定；由 NVIDIA 贡献 |
| v1.6 | 支持图片等多模态内容 |
| v1.5 | `agent.tool_definitions`，方便构造 SFT 数据 |
| v1.4 | `prompt_token_ids` |
| v1.3 | `completion_token_ids`，避免 RL 训练时重新分词造成偏差 |
| v1.2 | system step 也可以带 observation；明确 `prompt_tokens` 包含缓存命中部分 |
| v1.1 | 根级 `extra` 字段 |
| v1.0 | 初版 |

RFC 文档已更新到 v1.8，Harbor 文档中写的当前格式是 v1.7，可接受 v1.0 到 v1.7。实际接入时以所用工具链支持的版本为准。

## 数据结构

一条 ATIF 轨迹是一个根对象。它的核心是按顺序排列的 `steps` 数组，外面包着 agent 元信息和汇总指标。

### 根对象

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `schema_version` | 是 | 例如 `"ATIF-v1.7"` |
| `agent` | 是 | `name`、`version` 必填；可选 `model_name`、`tool_definitions`（OpenAI function calling 格式） |
| `steps` | 是 | 有序的交互步骤 |
| `session_id` | 否 | 运行级 ID，父轨迹和子轨迹、续写轨迹可以共用 |
| `trajectory_id` | 否 | 文档级唯一 ID；内嵌的子 agent 轨迹必须有 |
| `final_metrics` | 否 | 整条轨迹的 token、成本、步数汇总 |
| `subagent_trajectories` | 否 | 内嵌的子 agent 轨迹，每条都是完整合法的 ATIF |
| `continued_trajectory_ref` | 否 | 上下文压缩导致轨迹拆成多个文件时，指向续写文件 |
| `notes` / `extra` | 否 | 备注和自定义元数据 |

### Step：一步交互

每个 step 的 `source` 是 `system`、`user`、`agent` 三者之一。一个 agent step 表示一次完整的回合：模型推理、执行动作、拿到观察结果。

- `message`：消息正文。system step 放系统提示，user step 放用户输入，agent step 放模型回复。
- `reasoning_content`：模型的显式推理过程，只出现在 agent step。
- `tool_calls`：本步发起的工具调用，一次输出可以包含多个。每个调用有 `tool_call_id`、`function_name`、`arguments`。
- `observation.results`：工具返回结果，通过 `source_call_id` 和对应的 `tool_call_id` 关联；也可以通过 `subagent_trajectory_ref` 指向一条子 agent 轨迹。
- `metrics`：本步的 LLM 指标。
- `llm_call_count`、`is_copied_context`：分别标记本步包含几次推理、是否是从上一段轨迹复制过来的上下文，下文细讲。

### Metrics：token 与成本

| 字段 | 含义 |
| --- | --- |
| `prompt_tokens` | 本步输入 token 总数，**包含**缓存命中部分 |
| `cached_tokens` | `prompt_tokens` 中命中缓存的子集 |
| `completion_tokens` | 输出 token 数，含推理和工具调用部分 |
| `cost_usd` | 按执行当时价格计算的实际花费 |
| `prompt_token_ids` / `completion_token_ids` / `logprobs` | 给 RL 训练用的 token 级数据 |
| `extra` | 厂商特有指标，例如 `reasoning_tokens`、`cache_creation_input_tokens` |

规范刻意不记录单价，只存算好的 `cost_usd`。原因是价格会变、各家框架通常不记价格、不同厂商和地区定价也不同。像 Anthropic 的缓存写入这类额外计费项，放在 `metrics.extra` 里，并以厂商返回的真实成本为准。

### 一个最小示例

```json
{
  "schema_version": "ATIF-v1.7",
  "session_id": "run-20261029-001",
  "agent": { "name": "my-agent", "version": "1.0.0", "model_name": "claude-sonnet" },
  "steps": [
    { "step_id": 1, "source": "user", "message": "创建 hello.txt，内容为 Hello" },
    {
      "step_id": 2,
      "source": "agent",
      "message": "我来创建这个文件。",
      "reasoning_content": "只需要一次写文件调用。",
      "tool_calls": [
        { "tool_call_id": "call-1", "function_name": "write_file",
          "arguments": { "path": "hello.txt", "content": "Hello" } }
      ],
      "observation": {
        "results": [ { "source_call_id": "call-1", "content": "File created" } ]
      },
      "llm_call_count": 1,
      "metrics": { "prompt_tokens": 520, "cached_tokens": 200, "completion_tokens": 80, "cost_usd": 0.00045 }
    }
  ],
  "final_metrics": { "total_prompt_tokens": 520, "total_completion_tokens": 80, "total_cached_tokens": 200, "total_steps": 2 }
}
```

## ATIF 在可观测里的位置

ATIF 的价值在于：一份数据，四种用途。同一个 `trajectory.json` 能直接用于排障、成本分析、评测和训练，不用为每个场景单独采集一遍。

1. **调试与回放**：每一步的输入、推理、工具调用和返回都在，能还原"agent 当时看到了什么、为什么这么选"。Harbor 的结果查看器就是直接读 `agent/trajectory.json`，在 Trajectory 标签页里逐步展示。
2. **成本与性能分析**：每步都有 token 和 `cost_usd`，可以定位哪一步最贵、缓存命中率如何、哪类工具调用最耗 token。
3. **评测**：评测器可以基于轨迹打分，例如检查 agent 是否按顺序调用了正确的工具。NVIDIA 的 NeMo Evaluator SDK 就支持以 ATIF 作为评测证据格式。
4. **训练数据**：`tool_definitions` 加上逐步消息可以直接构造 SFT 样本；token ID 和 logprobs 用于 RL，避免重新分词带来的偏差。

### 和 OpenTelemetry trace 的关系

两者是互补的，不是替代关系：

| | OpenTelemetry trace | ATIF 轨迹 |
| --- | --- | --- |
| 关注点 | 调用链路、耗时、错误，基于 span 树 | agent 的交互语义：消息、推理、工具调用、观察 |
| 粒度 | 任意 span，包括 HTTP、DB 等基础设施 | 以 step 为单位的对话回合 |
| 主要消费方 | APM 平台、告警、性能分析 | 回放查看器、评测器、训练流水线 |
| 能否直接当训练数据 | 不能，需要再加工 | 可以，规范就是按此设计的 |

实践中的做法是两者都采集，再用同一个 ID 关联起来。NeMo Relay 的建议就是用运行时的 UUID 把 ATIF 和 OpenTelemetry/OpenInference trace 对齐：ATIF 的 `session_id` 就是顶层 agent scope 的 UUID。

## 读轨迹时容易踩的坑

### step 数不等于 LLM 调用次数

v1.7 规定了"一次推理一个 step"的约定：框架能拿到每次调用的边界（如 `LLM_START`/`LLM_END`）时，导出方应当每次推理输出一个 agent step。拆不开时（比如一个工具内部自己调了好几次模型），必须用 `llm_call_count` 写明实际次数。

| `llm_call_count` | 含义 |
| --- | --- |
| `1` | 本步恰好对应一次推理 |
| `> 1` | 指标是多次调用的合计，无法按次拆分 |
| `0`（agent step） | 确定性调度，没有调用模型，例如编排引擎或规则流水线直接发起的工具调用；这类 step 不能带 `metrics`，SFT 时必须过滤掉 |
| 不填 | 导出方没有统计（兼容旧版本） |

此外，user 和 system step 本身不涉及推理。所以统计调用次数时，应当对 agent step 的 `llm_call_count` 求和，而不是数 step。字段缺失的旧轨迹，只能按 agent step 数做近似估计。

### `prompt_tokens` 包含缓存命中

规范定义 `prompt_tokens` 是全部输入 token，`cached_tokens` 是其中命中缓存的子集。不少厂商 API 返回的 input tokens 只算未命中部分，导出时如果直接照搬，总量会被严重低估。开源项目 evener 就踩过这个坑：它在一次 Terminal-Bench 运行中，导出的 prompt token 总数比实际少了约 115 倍，后来按 RFC 的口径修正了（[evener#4926](https://github.com/prime-radiant-inc/evener/pull/4926)）。

### 上下文压缩后的"复制步"

agent 做摘要或压缩后，会把一部分旧步骤带进新的上下文。这些步骤要标记 `is_copied_context = true`：统计成本时不能重复计算，构造 SFT 数据时必须过滤掉。v1.7 还约定，在 system step 的 `extra.context_management` 里声明压缩方式。当 `boundary` 为 `replace` 时，后续步骤的有效上下文只包括这一步的摘要内容以及之后的新步骤，评测工具重建输入时要按这个规则来。

## 生态与落地

生产 ATIF 有两种方式：agent 运行时直接写出，或者事后把各家的原生日志转换过来。

![ATIF 数据流](/2026/atif/trajectory-flow.svg){data-zoomable}

无论轨迹从哪里来，只要格式统一，下游的查看器、评测器和训练流水线都只需要对接一种格式。

- **Harbor**：自带转换器，能把 OpenHands、Mini-SWE-Agent、Gemini CLI、Claude Code 等 agent 的日志转成 ATIF。自研 agent 声明 `AgentCapabilities(atif=True)` 后，需要写出 `trajectory.json`。参考实现是一组 Pydantic 模型，位于 `harbor.models.trajectories`。
- **NVIDIA NeMo Relay**：可观测插件可以按顶层 agent scope 导出 ATIF，把模型调用事件映射为 agent step，工具事件映射为工具调用和观察结果。导出目标支持本地文件、S3 和 HTTP，可以同时写多个。
- **其他实现**：Rust 生态有 `vtcode-exec-events` 的 ATIF 构建器；Go 官方的 `x/exp` 仓库里也有 ATIF 的解析代码，测试数据直接取自 Harbor 的 golden 轨迹。

### 校验

Harbor 提供了校验器，会检查 schema、step ID 是否从 1 开始连续、`source_call_id` 能否对上 `tool_call_id`、时间戳格式，以及引用的本地图片：

```bash
uv run python -m harbor.utils.trajectory_validator path/to/trajectory.json
```

注意 Harbor 的 Pydantic 模型会拒绝未声明的字段，自定义数据一律放进各级的 `extra`。

### 在自己的平台接入的建议

1. **先定导出点**：在 LLM 网关或 agent runtime 里拿到每次调用的开始和结束事件，按"一次推理一个 step"输出；拆不开的地方填上 `llm_call_count`。
2. **token 口径对齐 RFC**：`prompt_tokens` 要包含缓存命中部分，缓存写入等额外计费项放进 `metrics.extra`，`cost_usd` 以厂商返回的实际费用为准。
3. **ID 打通**：轨迹的 `session_id` 和 OTel trace ID、网关请求 ID 关联起来，这样可以从轨迹跳到链路，也可以从账单反查到轨迹。
4. **多 agent 场景**：子 agent 的轨迹用 `subagent_trajectories` 内嵌，或者用 `trajectory_path` 引用外部文件，父 step 的 observation 里通过 `subagent_trajectory_ref` 指向它。
5. **入库前过一遍校验器**，并把 `final_metrics` 和网关账单做抽样对账。

## 总结

对 agent 可观测来说，OTel 回答的是"慢在哪、错在哪"，ATIF 回答的是"agent 为什么这么做、花了多少"。它把消息、推理、工具调用、观察结果和 token 成本放进同一份 JSON，这份数据可以直接用于回放、评测和训练。

落地时最重要的三件事：按"一次推理一个 step"导出，并填写 `llm_call_count`；token 口径按 RFC 来（`prompt_tokens` 包含缓存命中）；用统一的 ID 把轨迹和 trace、账单关联起来。

## 参考资料

- [ATIF RFC 0001（Harbor）](https://github.com/harbor-framework/harbor/blob/main/rfcs/0001-trajectory-format.md)
- [Harbor 文档：ATIF](https://docs.harborframework.com/agents/atif)
- [Harbor 文档：Agent Trajectory Format](https://harborframework.com/docs/trajectory-format)
- [NVIDIA NeMo Relay：ATIF 导出插件](https://docs.nvidia.com/nemo/relay/v0.6.0/configure-plugins/observability/atif)
- [NeMo Evaluator：按组件打分（ATIF 证据）](https://docs.nvidia.com/nemo-platform/latest/documentation/evaluate-models/agent-eval/score-by-component.md)
- [vtcode-exec-events ATIF 模块](https://docs.rs/vtcode-exec-events/0.98.0/vtcode_exec_events/atif)
- [evener#4926：ATIF token 统计口径修正](https://github.com/prime-radiant-inc/evener/pull/4926)
