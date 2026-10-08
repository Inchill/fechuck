<script setup lang="ts">
import { ref, shallowRef, computed, nextTick, onMounted, onBeforeUnmount, inject } from 'vue'
import { useRouter, useData } from 'vitepress'
import { data as posts } from '../posts.data'
import { data as bookmarks } from '../../../bookmarks/bookmarks.data'

// 终端里 ls / open 用的最近文章（loader 已按日期倒序）
const recent = posts.slice(0, 8)
const router = useRouter()
const { isDark } = useData()
// Layout 里 provide 的明暗切换（带圆形扩散动画）
const toggleAppearance = inject<((e: MouseEvent) => void) | null>('toggle-appearance', null)

type Post = (typeof posts)[number]
type Line =
  | { kind: 'cmd'; text: string }
  | { kind: 'out'; text: string }
  | { kind: 'hi'; text: string } // 按时间变化的问候语
  | { kind: 'list' } // 渲染 recent 列表（带可点链接）
  | { kind: 'hits'; items: Post[] } // grep 搜索结果（带可点链接）
  | { kind: 'cat'; post: Post; n: number } // cat 预览一篇

const lines = shallowRef<Line[]>([])
const input = ref('')
const typing = ref(false) // 自动演示进行中
const history: string[] = []

// ---- 行内联想（灰字补全），类似 fish / kiro cli ----
// 优先从敲过的历史命令里找（最近的优先），再从命令表里找；只补全以当前输入开头的内容
const ARG_CMDS = ['open', 'cat', 'grep'] // 这些命令补全后自动加空格，方便接着输参数
const suggestion = computed(() => {
  const v = input.value
  if (!v.trim()) return ''
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    if (h.startsWith(v) && h !== v) return h
  }
  if (v.includes(' ')) return ''
  const hit = COMMANDS.find((c) => c.startsWith(v) && c !== v)
  return hit ? (ARG_CMDS.includes(hit) ? hit + ' ' : hit) : ''
})
const ghost = computed(() => suggestion.value.slice(input.value.length))

function acceptSuggestion() {
  if (!ghost.value) return false
  input.value = suggestion.value
  nextTick(() => {
    const el = inputEl.value
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  })
  return true
}
let hIndex = -1

const bodyEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

