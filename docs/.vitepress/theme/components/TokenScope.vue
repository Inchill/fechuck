<script setup lang="ts">
// Token 显微镜：输入一段文字，实时看它被切成哪些 token
// 用 OpenAI 公开的 tiktoken 词表（js-tiktoken），全部在浏览器里算，不上传任何内容
// 词表文件比较大（1~2 MB），进入页面后按需加载
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import type { Tiktoken } from 'js-tiktoken/lite'

type EncId = 'o200k_base' | 'cl100k_base'
const ENCODINGS: { id: EncId; name: string; models: string }[] = [
  { id: 'o200k_base', name: 'o200k', models: 'GPT-4o、GPT-4.1、o 系列' },
  { id: 'cl100k_base', name: 'cl100k', models: 'GPT-4、GPT-3.5' }
]
const PRESETS: { name: string; text: string }[] = [
  { name: '中文', text: '渐进式披露是 Skills 最关键的设计：先给模型一份目录，用得上的时候再把完整的说明读进来。这样上下文里只放真正需要的东西。' },
  {
    name: 'English',
    text: 'Progressive disclosure is the key idea behind Skills: give the model a short table of contents first, and load the full instructions only when they are actually needed.'
  },
  {
    name: '代码',
    text: `function debounce(fn, wait = 200) {\n  let timer\n  return (...args) => {\n    clearTimeout(timer)\n    timer = setTimeout(() => fn(...args), wait)\n  }\n}`
  },
  { name: '中英混排', text: '用 Node.js 往 Elasticsearch 批量写入时，bulk 请求太大就会触发 429 Too Many Requests，需要做限流。' },
  { name: 'Emoji', text: '今天天气不错 ☀️，去公园跑了 5 公里 🏃‍♂️，回来喝杯咖啡 ☕️ 写代码 👨‍💻。' }
]

const text = ref(PRESETS[0].text)
const enc = ref<EncId>('o200k_base')
const showIds = ref(false)
const loading = ref(true)
const failed = ref(false)
const encoders = shallowRef<Partial<Record<EncId, Tiktoken>>>({})

// 按需加载词表：两个编码各自是一个独立的分包
async function load(id: EncId) {
  if (encoders.value[id]) return encoders.value[id]!
  const [{ Tiktoken }, ranks] = await Promise.all([
    import('js-tiktoken/lite'),
    id === 'o200k_base' ? import('js-tiktoken/ranks/o200k_base') : import('js-tiktoken/ranks/cl100k_base')
  ])
  const e = new Tiktoken(ranks.default)
  encoders.value = { ...encoders.value, [id]: e }
  return e
}

onMounted(async () => {
  try {
    await load('o200k_base')
    loading.value = false
    load('cl100k_base').catch(() => {}) // 后台顺便把另一个也加载好，切换时不用等
  } catch {
    failed.value = true
  }
})
watch(enc, async (id) => {
  if (encoders.value[id]) return
  loading.value = true
  await load(id).catch(() => (failed.value = true))
  loading.value = false
})

// 输入时稍微节流，长文本不卡
const input = ref(text.value)
let t = 0
watch(text, (v) => {
  clearTimeout(t)
  t = window.setTimeout(() => (input.value = v.slice(0, 20000)), 120)
})

interface Piece {
  text: string
  ids: number[]
  cjk: boolean
}
// 把 token 序列还原成一段段文字。一个汉字或 emoji 的 UTF-8 字节可能被切进几个 token，
// 单独解码会是乱码「�」，所以把它们合成一块显示，并标出用了几个 token
function pieces(e: Tiktoken, s: string): Piece[] {
  const ids = e.encode(s)
  const out: Piece[] = []
  let buf: number[] = []
  for (const id of ids) {
    buf.push(id)
    const str = e.decode(buf)
    if (!str.includes('�') || buf.length >= 6) {
      out.push({ text: str, ids: buf, cjk: /[㐀-鿿豈-﫿]/.test(str) })
      buf = []
    }
  }
  if (buf.length) out.push({ text: e.decode(buf), ids: buf, cjk: false })
  return out
}

