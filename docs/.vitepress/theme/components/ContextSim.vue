<script setup lang="ts">
// 上下文窗口模拟器：用「提交代码」这个例子，一步步看 Skill 是怎么被渐进加载、上下文怎么增长、缓存怎么命中的
// 数据是示意值（量级参考真实会话），不是实测
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

type Kind = 'sys' | 'tools' | 'catalog' | 'user' | 'call' | 'skill' | 'result' | 'reply'
interface Block {
  kind: Kind
  label: string
  tokens: number
}
interface Step {
  call?: number // 第几次模型调用
  add: Block[]
  caption: string
}

const WINDOW = 200_000
const CELL = 2_000 // 一格 = 2K token
const SKILLS = 12 // 装了多少个 Skill
const SKILL_BODY = 2_400 // 一个 SKILL.md 正文大约多少 token

const KINDS: Record<Kind, string> = {
  sys: '系统提示',
  tools: '工具定义',
  catalog: 'Skill 目录',
  user: '用户',
  call: '模型 · 工具调用',
  skill: 'SKILL.md',
  result: '工具结果',
  reply: '模型 · 回复'
}

const STEPS: Step[] = [
  {
    add: [
      { kind: 'sys', label: '你是一个编程助手……', tokens: 2800 },
      { kind: 'tools', label: 'Bash、View、Edit 等工具的说明', tokens: 4200 },
      { kind: 'catalog', label: `${SKILLS} 个 Skill 的名字 + 一句描述`, tokens: 1200 }
    ],
    caption: `会话开始。系统提示和工具定义先放进去；${SKILLS} 个 Skill 只放「名字 + 一句描述」，一共才 1.2K token。这是第一级：始终加载，只用来判断要不要用。`
  },
  {
    add: [{ kind: 'user', label: '提交代码', tokens: 40 }],
    caption: '用户只说了四个字。'
  },
  {
    call: 1,
    add: [
      { kind: 'call', label: 'View  skills/git-commit/SKILL.md', tokens: 60 },
      { kind: 'skill', label: 'git-commit 的完整操作规范', tokens: SKILL_BODY }
    ],
    caption: '第 1 次模型调用：模型对照目录，判断 git-commit 用得上，于是用 View 工具把完整的 SKILL.md 读进来。这是第二级：用到了才加载。'
  },
  {
    call: 2,
    add: [
      { kind: 'call', label: 'Bash  git status && git diff --staged', tokens: 50 },
      { kind: 'result', label: '改动的文件和 diff', tokens: 3800 }
    ],
    caption: '第 2 次调用：照着 SKILL.md 的步骤，先看改了什么。这一轮的开头和上一轮一模一样，前面那段直接命中缓存，不重新计费。'
  },
  {
    call: 3,
    add: [
      { kind: 'call', label: 'Bash  git commit -m "feat: 书签页支持搜索"', tokens: 120 },
      { kind: 'result', label: '[master 3f2a1c9] feat: 书签页支持搜索', tokens: 150 }
    ],
    caption: '第 3 次调用：按规范写好提交信息并提交。SKILL.md 里提到的 references/ 参考文件（第三级）这次没用上，就一直留在磁盘上，一个 token 都不占。'
  },
  {
    call: 4,
    add: [{ kind: 'reply', label: '已提交：feat: 书签页支持搜索', tokens: 90 }],
    caption: '第 4 次调用：模型确认结果，回复用户。一句「提交代码」触发了 4 次模型调用，上下文一路增长，但每一轮都只为新增的部分付全价。'
  }
]

const step = ref(0)
const compare = ref(false)
const playing = ref(false)
const listEl = ref<HTMLElement | null>(null)
let timer = 0

// 截至当前步骤的全部块，以及每块是在第几步加进来的
const blocks = computed(() =>
  STEPS.slice(0, step.value + 1).flatMap((s, i) => s.add.map((b, j) => ({ ...b, at: i, head: j === 0 ? (s.call ? `第 ${s.call} 次模型调用` : i === 0 ? '会话开始' : '') : '' })))
)
// 右侧轨迹：在每一轮开头插入「第 N 次模型调用」分隔
const rows = computed(() =>
  blocks.value.flatMap((b, i) => [...(b.head ? [{ type: 'turn' as const, id: 'h' + i, text: b.head }] : []), { type: 'msg' as const, id: 'm' + i, b }])
)
const total = computed(() => blocks.value.reduce((n, b) => n + b.tokens, 0))
const cur = computed(() => STEPS[step.value])
const calls = computed(() => STEPS.slice(0, step.value + 1).filter((s) => s.call).length)