function print(...ls: Line[]) {
  lines.value = [...lines.value, ...ls]
  nextTick(() => {
    const el = bodyEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const COMMANDS = ['help', 'whoami', 'ls', 'cat', 'open', 'grep', 'random', 'theme', 'posts', 'notes', 'bookmarks', 'surf', 'music', 'city', 'tokens', 'stars', 'about', 'github', 'clear']

const HELP: Line[] = [
  { kind: 'out', text: '可用命令：' },
  { kind: 'out', text: '  whoami      我是谁' },
  { kind: 'out', text: '  ls          列出最近文章' },
  { kind: 'out', text: '  cat <n>     预览第 n 篇的摘要（如 cat 1）' },
  { kind: 'out', text: '  open <n>    打开第 n 篇（如 open 1）' },
  { kind: 'out', text: '  grep <词>   按关键词搜文章（如 grep mcp）' },
  { kind: 'out', text: '  random      随机打开一篇' },
  { kind: 'out', text: '  theme       切换明暗主题' },
  { kind: 'out', text: '  posts       全部文章' },
  { kind: 'out', text: '  notes       随想' },
  { kind: 'out', text: '  bookmarks   我收藏的网站' },
  { kind: 'out', text: '  surf        随机逛一个收藏的网站' },
  { kind: 'out', text: '  city        看这个网站是怎么一步步长出来的' },
  { kind: 'out', text: '  tokens      Token 显微镜：看文字被切成哪些 token' },
  { kind: 'out', text: '  stars       文章星图：按内容远近排成一片星空' },
  { kind: 'out', text: '  music       放 / 停音乐（music rock 切风格，输 music ? 看全部）' },
  { kind: 'out', text: '  about       关于我' },
  { kind: 'out', text: '  github      去 GitHub' },
  { kind: 'out', text: '  clear       清屏' },
  { kind: 'out', text: '  （灰字是联想，按 Tab 或 → 补全；↑↓ 翻历史）' }
]

const WHOAMI: Line[] = [
  { kind: 'out', text: '休言 — 软件工程师。' },
  { kind: 'out', text: 'GitHub: github.com/inchill' }
]

function run(raw: string) {
  const cmd = raw.trim()
  print({ kind: 'cmd', text: cmd })
  if (!cmd) return

  history.push(cmd)
  hIndex = history.length

  const [name, ...args] = cmd.split(/\s+/)
  switch (name) {
    case 'help':
    case '?':
      print(...HELP)
      break
    case 'whoami':
      print(...WHOAMI)
      break
    case 'ls':
      print({ kind: 'list' })
      break
    case 'open': {
      const post = recent[Number(args[0]) - 1]
      if (post) router.go(post.url)
      else print({ kind: 'out', text: `open：序号无效，先用 ls 看看（1-${recent.length}）` })
      break
    }
    case 'cat': {
      const n = Number(args[0])
      const post = recent[n - 1]
      if (post) print({ kind: 'cat', post, n })
      else print({ kind: 'out', text: `cat：序号无效，先用 ls 看看（1-${recent.length}）` })
      break
    }
    case 'grep': {
      const kw = args.join(' ').trim().toLowerCase()
      if (!kw) {
        print({ kind: 'out', text: '用法：grep <关键词>，比如 grep mcp' })
        break
      }
      const hits = posts.filter((p) => `${p.title} ${p.excerpt}`.toLowerCase().includes(kw))
      if (hits.length) print({ kind: 'hits', items: hits.slice(0, 8) })
      else print({ kind: 'out', text: `grep：没有找到和「${kw}」相关的文章` })
      break
    }
    case 'random': {
      const post = posts[Math.floor(Math.random() * posts.length)]
      print({ kind: 'out', text: `→ 随机到：${post.title}` })
      setTimeout(() => router.go(post.url), 700)
      break
    }
    case 'theme': {
      // 复用站点的明暗切换（带圆形扩散动画），扩散中心放在终端输入行
      const r = inputEl.value?.getBoundingClientRect()
      const at = { clientX: r ? r.left + 12 : innerWidth / 2, clientY: r ? r.top + r.height / 2 : innerHeight / 2 }
      const toLight = isDark.value // 切换是异步的，先记下目标主题再打印
      if (toggleAppearance) toggleAppearance(at as MouseEvent)
      else isDark.value = !isDark.value
      print({ kind: 'out', text: `已切换到${toLight ? '亮色' : '暗色'}主题` })
      break
    }
    case 'posts':
      router.go('/posts/')
      break
    case 'notes':
      router.go('/notes/')
      break
    case 'bookmarks':
      router.go('/bookmarks/')
      break
    case 'city':
      router.go('/lab/city.html')
      break
    case 'tokens':
      router.go('/lab/tokens.html')
      break
    case 'stars':
      router.go('/lab/stars.html')
      break
    case 'surf': {
      const sites = bookmarks.groups.flatMap((g) => g.sites)
      const site = sites[Math.floor(Math.random() * sites.length)]
      if (!site) break
      print({ kind: 'out', text: `→ 随便逛逛：${site.title}（${site.host}）` })
      window.open(site.url, '_blank', 'noopener') // 必须在按键事件里同步打开，否则会被拦截
      break
    }
    case 'music': {
      const names: Record<string, string> = { lofi: 'lo-fi', 'lo-fi': 'lo-fi', ambient: '氛围', jazz: '爵士', chip: '8-bit', '8bit': '8-bit', rainy: '雨天', rain: '雨天', rock: '摇滚', folk: '民谣', synth: 'Synthwave', synthwave: 'Synthwave', guofeng: '古风', chinese: '古风', musicbox: '八音盒', box: '八音盒' }
      const ids: Record<string, string> = { 'lo-fi': 'lofi', 氛围: 'ambient', 爵士: 'jazz', '8-bit': 'chip', 雨天: 'rainy', 摇滚: 'rock', 民谣: 'folk', Synthwave: 'synth', 古风: 'guofeng', 八音盒: 'musicbox' }
      const st = args[0]?.toLowerCase()
      if (st && !names[st]) {
        print({ kind: 'out', text: '用法：music 播放 / 暂停；music lofi | ambient | jazz | chip | rainy | rock | folk | synth | guofeng | musicbox 切换风格' })
        break
      }
      const style = st ? ids[names[st]] : undefined
      window.dispatchEvent(new CustomEvent('fechuck:music', { detail: style }))
      print({ kind: 'out', text: style ? `♪ 切到「${names[st!]}」，看左下角的唱片` : '♪ 看左下角的唱片（再输一次 music 播放 / 暂停）' })
      break
    }
    case 'about':
      router.go('/about/')
      break
    case 'github':
      window.open('https://github.com/inchill', '_blank')
      break
    case 'clear':
      lines.value = []
      break
    case 'sudo':
      print({ kind: 'out', text: '休言 is not in the sudoers file. This incident will be reported.' })
      break
    default:
      print({ kind: 'out', text: `command not found: ${name}（输入 help）` })
  }
}

function onSubmit() {
  if (typing.value) return
  run(input.value)
  input.value = ''
}

function onKey(e: KeyboardEvent) {
  // 用户一动键盘，就停掉自动演示
  if (typing.value) stopDemo()

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!history.length) return
    hIndex = Math.max(0, hIndex - 1)
    input.value = history[hIndex] ?? ''
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!history.length) return
    hIndex = Math.min(history.length, hIndex + 1)
    input.value = history[hIndex] ?? ''
  } else if (e.key === 'ArrowRight') {
    // 光标在末尾时按 → 接受灰字联想
    const el = e.target as HTMLInputElement
    if (el.selectionStart === el.value.length && acceptSuggestion()) e.preventDefault()
  } else if (e.key === 'Tab') {
    // 有灰字联想时 Tab 直接接受；没有时，多个匹配就打印候选
    if (acceptSuggestion()) {
      e.preventDefault()
      return
    }
    const v = input.value.trim()
    if (!v || v.includes(' ')) return
    e.preventDefault()
    const hits = COMMANDS.filter((c) => c.startsWith(v))
    if (hits.length === 1) input.value = hits[0] + ' '
    else if (hits.length > 1) print({ kind: 'cmd', text: v }, { kind: 'out', text: hits.join('  ') })
  }
}