const result = computed(() => {
  const e = encoders.value[enc.value]
  return e ? pieces(e, input.value) : []
})
const tokenCount = computed(() => result.value.reduce((n, p) => n + p.ids.length, 0))
const chars = computed(() => [...input.value].length)
const other = computed(() => {
  const id: EncId = enc.value === 'o200k_base' ? 'cl100k_base' : 'o200k_base'
  const e = encoders.value[id]
  return e ? { name: ENCODINGS.find((x) => x.id === id)!.name, n: e.encode(input.value).length } : null
})
// 中文和其他文字分别用了多少 token
const split = computed(() => {
  let cjkChars = 0
  let cjkTokens = 0
  for (const p of result.value) {
    if (!p.cjk) continue
    cjkChars += (p.text.match(/[㐀-鿿豈-﫿]/g) ?? []).length
    cjkTokens += p.ids.length
  }
  return { cjkChars, cjkTokens }
})
const fmt = (n: number) => n.toLocaleString('en-US')
const ratio = computed(() => (tokenCount.value ? (chars.value / tokenCount.value).toFixed(2) : '0'))

// 空白字符显示成可见符号，否则空格 token 看不出来
// emoji 里看不见的连接符（ZWJ）和变体选择符也各占 token，用小符号标出来
const visible = (s: string) =>
  s
    .replace(/ /g, '·')
    .replace(/\t/g, '→')
    .replace(/\n/g, '↵\n')
    .replace(/\u200d/g, '⨝')
    .replace(/\ufe0f/g, '◌')

const hoverIdx = ref(-1)
</script>

<template>
  <div class="ts">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /><path d="M5.5 7h3M7 5.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
        <a href="/lab/">LAB</a> <i>/</i> Token 显微镜
      </div>
      <h1 class="headline">看看模型眼里，<span class="grad">文字长什么样。</span></h1>
      <p class="sub">输入一段话，实时看它被切成了哪些 token。全部在浏览器里计算，不会上传。</p>
    </header>

    <div class="panel">
      <div class="bar">
        <div class="presets">
          <button v-for="p in PRESETS" :key="p.name" type="button" :class="{ on: text === p.text }" @click="text = p.text">{{ p.name }}</button>
        </div>
        <div class="encs" role="radiogroup" aria-label="编码">
          <button v-for="e in ENCODINGS" :key="e.id" type="button" role="radio" :aria-checked="enc === e.id" :class="{ on: enc === e.id }" :title="e.models" @click="enc = e.id">
            {{ e.name }}
          </button>
        </div>
      </div>

      <textarea v-model="text" rows="5" spellcheck="false" placeholder="在这里输入或粘贴任意文字……" aria-label="要分词的文字"></textarea>

      <div class="stats">
        <div><b>{{ fmt(tokenCount) }}</b><span>token</span></div>
        <div><b>{{ fmt(chars) }}</b><span>字符</span></div>
        <div><b>{{ ratio }}</b><span>字符 / token</span></div>
        <div v-if="split.cjkChars"><b>{{ (split.cjkTokens / split.cjkChars).toFixed(2) }}</b><span>token / 汉字</span></div>
        <div v-if="other" class="cmp">
          换成 {{ other.name }}：<b>{{ fmt(other.n) }}</b>
          <em :class="other.n > tokenCount ? 'up' : other.n < tokenCount ? 'down' : ''">{{ other.n === tokenCount ? '一样多' : (other.n > tokenCount ? '+' : '') + Math.round(((other.n - tokenCount) / Math.max(1, tokenCount)) * 100) + '%' }}</em>
        </div>
      </div>

      <div class="out-head">
        <span>{{ ENCODINGS.find((e) => e.id === enc)!.models }} 看到的</span>
        <label class="ids"><input v-model="showIds" type="checkbox" />显示 token ID</label>
      </div>
      <div class="out" :class="{ 'with-ids': showIds }" @mouseleave="hoverIdx = -1">
        <p v-if="failed" class="msg">词表加载失败，刷新一下试试。</p>
        <p v-else-if="loading" class="msg">正在加载词表…</p>
        <p v-else-if="!result.length" class="msg">输入点什么吧。</p>
        <template v-else>
          <span
            v-for="(p, i) in result"
            :key="i"
            class="tok"
            :class="['c' + (i % 5), { multi: p.ids.length > 1, hot: hoverIdx === i }]"
            :title="`${p.ids.length > 1 ? p.ids.length + ' 个 token：' : 'token '}${p.ids.join(', ')}`"
            @mouseenter="hoverIdx = i"
          >
            <span class="tt">{{ visible(p.text) }}</span>
            <sub v-if="showIds" class="id">{{ p.ids.join(' ') }}</sub>
            <sup v-else-if="p.ids.length > 1" class="n">×{{ p.ids.length }}</sup>
          </span>
        </template>
      </div>

      <p class="note">
        每个色块是一个 token；标着 ×2、×3 的，是一个字（常见于生僻字和 emoji）被拆成了几个 token。· 是空格，↵ 是换行，⨝ 和 ◌ 是 emoji 里看不见的连接符。
        Claude、Gemini 等模型用的是各自的分词器，数量会有出入，这里展示的是 OpenAI 公开的 tiktoken 编码。
      </p>
    </div>
  </div>