// 本次调用的输入 = 这一步新增之前的全部内容；其中上一次调用时就已存在的前缀命中缓存
const tokensBefore = (i: number) => STEPS.slice(0, i).reduce((n, s) => n + s.add.reduce((m, b) => m + b.tokens, 0), 0)
const lastCallStep = computed(() => {
  for (let i = step.value - 1; i >= 0; i--) if (STEPS[i].call) return i
  return -1
})
const callInput = computed(() => (cur.value.call ? tokensBefore(step.value) : 0))
const cached = computed(() => (cur.value.call && lastCallStep.value >= 0 ? tokensBefore(lastCallStep.value) : 0))

// 对比：如果不用渐进加载，把 12 个 Skill 的正文全塞进系统提示
const skillLoaded = computed(() => blocks.value.some((b) => b.kind === 'skill'))
const allIn = computed(() => total.value + SKILLS * SKILL_BODY - (skillLoaded.value ? SKILL_BODY : 0))

// 格子：每格 2K token，按顺序填色；最后一格可以只填一部分
const cells = computed(() => {
  const n = WINDOW / CELL
  const out: { kind: Kind | ''; fill: number; cached: boolean; fresh: boolean; ghost: boolean }[] = []
  let acc = 0
  const spans = blocks.value.map((b) => {
    const s = { ...b, from: acc, to: acc + b.tokens }
    acc += b.tokens
    return s
  })
  for (let i = 0; i < n; i++) {
    const a = i * CELL
    const b = a + CELL
    // 这一格里占比最大的块决定颜色
    let best: (typeof spans)[number] | null = null
    let bestLen = 0
    for (const s of spans) {
      const len = Math.min(b, s.to) - Math.max(a, s.from)
      if (len > bestLen) {
        best = s
        bestLen = len
      }
    }
    const filled = Math.max(0, Math.min(CELL, acc - a))
    out.push({
      kind: best ? best.kind : '',
      fill: filled / CELL,
      cached: cur.value.call ? b <= cached.value + CELL / 2 && a < cached.value : false,
      fresh: !!best && best.at === step.value,
      ghost: compare.value && a < allIn.value && a >= acc
    })
  }
  return out
})

const k = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'K' : String(n))
const pct = (n: number) => ((n / WINDOW) * 100).toFixed(1) + '%'

function go(i: number) {
  step.value = Math.max(0, Math.min(STEPS.length - 1, i))
}
function next() {
  if (step.value < STEPS.length - 1) go(step.value + 1)
  else stop()
}
function play() {
  if (playing.value) return stop()
  if (step.value === STEPS.length - 1) go(0)
  playing.value = true
  timer = window.setInterval(next, 2600)
}
function stop() {
  playing.value = false
  clearInterval(timer)
}
function reset() {
  stop()
  go(0)
}