function focusInput() {
  if (typing.value) stopDemo()
  inputEl.value?.focus({ preventScroll: true })
}

// 2024-06-05 -> 2024.06.05
function fmt(date: string) {
  return date ? date.replaceAll('-', '.') : ''
}

// ---- 自动演示：打开页面后「自己敲」几条命令，访客一碰就停 ----
let timers: number[] = []
const wait = (ms: number) =>
  new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))

async function typeCmd(cmd: string) {
  for (const ch of cmd) {
    if (!typing.value) return
    input.value += ch
    await wait(70 + Math.random() * 60)
  }
  if (!typing.value) return
  await wait(260)
  run(input.value)
  input.value = ''
}

async function demo() {
  typing.value = true
  await wait(900)
  await typeCmd('whoami')
  await wait(700)
  await typeCmd('ls')
  if (typing.value) {
    typing.value = false
    print({ kind: 'out', text: '输入 help 查看更多命令，open 1 打开第一篇。' })
  }
}

function stopDemo() {
  typing.value = false
  timers.forEach(clearTimeout)
  timers = []
  input.value = ''
}

// ---- 按时间问候 ----
// 按访客本地时间挑一句；特殊日子优先，周末白天单独一句
function greeting(now = new Date()) {
  const m = now.getMonth() + 1
  const d = now.getDate()
  const h = now.getHours()
  const weekend = now.getDay() === 0 || now.getDay() === 6
  if (m === 10 && d === 24) return '今天是 1024 程序员节，节日快乐！'
  if (m === 1 && d === 1) return '新年快乐，愿今年的代码都一次跑通。'
  if (h < 5) return '夜深了，还在读技术文章？记得早点休息。'
  if (h < 9) return '早上好，来杯咖啡配一篇文章？'
  if (weekend && h < 22) return '周末也在学习，敬你一杯。'
  if (h < 12) return '上午好，愿你今天写的代码都没有 bug。'
  if (h < 14) return '午饭吃了吗？可以边吃边看。'
  if (h < 18) return '下午好，困了就起来走两步。'
  if (h < 22) return '晚上好，忙完一天，来这儿歇歇脚。'
  return '夜深了，看完这篇就去睡吧。'
}

// 像 macOS 终端一样的「Last login」：显示这位访客上一次打开首页的时间（只存在访客自己的浏览器里）
const LAST_KEY = 'fechuck:last-visit'
function lastLoginLine() {
  const now = Date.now()
  let prev = 0
  try {
    prev = Number(localStorage.getItem(LAST_KEY)) || 0
    localStorage.setItem(LAST_KEY, String(now))
  } catch {}
  if (!prev) return '第一次来？欢迎。输入 help 看看能做什么。'
  const t = new Date(prev)
  const wd = t.toLocaleDateString('en-US', { weekday: 'short' })
  const mon = t.toLocaleDateString('en-US', { month: 'short' })
  const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
  return `Last login: ${wd} ${mon} ${t.getDate()} ${hm} on ttys001`
}

onMounted(() => {
  print({ kind: 'out', text: lastLoginLine() }, { kind: 'hi', text: greeting() })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    run('whoami')
    run('ls')
  } else {
    demo()
  }
})

onBeforeUnmount(stopDemo)
</script>