</template>

<style scoped>
.ts {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}

/* ---------- 头部（和书签页、建造回放同一套） ---------- */
.hero {
  position: relative;
  padding: clamp(48px, 9vh, 96px) 0 0;
}
.hero::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -10%;
  width: 60%;
  height: 360px;
  z-index: -1;
  background: radial-gradient(closest-side, var(--info-soft), transparent);
  filter: blur(20px);
  pointer-events: none;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--vp-c-text-2);
}
.eyebrow svg {
  color: var(--vp-c-brand-1);
}
.eyebrow i {
  font-style: normal;
  color: var(--vp-c-text-3);
}
.eyebrow a {
  color: inherit;
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}
.eyebrow a:hover {
  color: var(--vp-c-brand-1);
}
.headline {
  margin: 20px 0 0;
  font-size: clamp(2.2rem, 5.4vw, 3.8rem);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
}
.grad {
  background: linear-gradient(100deg, var(--info) 10%, var(--stable) 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.sub {
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  color: var(--vp-c-text-2);
}

/* ---------- 面板 ---------- */
.panel {
  margin-top: 36px;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-alt);
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.presets button {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}
.presets button:hover,
.presets button.on {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
.encs {
  display: flex;
  padding: 2px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
}
.encs button {
  padding: 4px 12px;
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.encs button.on {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
textarea {
  display: block;
  width: 100%;
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-base);
  font-size: 15px;
  line-height: 1.7;
  color: var(--vp-c-text-1);
  resize: vertical;
  transition: border-color var(--dur-fast) var(--ease-out);
}
textarea:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 28px;
  margin-top: 18px;
}
.stats div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}
.stats b {
  font-family: var(--vp-font-family-mono);
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 500;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
}
.stats .cmp {
  margin-left: auto;
}
.stats .cmp b {
  font-size: 1.1rem;
}
.cmp em {
  font-style: normal;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}
.cmp em.up {
  color: #e5534b;
}
.cmp em.down {
  color: var(--stable);
}

.out-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.ids {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
.ids input {
  accent-color: var(--vp-c-brand-1);
}

/* ---------- 分词结果 ---------- */
.out {
  margin-top: 8px;
  padding: 14px;
  min-height: 120px;
  max-height: 420px;
  overflow-y: auto;
  border-radius: 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 2.1;
  white-space: pre-wrap;
  word-break: break-all;
}
.msg {
  margin: 0;
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-3);
}
.tok {
  position: relative;
  padding: 2px 1px;
  margin: 0 1px;
  border-radius: 4px;
  background: var(--tc);
  box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--tl) 60%, transparent);
  transition: box-shadow 120ms;
}
.tok.hot {
  box-shadow:
    inset 0 -2px 0 var(--tl),
    0 0 0 1.5px var(--tl);
}
/* 被拆成多个 token 的字：虚线边框提醒一下 */
.tok.multi {
  outline: 1px dashed color-mix(in srgb, var(--tl) 70%, transparent);
  outline-offset: -1px;
}
.tt {
  color: var(--vp-c-text-1);
}
.n {
  margin-left: 1px;
  font-size: 9px;
  font-weight: 600;
  color: var(--tl);
}
.id {
  margin-left: 2px;
  font-size: 9.5px;
  color: var(--vp-c-text-3);
}
/* 五种颜色轮换，相邻 token 一眼能分开 */
.c0 {
  --tc: rgba(108, 182, 245, 0.18);
  --tl: #4b8fd6;
}
.c1 {
  --tc: rgba(61, 220, 154, 0.18);
  --tl: #2fae82;
}
.c2 {
  --tc: rgba(240, 168, 104, 0.2);
  --tl: #d98a3d;
}
.c3 {
  --tc: rgba(164, 139, 230, 0.2);
  --tl: #8a6bd6;
}
.c4 {
  --tc: rgba(232, 138, 168, 0.18);
  --tl: #d0628a;
}
.note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}

@media (max-width: 640px) {
  .panel {
    padding: 14px;
  }
  .stats .cmp {
    margin-left: 0;
  }
}
</style>