// 新块出现时，消息列表滚到底
watch(step, () => nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' })))
onBeforeUnmount(stop)
</script>

<template>
  <div class="cs">
    <div class="cs-head">
      <div class="cs-title">
        <span class="dot" aria-hidden="true"></span>
        上下文窗口模拟：「提交代码」
      </div>
      <label class="cmp">
        <input v-model="compare" type="checkbox" />
        对比：把 {{ SKILLS }} 个 Skill 全塞进系统提示
      </label>
    </div>

    <div class="cs-body">
      <!-- 左：上下文窗口，100 格 × 2K = 200K -->
      <div class="win">
        <div class="grid" role="img" :aria-label="`上下文已用 ${k(total)} / 200K`">
          <span
            v-for="(c, i) in cells"
            :key="i"
            class="cell"
            :class="[c.kind && 'k-' + c.kind, { cached: c.cached, fresh: c.fresh && c.fill > 0, ghost: c.ghost }]"
            :style="c.fill > 0 && c.fill < 1 ? { '--fill': c.fill } : undefined"
          ></span>
        </div>
        <div class="win-foot">
          <span><b>{{ k(total) }}</b> / 200K</span>
          <span class="muted">{{ pct(total) }} · 一格 = 2K token</span>
        </div>
        <div class="legend">
          <span v-for="kk in (['sys', 'tools', 'catalog', 'skill', 'user', 'call', 'result', 'reply'] as Kind[])" :key="kk"><i :class="'k-' + kk"></i>{{ KINDS[kk] }}</span>
          <span><i class="cached-swatch"></i>命中缓存</span>
        </div>
      </div>

      <!-- 右：执行轨迹，messages 一条条增长 -->
      <div ref="listEl" class="trace">
        <TransitionGroup name="msg">
          <div v-for="r in rows" :key="r.id" :class="r.type === 'turn' ? 'turn' : ['msg', 'k-' + r.b.kind, { fresh: r.b.at === step }]">
            <template v-if="r.type === 'turn'">{{ r.text }}</template>
            <template v-else>
              <span class="node" aria-hidden="true"></span>
              <span class="role">{{ KINDS[r.b.kind] }}</span>
              <span class="label">{{ r.b.label }}</span>
              <span class="tk">{{ k(r.b.tokens) }}</span>
            </template>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <p class="caption" aria-live="polite">
      <span class="step-no">{{ step + 1 }}/{{ STEPS.length }}</span>
      {{ cur.caption }}
    </p>

    <div class="stats">
      <div>
        <em>模型调用</em><b>{{ calls }}</b><span>次</span>
      </div>
      <div v-if="cur.call">
        <em>本次输入</em><b>{{ k(callInput) }}</b><span>其中 {{ k(cached) }} 命中缓存</span>
      </div>
      <div v-else>
        <em>本步新增</em><b>{{ k(cur.add.reduce((n, b) => n + b.tokens, 0)) }}</b><span>token</span>
      </div>
      <div v-if="compare" class="warn">
        <em>全塞进去</em><b>{{ k(allIn) }}</b><span>是现在的 {{ (allIn / total).toFixed(1) }} 倍</span>
      </div>
    </div>

    <div class="ctl">
      <button type="button" :disabled="step === 0" @click="stop(), go(step - 1)">上一步</button>
      <button type="button" class="primary" @click="play">{{ playing ? '暂停' : step === STEPS.length - 1 ? '重新播放' : '自动播放' }}</button>
      <button type="button" :disabled="step === STEPS.length - 1" @click="stop(), go(step + 1)">下一步</button>
      <button type="button" class="ghost-btn" @click="reset">重来</button>
    </div>
    <p class="note">示意数据，token 数量级参考真实会话。</p>
  </div>
</template>

<style scoped>
.cs {
  --c-sys: #8a98a3;
  --c-tools: #4b8fd6;
  --c-catalog: #2fae82;
  --c-skill: #1d8a64;
  --c-user: #9b7be0;
  --c-call: #d9a441;
  --c-result: #c98a2e;
  --c-reply: #6fb4f0;
  margin: 28px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg-alt);
}
.cs-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
.cs-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 650;
  color: var(--vp-c-text-1);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--info), var(--stable));
}
.cmp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.cmp input {
  accent-color: var(--vp-c-brand-1);
}

.cs-body {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 20px;
  margin-top: 16px;
}