<template>
  <div class="term" @click="focusInput">
    <div class="term-bar">
      <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
      <span class="term-title">休言 — ~/fechuck — zsh</span>
    </div>
    <div class="term-body" ref="bodyEl">
      <template v-for="(l, i) in lines" :key="i">
        <div v-if="l.kind === 'cmd'" class="row">
          <span class="prompt">➜</span><span class="path">~</span><span class="cmd">{{ l.text }}</span>
        </div>
        <div v-else-if="l.kind === 'out'" class="row out">{{ l.text }}</div>
        <div v-else-if="l.kind === 'hi'" class="row hi">{{ l.text }}</div>
        <ol v-else-if="l.kind === 'hits'" class="row list">
          <li v-for="p in l.items" :key="p.url">
            <span class="idx">›</span>
            <a :href="p.url" class="link">{{ p.title }}</a>
            <time class="date">{{ fmt(p.date) }}</time>
          </li>
        </ol>
        <div v-else-if="l.kind === 'cat'" class="row cat">
          <div class="cat-title">{{ l.post.title }}</div>
          <div class="cat-meta">{{ fmt(l.post.date) }} · 约 {{ Math.max(1, Math.round(l.post.words / 400)) }} 分钟读完</div>
          <div v-if="l.post.excerpt" class="cat-body">{{ l.post.excerpt }}</div>
          <div class="cat-hint">输入 open {{ l.n }} 阅读全文</div>
        </div>
        <ol v-else class="row list">
          <li v-for="(p, idx) in recent" :key="p.url">
            <span class="idx">{{ idx + 1 }}</span>
            <a :href="p.url" class="link">{{ p.title }}</a>
            <time class="date">{{ fmt(p.date) }}</time>
          </li>
        </ol>
      </template>

      <div class="row input-row">
        <span class="prompt">➜</span><span class="path">~</span>
        <span class="input-wrap">
        <!-- 灰字联想：一层和输入框完全重叠的文字，已输入的部分透明，只露出补全的剩余部分 -->
        <span class="ghost" aria-hidden="true"><span class="typed">{{ input }}</span>{{ ghost }}</span>
        <input
          ref="inputEl"
          v-model="input"
          class="term-input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          aria-label="终端输入"
          :readonly="typing"
          @keydown.enter="onSubmit"
          @keydown="onKey"
        />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.term {
  --term-bg: rgba(255, 255, 255, 0.72);
  --term-bar: rgba(246, 248, 249, 0.8);
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--term-bg);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  overflow: hidden;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.6) inset,
    0 30px 80px -20px rgba(16, 24, 32, 0.25),
    0 12px 30px -12px rgba(16, 24, 32, 0.12);
  cursor: text;
  text-align: left;
}
.dark .term {
  --term-bg: rgba(18, 25, 32, 0.72);
  --term-bar: rgba(24, 32, 41, 0.72);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 40px 100px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.02);
}
.term-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--term-bar);
}
.term-bar .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.2);
}
.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }

.term-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--vp-font-family-base);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.term-body {
  padding: var(--space-5);
  font-family: var(--vp-font-family-mono);
  font-size: 14.5px;
  line-height: 1.75;
  height: min(52vh, 400px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--vp-c-divider) transparent;
}
.row {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--vp-c-text-1);
}
.row.out {
  color: var(--vp-c-text-2);
}
/* 问候语：品牌绿，和提示符同色，像终端的 motd */
.row.hi {
  color: var(--stable);
  margin-bottom: 4px;
}
.prompt {
  color: var(--stable);
  margin-right: 8px;
  user-select: none;
}
.path {
  color: var(--info);
  margin-right: 10px;
  user-select: none;
}

/* ls 列表：序号 + 可点标题 + 日期 */
.list {
  list-style: none;
  margin: 2px 0;
  padding: 0;
}
.list li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 1px 0;
}
.list .idx {
  color: var(--vp-c-text-3);
  width: 1.4em;
  text-align: right;
  flex: none;
}
.list .link {
  color: var(--vp-c-text-1);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list .link:hover {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.list .date {
  margin-left: auto;
  flex: none;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

.cat {
  margin: 4px 0 6px;
  padding-left: 12px;
  border-left: 2px solid var(--vp-c-divider);
}
.cat-title {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.cat-meta,
.cat-hint {
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}
.cat-body {
  margin: 4px 0;
  color: var(--vp-c-text-2);
}

.input-row {
  display: flex;
  align-items: center;
}
.input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
}
.ghost {
  position: absolute;
  inset: 0;
  white-space: pre;
  overflow: hidden;
  color: var(--vp-c-text-3);
  opacity: 0.7;
  pointer-events: none;
}
.ghost .typed {
  visibility: hidden;
}
.term-input {
  position: relative;
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: var(--vp-c-text-1);
  caret-color: var(--stable);
  padding: 0;
}

@media (max-width: 640px) {
  .term-body {
    font-size: 12.5px;
    padding: var(--space-4);
    height: 320px;
  }
  .list .date {
    display: none;
  }
  .term-title {
    display: none;
  }
}
</style>