/* ---------- 上下文窗口格子 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(10, 18px);
  gap: 3px;
}
.cell {
  --fill: 1;
  position: relative;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}
/* 部分填充的格子：从左往右只染一部分 */
.cell[class*='k-']::before {
  content: '';
  position: absolute;
  inset: 0;
  right: calc((1 - var(--fill)) * 100%);
  background: var(--c);
  transition: right 400ms var(--ease-out);
}
.cell.fresh::before {
  animation: pop 500ms var(--ease-out);
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
}
/* 命中缓存：叠一层斜纹 */
.cell.cached::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.55) 0 2px, transparent 2px 5px);
}
/* 对比模式：「全塞进去」会多占的格子，用虚线框标出来 */
.cell.ghost {
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #e5534b 70%, transparent);
  animation: ghost 1.6s ease-in-out infinite;
}
@keyframes ghost {
  50% {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, #e5534b 30%, transparent);
  }
}
.k-sys {
  --c: var(--c-sys);
}
.k-tools {
  --c: var(--c-tools);
}
.k-catalog {
  --c: var(--c-catalog);
}
.k-skill {
  --c: var(--c-skill);
}
.k-user {
  --c: var(--c-user);
}
.k-call {
  --c: var(--c-call);
}
.k-result {
  --c: var(--c-result);
}
.k-reply {
  --c: var(--c-reply);
}
.win-foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
}
.muted {
  color: var(--vp-c-text-3);
}
.legend {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 4px 12px;
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--vp-c-text-2);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legend i {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: var(--c);
}
.legend .cached-swatch {
  background: repeating-linear-gradient(135deg, var(--vp-c-text-3) 0 2px, transparent 2px 4px);
}

/* ---------- 执行轨迹：竖线 + 节点，像 Agent 的调用日志 ---------- */
.trace {
  position: relative;
  min-width: 0;
  max-height: 300px;
  overflow-y: auto;
  padding: 2px 4px 2px 0;
  scrollbar-width: thin;
}
.turn {
  position: relative;
  margin: 0;
  padding: 10px 0 4px 26px;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}
.turn:first-child {
  padding-top: 0;
}
/* 竖线穿过分隔行，整条轨迹不断开；分隔处画一个小菱形 */
.turn::after {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--vp-c-divider);
}
.turn::before {
  content: '';
  position: absolute;
  z-index: 1;
  left: 8px;
  bottom: 7px;
  width: 7px;
  height: 7px;
  rotate: 45deg;
  border: 1px solid var(--vp-c-text-3);
  background: var(--vp-c-bg-alt);
}
.turn:first-child::after {
  top: 50%;
}
.msg {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 26px;
  border-radius: 8px;
  font-size: 12.5px;
  transition: background-color 500ms var(--ease-out);
}
/* 贯穿整条轨迹的竖线 */
.msg::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--vp-c-divider);
}
.msg:last-child::before {
  bottom: 50%;
}
.node {
  position: absolute;
  left: 8px;
  top: 50%;
  width: 7px;
  height: 7px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 0 3px var(--vp-c-bg-alt);
}
.msg.fresh {
  background: color-mix(in srgb, var(--c) 10%, transparent);
}
.msg.fresh .node {
  box-shadow:
    0 0 0 3px var(--vp-c-bg-alt),
    0 0 0 5px color-mix(in srgb, var(--c) 35%, transparent);
}
.role {
  font-size: 11px;
  font-weight: 600;
  color: var(--c);
  white-space: nowrap;
}
.label {
  min-width: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tk {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-3);
}
.msg-enter-active {
  transition:
    opacity 360ms var(--ease-out),
    transform 360ms var(--ease-out);
}
.msg-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* ---------- 说明、数据、按钮 ---------- */
.caption {
  min-height: 3.4em;
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-1);
}
.step-no {
  margin-right: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-brand-1);
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--vp-c-divider);
}
.stats div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.stats em {
  font-style: normal;
}
.stats b {
  font-family: var(--vp-font-family-mono);
  font-size: 18px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.stats .warn b {
  color: #e5534b;
}
.ctl {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.ctl button {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 13px;
  color: var(--vp-c-text-1);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.ctl button:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.ctl button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ctl button.primary {
  border-color: transparent;
  background: linear-gradient(100deg, var(--info), var(--stable));
  color: var(--vp-c-bg);
  font-weight: 600;
}
.ctl button.primary:hover {
  color: var(--vp-c-bg);
  filter: brightness(1.08);
}
.ctl .ghost-btn {
  margin-left: auto;
  border-color: transparent;
  background: transparent;
  color: var(--vp-c-text-3);
}
.note {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

@media (max-width: 640px) {
  .cs {
    padding: 16px;
  }
  .cs-body {
    grid-template-columns: 1fr;
  }
  .grid {
    grid-template-columns: repeat(10, 1fr);
  }
  .cell {
    width: auto;
    height: auto;
    aspect-ratio: 1;
  }
  .trace {
    max-height: 240px;
  }
}
</style>
