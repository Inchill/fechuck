<script setup lang="ts">
// Web Vitals 心电图：实时测量你正在看的这个页面
// 绿色心跳 = 浏览器每画一帧就跳一下；主线程被卡住时心跳会停（红色平线）
// 下面三个「捣乱」实验会故意制造慢交互、布局偏移和长任务，再打开「修好它」看看区别
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { withBase } from 'vitepress'

type Rating = 'good' | 'ni' | 'poor' | 'none'
const TH = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  fcp: [1800, 3000],
  ttfb: [800, 1800]
} as const
const rate = (k: keyof typeof TH, v: number | null): Rating => (v == null ? 'none' : v <= TH[k][0] ? 'good' : v <= TH[k][1] ? 'ni' : 'poor')
const RATE_TEXT: Record<Rating, string> = { good: '良好', ni: '待改进', poor: '较差', none: '等待中' }

// ---------- 指标 ----------
const m = reactive({
  lcp: null as number | null,
  lcpEl: '',
  fcp: null as number | null,
  ttfb: null as number | null,
  cls: 0,
  inp: null as number | null,
  interactions: 0,
  longTasks: 0,
  tbt: 0,
  fps: 0,
  dropped: 0
})
const sup = reactive({ lcp: true, cls: true, inp: true, longtask: true })
const firstPath = ref('')
const here = ref('')
const blocked = ref(false)

type LogItem = { id: number; t: number; kind: 'lcp' | 'cls' | 'inp' | 'long' | 'info'; text: string }
const log = ref<LogItem[]>([])
const logEl = ref<HTMLElement>()
let logId = 0
let t0 = 0
function push(kind: LogItem['kind'], text: string, t = performance.now()) {
  // 追加到末尾而不是插到最前：往前插会把已有条目往下推，记录本身就成了布局偏移的来源
  log.value.push({ id: ++logId, t, kind, text })
  if (log.value.length > 200) log.value.splice(0, 100)
  nextTick(() => logEl.value && (logEl.value.scrollTop = logEl.value.scrollHeight))
}
const fmtT = (t: number) => (t < 0 ? '加载时' : '+' + (t / 1000).toFixed(1) + 's')

// ---------- 心电图用到的事件 ----------
const gaps: { a: number; b: number }[] = [] // 主线程卡住的时间段
const drops: number[] = [] // 掉帧（34~50ms 一帧）
const shifts: { t: number; v: number }[] = []
const taps: { t: number; d: number }[] = []
let frames: number[] = []

// CLS：按「会话窗口」累计（相隔 < 1s、窗口 < 5s 的偏移算一组，取最大的一组）
let sess = { v: 0, first: 0, last: 0 }
function addShift(v: number, t: number) {
  if (sess.v && t - sess.last < 1000 && t - sess.first < 5000) sess.v += v
  else sess = { v, first: t, last: t }
  sess.last = t
  m.cls = Math.max(m.cls, sess.v)
}

// INP：每次交互取耗时最长的那个事件；交互少于 50 次时取最大值，多了取第 98 百分位
const inter = new Map<number, number>()
// 实验是故意把页面弄坏，它们造成的慢交互、长任务、布局偏移不算进页面自己的成绩
const expIds = new Set<number>()
const expSpans: { a: number; b: number }[] = []
const exps = ref<HTMLElement>()
const inExp = (t: number) => expSpans.some((x) => t >= x.a && t <= x.b)
function markExp(ms: number) {
  const now = performance.now()
  expSpans.push({ a: now - 400, b: now + ms }) // 往前多留一点：按下（pointerdown）发生在点击回调之前
}
const isExpTarget = (el: Element | null | undefined) => !!(el && exps.value?.contains(el))
let pendingIds = new Set<number>()
let flushTimer = 0
const lastTap = ref<{ d: number; at: number } | null>(null)
function calcInp() {
  const all = [...inter.entries()]
    .filter(([id]) => !expIds.has(id))
    .map(([, d]) => d)
    .sort((a, b) => b - a)
  m.interactions = all.length
  m.inp = all.length ? all[Math.min(all.length - 1, Math.floor(all.length / 50))] : null
}
function flushTaps() {
  for (const id of pendingIds) {
    const d = inter.get(id)!
    push('inp', `${expIds.has(id) ? '实验里的' : '一次'}交互，从按下到画出下一帧用了 ${Math.round(d)}ms`)
    lastTap.value = { d, at: performance.now() }
  }
  pendingIds = new Set()
  calcInp()
}

const observers: PerformanceObserver[] = []
function observe(type: string, cb: (list: PerformanceObserverEntryList) => void, opts: Record<string, unknown> = {}) {
  if (!(PerformanceObserver.supportedEntryTypes || []).includes(type)) return false
  const o = new PerformanceObserver(cb)
  o.observe({ type, buffered: true, ...opts } as PerformanceObserverInit)
  observers.push(o)
  return true
}

function describe(el: Element | null | undefined) {
  if (!el) return ''
  const tag = el.tagName.toLowerCase()
  const txt = (el.textContent || '').trim().slice(0, 14)
  return tag === 'img' ? '一张图片' : txt ? `<${tag}>「${txt}${(el.textContent || '').trim().length > 14 ? '…' : ''}」` : `<${tag}>`
}

function setupObservers() {
  // 页面打开时如果在后台标签页，浏览器要等切过来才会绘制，LCP、FCP 会被拉得很长
  const vis = performance.getEntriesByType('visibility-state') as PerformanceEntry[]
  openedHidden.value = vis.some((e) => e.name === 'hidden' && e.startTime < 1000)
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (nav) {
    m.ttfb = Math.max(0, nav.responseStart)
    try {
      firstPath.value = decodeURI(new URL(nav.name).pathname)
    } catch {}
  }
  observe('paint', (l) => {
    for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') m.fcp = e.startTime
  })
  sup.lcp = observe('largest-contentful-paint', (l) => {
    const es = l.getEntries() as any[]
    const e = es[es.length - 1]
    if (!e) return
    m.lcp = e.startTime
    m.lcpEl = describe(e.element)
  })
  sup.cls = observe('layout-shift', (l) => {
    for (const e of l.getEntries() as any[]) {
      if (e.hadRecentInput) continue
      const ex = inExp(e.startTime)
      if (!ex) addShift(e.value, e.startTime)
      if (e.startTime > t0 && e.value >= 0.0005) {
        shifts.push({ t: e.startTime, v: e.value })
        push('cls', `${ex ? '实验里的' : ''}布局偏移 +${e.value.toFixed(3)}，内容被推动了`, e.startTime)
      }
    }
  })
  sup.inp = observe(
    'event',
    (l) => {
      for (const e of l.getEntries() as any[]) {
        if (!e.interactionId) continue
        if (isExpTarget(e.target) || inExp(e.startTime)) expIds.add(e.interactionId)
        const prev = inter.get(e.interactionId) ?? 0
        if (e.duration > prev) inter.set(e.interactionId, e.duration)
        if (e.startTime > t0) {
          pendingIds.add(e.interactionId)
          if (e.duration > prev) {
            const old = taps.find((x) => Math.abs(x.t - e.startTime) < 300)
            if (old) old.d = Math.max(old.d, e.duration)
            else taps.push({ t: e.startTime, d: e.duration })
          }
        }
      }
      clearTimeout(flushTimer)
      flushTimer = window.setTimeout(flushTaps, 80)
      calcInp()
    },
    { durationThreshold: 16 }
  )
  observe('first-input', (l) => {
    for (const e of l.getEntries() as any[]) if (e.interactionId && !inter.has(e.interactionId)) inter.set(e.interactionId, e.duration)
    calcInp()
  })
  sup.longtask = observe('longtask', (l) => {
    for (const e of l.getEntries()) {
      const ex = inExp(e.startTime)
      if (!ex) {
        m.longTasks++
        m.tbt += Math.max(0, e.duration - 50)
      }
      if (e.startTime > t0) push('long', `${ex ? '实验里的' : ''}长任务 ${Math.round(e.duration)}ms，这段时间页面不响应任何操作`, e.startTime)
    }
  })
}

// ---------- 心电图 ----------
const canvas = ref<HTMLCanvasElement>()
const miniCanvas = ref<HTMLCanvasElement>()
const wrap = ref<HTMLElement>()
let raf = 0
let lastFrame = 0
let hiddenAt = 0
let dpr = 1
// 两块画布：页面上的大心电图，和滚下去以后吸顶的迷你心电图
type Surf = { el?: HTMLCanvasElement; W: number; H: number; win: number; mini: boolean }
const big: Surf = { W: 0, H: 0, win: 6000, mini: false }
const mini: Surf = { W: 0, H: 0, win: 4000, mini: true }
const KEEP = 6500 // 数据保留最近几秒
const PERIOD = 800
let colors = { grid: '', grid2: '', line: '', bad: '', warn: '', info: '', text: '', glow: '' }
function readColors() {
  const cs = getComputedStyle(wrap.value!)
  const g = (n: string) => cs.getPropertyValue(n).trim()
  colors = { grid: g('--ecg-grid'), grid2: g('--ecg-grid-2'), line: g('--ecg-line'), bad: g('--bad'), warn: g('--warn'), info: g('--ecg-info'), text: g('--ecg-text'), glow: g('--ecg-glow') }
}
function fit(s: Surf) {
  const c = s.el
  if (!c) return
  const r = c.getBoundingClientRect()
  dpr = Math.min(2, window.devicePixelRatio || 1)
  s.W = r.width
  s.H = r.height
  // 窄屏显示的时间短一些，心跳不会挤在一起
  s.win = s.mini ? (s.W < 400 ? 2500 : 4000) : s.W < 640 ? 3500 : 6000
  c.width = Math.round(s.W * dpr)
  c.height = Math.round(s.H * dpr)
}
function resize() {
  fit(big)
  fit(mini)
}

// 一次心跳的波形（P 波、QRS 波群、T 波），p 是 0~1 的相位
function beat(p: number) {
  if (p > 0.1 && p < 0.18) return 0.1 * Math.sin((Math.PI * (p - 0.1)) / 0.08)
  if (p >= 0.25 && p < 0.27) return (-0.14 * (p - 0.25)) / 0.02
  if (p >= 0.27 && p < 0.29) return -0.14 + (1.14 * (p - 0.27)) / 0.02
  if (p >= 0.29 && p < 0.31) return 1 - (1.28 * (p - 0.29)) / 0.02
  if (p >= 0.31 && p < 0.34) return -0.28 + (0.28 * (p - 0.31)) / 0.03
  if (p > 0.5 && p < 0.64) return 0.2 * Math.sin((Math.PI * (p - 0.5)) / 0.14)
  return 0
}
const inGap = (t: number) => gaps.some((g) => t > g.a && t < g.b)
// 一次心跳里要取的相位点：波形的每个拐点都在里面，P 波、T 波这两段圆弧多取几个点
const PHASES = (() => {
  const p: number[] = [0, 0.25, 0.27, 0.29, 0.31, 0.34]
  for (let i = 0; i <= 10; i++) p.push(0.1 + (0.08 * i) / 10, 0.5 + (0.14 * i) / 10)
  return [...new Set(p)].sort((a, b) => a - b)
})()

function draw(s: Surf, now: number) {
  const c = s.el
  const { W, H, win: WINDOW, mini: sm } = s
  if (!c || !W) return
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const pad = sm ? 8 : 24
  const x = (t: number) => W - ((now - t) / WINDOW) * (W - pad) - pad
  const base = H * (sm ? 0.66 : 0.62)
  const amp = H * (sm ? 0.56 : 0.42)

  // 网格（心电图纸）；迷你图只画细格
  ctx.lineWidth = 1
  for (let gx = 0; gx <= W && !sm; gx += 12) {
    ctx.strokeStyle = gx % 60 === 0 ? colors.grid2 : colors.grid
    ctx.beginPath()
    ctx.moveTo(gx + 0.5, 0)
    ctx.lineTo(gx + 0.5, H)
    ctx.stroke()
  }
  for (let gy = 0; gy <= H && !sm; gy += 12) {
    ctx.strokeStyle = gy % 60 === 0 ? colors.grid2 : colors.grid
    ctx.beginPath()
    ctx.moveTo(0, gy + 0.5)
    ctx.lineTo(W, gy + 0.5)
    ctx.stroke()
  }

  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textBaseline = 'top'

  // 卡住的时间段：红色底 + 标注
  for (const g of gaps) {
    const a = x(g.a)
    const b = x(g.b)
    if (b < 0) continue
    ctx.fillStyle = colors.bad
    ctx.globalAlpha = 0.1
    ctx.fillRect(a, 0, b - a, H)
    ctx.globalAlpha = 1
    const label = sm ? `${Math.round(g.b - g.a)}ms` : `卡住 ${Math.round(g.b - g.a)}ms`
    ctx.fillStyle = colors.bad
    ctx.fillText(label, Math.max(4, (a + b) / 2 - ctx.measureText(label).width / 2), sm ? 2 : 8)
  }
  // 掉帧
  ctx.fillStyle = colors.warn
  for (const t of drops) {
    const px = x(t)
    if (px > 0) ctx.fillRect(px - 1, H - (sm ? 4 : 8), 2, sm ? 3 : 6)
  }
  // 布局偏移
  ctx.setLineDash([3, 3])
  for (const sh of shifts) {
    const px = x(sh.t)
    if (px < 0) continue
    ctx.strokeStyle = colors.warn
    ctx.beginPath()
    ctx.moveTo(px + 0.5, sm ? 0 : 22)
    ctx.lineTo(px + 0.5, H)
    ctx.stroke()
    if (sm) continue
    ctx.fillStyle = colors.warn
    ctx.fillText(`CLS +${sh.v.toFixed(3)}`, px + 4, 24)
  }
  ctx.setLineDash([])
  // 交互：底部一条蓝色的耗时条
  for (const tp of taps) {
    const a = x(tp.t)
    const b = x(tp.t + tp.d)
    if (b < 0) continue
    ctx.fillStyle = colors.info
    ctx.globalAlpha = 0.85
    ctx.fillRect(a, H - (sm ? 4 : 20), Math.max(2, b - a), sm ? 3 : 4)
    ctx.globalAlpha = 1
    if (!sm) ctx.fillText(`交互 ${Math.round(tp.d)}ms`, a, H - 36)
  }

  // 心跳曲线：正常一段用主色，卡住的一段画成红色平线
  // 按「时间」取点而不是按像素取点：波峰的时刻是固定的，每一帧都会正好画到峰顶，
  // 否则按像素采样时，峰顶有时被采到、有时被跳过，高度会一帧一帧地跳（看着就是峰顶在闪）
  const tA = Math.max(t0, now - WINDOW)
  const ts: number[] = [tA, now]
  for (let k = Math.floor(tA / PERIOD); k * PERIOD <= now; k++)
    for (const ph of PHASES) {
      const t = (k + ph) * PERIOD
      if (t > tA && t < now) ts.push(t)
    }
  for (const g of gaps) for (const t of [g.a, g.b]) if (t > tA && t < now) ts.push(t)
  ts.sort((a, b) => a - b)
  const inGapIn = (t: number) => gaps.some((g) => t >= g.a && t <= g.b)
  let mode = -1
  ctx.lineWidth = sm ? 1.5 : 2
  ctx.lineJoin = 'round'
  let lx = 0
  let ly = base
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    const px = x(t)
    const y = inGapIn(t) ? base : base - amp * beat((((t % PERIOD) + PERIOD) % PERIOD) / PERIOD)
    // 这一小段算不算「卡住」，看它和上一个点的中点
    const g = i === 0 ? (inGap(t) ? 1 : 0) : inGap((t + ts[i - 1]) / 2) ? 1 : 0
    if (g !== mode) {
      if (mode !== -1) ctx.stroke()
      ctx.beginPath()
      ctx.strokeStyle = g ? colors.bad : colors.line
      ctx.shadowColor = g ? 'transparent' : colors.glow
      ctx.shadowBlur = g ? 0 : sm ? 4 : 8
      ctx.moveTo(mode === -1 ? px : lx, mode === -1 ? y : ly)
      mode = g
    }
    ctx.lineTo(px, y)
    lx = px
    ly = y
  }
  if (mode !== -1) ctx.stroke()
  ctx.shadowBlur = 0
  // 最前端的亮点
  ctx.fillStyle = colors.line
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(lx, ly, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

let colorTick = 0
let fpsAt = 0
// 大心电图滚出屏幕后，顶部浮出一条迷你心电图，在下面点按钮也能看到心跳
const showMini = ref(false)
let bigVisible = true
let io: IntersectionObserver | undefined
function loop(now: number) {
  if (lastFrame && !hiddenAt) {
    const dt = now - lastFrame
    if (dt > 50) {
      gaps.push({ a: lastFrame, b: now })
      if (!sup.longtask) push('long', `主线程卡住了 ${Math.round(dt)}ms`, lastFrame)
    } else if (dt > 34) {
      drops.push(now)
      m.dropped++
    }
  }
  hiddenAt = 0
  lastFrame = now
  frames.push(now)
  while (frames.length && now - frames[0] > 1000) frames.shift()
  // 帧率每半秒刷新一次：每帧都改的话 59 / 60 / 61 来回跳，看着一直在闪
  if (now - fpsAt > 500) {
    m.fps = frames.length
    fpsAt = now
  }
  blocked.value = false
  // 只保留窗口里的数据
  const old = now - KEEP
  while (gaps.length && gaps[0].b < old) gaps.shift()
  while (drops.length && drops[0] < old) drops.shift()
  while (shifts.length && shifts[0].t < old) shifts.shift()
  while (taps.length && taps[0].t + taps[0].d < old) taps.shift()
  if (colorTick++ % 30 === 0) readColors()
  if (bigVisible) draw(big, now)
  if (showMini.value) draw(mini, now)
  raf = requestAnimationFrame(loop)
}
function onVis() {
  if (document.hidden) hiddenAt = performance.now()
}

// ---------- 捣乱实验 ----------
const block = (ms: number) => {
  const end = performance.now() + ms
  while (performance.now() < end) Math.sqrt(Math.random())
}
const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0))
const afterPaint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))
const maxGapSince = (t: number) => {
  let mx = 0
  for (const g of gaps) if (g.b > t) mx = Math.max(mx, g.b - g.a)
  return mx
}

const fix = reactive({ inp: false, cls: false, long: false })
const res = reactive({ inp: '', cls: '', long: '' })
const busy = reactive({ inp: false, long: false })
const progress = ref(0)
const btnText = ref('点我')

// 1. 慢点击
let waitTap = 0
async function slowClick() {
  waitTap = performance.now()
  markExp(1500)
  res.inp = '测量中…'
  if (!fix.inp) {
    block(300) // 同步算完才更新界面：这 300ms 里浏览器画不出下一帧
    btnText.value = '算完了'
  } else {
    btnText.value = '处理中…' // 先把反馈画出来
    busy.inp = true
    await afterPaint()
    for (let i = 0; i < 30; i++) {
      block(10)
      await yieldNow()
    }
    busy.inp = false
    btnText.value = '算完了'
  }
  setTimeout(() => (btnText.value = '点我'), 1600)
  setTimeout(() => {
    if (!sup.inp) return (res.inp = '当前浏览器测不到交互耗时（目前只有 Chromium 内核支持）')
    const lt = lastTap.value
    if (!lt || lt.at < waitTap) return (res.inp = '没测到这次交互，再点一次试试')
    const r = rate('inp', lt.d)
    res.inp = `这次交互用了 ${Math.round(lt.d)}ms · ${RATE_TEXT[r]}` + (fix.inp ? '，计算在后台分 30 次做完' : '')
  }, 700)
}

// 2. 晚到的广告
const ad = ref(false)
const adLoading = ref(false)
const fakeEl = ref<HTMLElement>()
function loadAd() {
  if (ad.value) {
    ad.value = false
    res.cls = ''
    return
  }
  adLoading.value = true
  markExp(1600)
  res.cls = '广告加载中…'
  const n = shifts.length
  const before = m.cls
  const y0 = fakeEl.value?.getBoundingClientRect().top ?? 0
  // 等 600ms 再插入：用户操作后 500ms 内的偏移不算进 CLS，真实的广告也往往是这样「晚到」的
  setTimeout(() => {
    ad.value = true
    adLoading.value = false
    setTimeout(() => {
      if (!sup.cls) return (res.cls = '当前浏览器测不到布局偏移（目前只有 Chromium 内核支持）')
      const v = shifts.slice(n).reduce((s, x) => s + x.v, 0) || (m.cls > before ? m.cls - before : 0)
      const dy = Math.round((fakeEl.value?.getBoundingClientRect().top ?? 0) - y0)
      res.cls = v > 0.0001 ? `内容被推下去 ${dy}px，偏移 ${v.toFixed(3)}。占的屏幕越大、推得越远，分数越高` : '没有发生布局偏移，下面的内容一动没动'
    }, 400)
  }, 600)
}
function toggleFixCls() {
  fix.cls = !fix.cls
  ad.value = false
  res.cls = ''
}

// 3. 长任务
async function longTask() {
  const t = performance.now()
  markExp(fix.long ? 1500 : 1000)
  busy.long = true
  progress.value = 0
  res.long = '计算中…'
  await afterPaint()
  if (!fix.long) {
    await new Promise((r) => setTimeout(r, 120))
    block(400) // 一口气算完：主线程被占满，心跳停了
    progress.value = 1
  } else {
    for (let i = 0; i < 50; i++) {
      block(8) // 每算 8ms 就让出主线程
      progress.value = (i + 1) / 50
      await yieldNow()
    }
  }
  await afterPaint()
  await new Promise((r) => setTimeout(r, 150)) // 等心电图把这段时间记下来
  busy.long = false
  const g = maxGapSince(t)
  res.long = g > 50 ? `主线程最长卡住 ${Math.round(g)}ms，心跳停了` : '最长一帧也没超过 50ms，心跳一直没停'
}

function reset() {
  sess = { v: 0, first: 0, last: 0 }
  m.cls = 0
  inter.clear()
  expIds.clear()
  calcInp()
  m.longTasks = 0
  m.tbt = 0
  m.dropped = 0
  log.value = []
  gaps.length = drops.length = shifts.length = taps.length = 0
  for (const k of ['inp', 'cls', 'long'] as const) res[k] = ''
  push('info', '已重置交互类指标（加载类指标只在页面打开时测一次）')
}

// ---------- 展示 ----------
const fmtMs = (v: number | null) => (v == null ? '—' : v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms')
const core = computed(() => [
  {
    k: 'lcp' as const,
    name: 'LCP',
    full: '最大内容绘制',
    q: '主要内容多久出现？',
    val: fmtMs(m.lcp),
    r: sup.lcp ? rate('lcp', m.lcp) : 'none',
    pos: m.lcp == null ? null : Math.min(1, m.lcp / 6000),
    th: [2500 / 6000, 4000 / 6000],
    note: !sup.lcp ? '当前浏览器不支持' : m.lcpEl ? '最大的元素是 ' + m.lcpEl : '页面打开时测一次'
  },
  {
    k: 'cls' as const,
    name: 'CLS',
    full: '累积布局偏移',
    q: '内容会不会乱跳？',
    val: sup.cls ? m.cls.toFixed(3) : '—',
    r: sup.cls ? rate('cls', m.cls) : 'none',
    pos: sup.cls ? Math.min(1, m.cls / 0.5) : null,
    th: [0.1 / 0.5, 0.25 / 0.5],
    note: !sup.cls ? '当前浏览器不支持' : '一直在累计，取跳得最厉害的一段'
  },
  {
    k: 'inp' as const,
    name: 'INP',
    full: '交互到下一次绘制',
    q: '点了多久才有反应？',
    val: fmtMs(m.inp),
    r: sup.inp ? rate('inp', m.inp) : 'none',
    pos: m.inp == null ? null : Math.min(1, m.inp / 800),
    th: [200 / 800, 500 / 800],
    note: !sup.inp ? '当前浏览器不支持' : m.interactions ? `已记录 ${m.interactions} 次交互，实验里的不算` : '点一下页面上的任何东西'
  }
])
const minor = computed(() => [
  { name: 'FCP', full: '首次内容绘制', val: fmtMs(m.fcp), r: rate('fcp', m.fcp) },
  { name: 'TTFB', full: '首字节时间', val: fmtMs(m.ttfb), r: rate('ttfb', m.ttfb) },
  { name: '长任务', full: sup.longtask ? `阻塞 ${Math.round(m.tbt)}ms` : '当前浏览器不支持', val: sup.longtask ? String(m.longTasks) : '—', r: 'none' as Rating },
  { name: '帧率', full: `掉帧 ${m.dropped} 次`, val: m.fps ? m.fps + ' fps' : '—', r: 'none' as Rating }
])
const isDev = import.meta.env.DEV
const openedHidden = ref(false)
const otherPage = computed(() => firstPath.value && here.value && firstPath.value.replace(/\.html$|\/$/, '') !== here.value.replace(/\.html$|\/$/, ''))

let ro: ResizeObserver | undefined
onMounted(async () => {
  t0 = performance.now()
  here.value = decodeURI(location.pathname)
  setupObservers()
  await nextTick()
  readColors()
  big.el = canvas.value
  mini.el = miniCanvas.value
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(canvas.value!)
  ro.observe(miniCanvas.value!)
  io = new IntersectionObserver(
    ([e]) => {
      bigVisible = e.isIntersecting
      // 只在往下滚、心电图已经在上方时出现
      showMini.value = !e.isIntersecting && e.boundingClientRect.top < 0
      if (showMini.value) nextTick(() => fit(mini))
    },
    { rootMargin: '-64px 0px 0px 0px' }
  )
  io.observe(wrap.value!)
  document.addEventListener('visibilitychange', onVis)
  raf = requestAnimationFrame(loop)
  push('info', '开始监测。点点按钮、滚动页面，看看心电图怎么变')
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(flushTimer)
  observers.forEach((o) => o.disconnect())
  ro?.disconnect()
  io?.disconnect()
  document.removeEventListener('visibilitychange', onVis)
})
</script>

<template>
  <div class="vm">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M1 8.5h3l1.5-3 2.5 7 2-5.5 1.2 1.5H15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <a :href="withBase('/lab/')">LAB</a> <i>/</i> Web Vitals 心电图
      </div>
      <h1 class="headline">这个页面，<span class="grad">现在感觉怎么样？</span></h1>
      <p class="sub">实时测量你正在看的这一页：主要内容多久出现、会不会乱跳、点了多久才有反应。下面几个按钮会故意把它弄坏，再教你怎么修好。</p>
    </header>

    <!-- 心电图 -->
    <section ref="wrap" class="monitor">
      <div class="mon-head">
        <span class="live"><i></i>LIVE</span>
        <span class="mon-title">主线程心跳</span>
        <span class="mon-fps"><b>{{ m.fps || '—' }}</b> fps</span>
      </div>
      <canvas ref="canvas" class="ecg" aria-label="主线程心跳的实时曲线"></canvas>
      <div class="legend">
        <span><i class="lg-line"></i>每一次跳动：浏览器在正常出帧</span>
        <span><i class="lg-bad"></i>红色平线：主线程被卡住</span>
        <span><i class="lg-warn"></i>黄线：布局偏移</span>
        <span><i class="lg-info"></i>蓝条：一次交互的耗时</span>
      </div>
    </section>

    <!-- 滚下去以后吸顶的迷你心电图 -->
    <div class="mini-mon" :class="{ on: showMini }" :aria-hidden="!showMini">
      <span class="live"><i></i></span>
      <canvas ref="miniCanvas" class="mini-ecg"></canvas>
      <span v-for="c in core.slice(1)" :key="c.k" class="mm" :class="'r-' + c.r"><em>{{ c.name }}</em>{{ c.val }}</span>
      <span class="mm fps"><em>FPS</em>{{ m.fps || '—' }}</span>
    </div>

    <!-- 三个核心指标 -->
    <section class="core">
      <article v-for="c in core" :key="c.k" class="metric" :class="'r-' + c.r">
        <div class="mt-head">
          <span class="mt-name">{{ c.name }}</span>
          <span class="mt-full">{{ c.full }}</span>
          <span class="badge">{{ RATE_TEXT[c.r] }}</span>
        </div>
        <div class="mt-val">{{ c.val }}</div>
        <div class="mt-q">{{ c.q }}</div>
        <div class="gauge" aria-hidden="true">
          <span class="z good" :style="{ width: c.th[0] * 100 + '%' }"></span>
          <span class="z ni" :style="{ width: (c.th[1] - c.th[0]) * 100 + '%' }"></span>
          <span class="z poor" :style="{ width: (1 - c.th[1]) * 100 + '%' }"></span>
          <span v-if="c.pos != null" class="needle" :style="{ left: c.pos * 100 + '%' }"></span>
        </div>
        <div class="mt-note">{{ c.note }}</div>
      </article>
    </section>
    <section class="minor">
      <div v-for="x in minor" :key="x.name" class="mini" :class="'r-' + x.r">
        <span class="mini-name">{{ x.name }}</span>
        <b>{{ x.val }}</b>
        <span class="mini-full">{{ x.full }}</span>
      </div>
    </section>
    <p v-if="isDev" class="hint">现在是本地开发模式：代码没有打包压缩，几百个模块一个个加载，LCP、FCP 和长任务都会比线上差很多，线上版本的数据才有参考价值。</p>
    <p v-if="openedHidden" class="hint">这个页面是在后台标签页里打开的，浏览器要等你切过来才开始绘制，所以 LCP、FCP 偏大，刷新一下再看。</p>
    <p v-if="otherPage" class="hint">LCP、FCP、TTFB 只在页面刚打开时测一次。你是从 <code>{{ firstPath }}</code> 打开网站的，所以这几项是那一页的数据；刷新这一页就能看到它自己的。</p>

    <!-- 捣乱实验 -->
    <h2 class="sec">动手捣乱</h2>
    <p class="sec-sub">每个实验先按一下看看坏的样子，再打开「修好它」对比。</p>
    <section ref="exps" class="exps">
      <article class="exp">
        <div class="ex-head"><span class="ex-n">01</span><h3>慢吞吞的按钮</h3><span class="ex-tag">INP</span></div>
        <p class="ex-desc">{{ fix.inp ? '先把「处理中」画到屏幕上，再把计算拆成 30 小块分批做。' : '点击后先同步算 300ms 再更新界面，这段时间浏览器画不出下一帧。' }}</p>
        <div class="ex-ctrl">
          <button type="button" class="go" :class="{ busy: busy.inp }" @click="slowClick">{{ btnText }}</button>
          <button type="button" class="sw" role="switch" :aria-checked="fix.inp" @click="(fix.inp = !fix.inp), (res.inp = '')"><i></i>修好它</button>
        </div>
        <p class="ex-res" :class="{ show: res.inp }">{{ res.inp || ' ' }}</p>
      </article>

      <article class="exp">
        <div class="ex-head"><span class="ex-n">02</span><h3>晚到的广告</h3><span class="ex-tag">CLS</span></div>
        <p class="ex-desc">{{ fix.cls ? '提前给广告留好位置，加载完直接填进去，下面的内容不用动。' : '广告 0.6 秒后才加载出来，把下面的内容整体往下推。' }}</p>
        <div class="ex-ctrl">
          <button type="button" class="go" :disabled="adLoading" @click="loadAd">{{ ad ? '收起广告' : adLoading ? '加载中…' : '加载广告' }}</button>
          <button type="button" class="sw" role="switch" :aria-checked="fix.cls" @click="toggleFixCls"><i></i>修好它</button>
        </div>
        <div class="stage">
          <div v-if="ad || fix.cls" class="ad" :class="{ ph: !ad }">{{ ad ? '广告 · 我是晚到的那块内容' : '广告位 · 已预留' }}</div>
          <div ref="fakeEl" class="fake">
            <b></b>
            <i></i><i></i><i></i><i class="s"></i>
          </div>
        </div>
        <p class="ex-res" :class="{ show: res.cls }">{{ res.cls || ' ' }}</p>
      </article>

      <article class="exp">
        <div class="ex-head"><span class="ex-n">03</span><h3>一口气算完</h3><span class="ex-tag">长任务</span></div>
        <p class="ex-desc">{{ fix.long ? '每算 8ms 就让出一次主线程，浏览器可以照常出帧、响应点击。' : '一口气算 400ms，主线程被占满，心电图上的心跳会停。' }}</p>
        <div class="ex-ctrl">
          <button type="button" class="go" :disabled="busy.long" @click="longTask">{{ busy.long ? '计算中…' : '开始计算' }}</button>
          <button type="button" class="sw" role="switch" :aria-checked="fix.long" @click="(fix.long = !fix.long), (res.long = '')"><i></i>修好它</button>
        </div>
        <div class="bar"><span :style="{ transform: `scaleX(${progress})` }"></span></div>
        <p class="ex-res" :class="{ show: res.long }">{{ res.long || ' ' }}</p>
      </article>
    </section>

    <!-- 事件记录 -->
    <div class="log-head">
      <h2 class="sec">事件记录</h2>
      <button type="button" class="reset" @click="reset">重置</button>
    </div>
    <ol ref="logEl" class="log">
      <li v-for="it in log" :key="it.id" :class="'k-' + it.kind">
        <time>{{ fmtT(it.t - t0) }}</time>
        <i></i>
        <span>{{ it.text }}</span>
      </li>
    </ol>

    <p class="foot">
      数据来自浏览器自带的 PerformanceObserver，算法和 Google 的 web-vitals 一致，没有上报到任何地方。LCP、CLS、INP 目前只有 Chromium 内核的浏览器支持。想了解 LCP 是怎么测的，可以看
      <a :href="withBase('/2024/lcp.html')">《前端性能监控指标之 LCP》</a>。
    </p>
  </div>
</template>

<style scoped>
.vm {
  --good: var(--stable);
  --warn: #c98a1a;
  --bad: #d64545;
  --ecg-grid: rgba(214, 69, 69, 0.07);
  --ecg-grid-2: rgba(214, 69, 69, 0.15);
  --ecg-line: #147a5a;
  --ecg-glow: rgba(20, 122, 90, 0.35);
  --ecg-info: #1f6fb2;
  --ecg-text: #55666e;
  --ecg-bg: #fdfbfa;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}
.dark .vm {
  --warn: #f0b45a;
  --bad: #ff6b6b;
  --ecg-grid: rgba(61, 220, 154, 0.06);
  --ecg-grid-2: rgba(61, 220, 154, 0.13);
  --ecg-line: #3ddc9a;
  --ecg-glow: rgba(61, 220, 154, 0.7);
  --ecg-info: #6cb6f5;
  --ecg-text: #93a5b1;
  --ecg-bg: #070b0f;
}

/* ---------- 头部 ---------- */
.hero {
  position: relative;
  padding: clamp(48px, 9vh, 96px) 0 0;
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
  max-width: 640px;
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.1rem);
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

/* ---------- 心电图 ---------- */
.monitor {
  margin-top: 48px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--ecg-bg);
  overflow: hidden;
}
.mon-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 0.1em;
  color: var(--bad);
}
.live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bad);
  /* 缓慢「呼吸」，不要明暗快闪 */
  animation: breathe 2.4s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    opacity: 0.45;
  }
}
.mon-title {
  color: var(--vp-c-text-2);
}
.mon-fps {
  margin-left: auto;
  color: var(--vp-c-text-3);
}
.mon-fps b {
  display: inline-block;
  min-width: 2ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 16px;
  font-weight: 600;
  color: var(--ecg-line);
}
.ecg {
  display: block;
  width: 100%;
  height: 220px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 12px 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend i {
  display: inline-block;
  width: 14px;
  height: 2px;
  border-radius: 2px;
}
.lg-line {
  background: var(--ecg-line);
}
.lg-bad {
  background: var(--bad);
}
.lg-warn {
  background: repeating-linear-gradient(90deg, var(--warn) 0 3px, transparent 3px 6px);
}
.lg-info {
  height: 4px !important;
  background: var(--ecg-info);
}

/* ---------- 吸顶的迷你心电图 ---------- */
.mini-mon {
  position: fixed;
  top: calc(var(--vp-nav-height, 64px) + 12px);
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(720px, calc(100vw - 32px));
  height: 52px;
  padding: 0 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ecg-bg) 82%, transparent);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  box-shadow: 0 12px 32px -16px rgba(16, 24, 32, 0.35);
  opacity: 0;
  transform: translate(-50%, -12px) scale(0.98);
  pointer-events: none;
  transition:
    opacity 300ms var(--ease-out),
    transform 400ms var(--ease-out);
}
.mini-mon.on {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}
.mini-ecg {
  flex: 1;
  min-width: 0;
  height: 36px;
}
.mm {
  --c: var(--vp-c-text-1);
  display: grid;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: var(--c);
  white-space: nowrap;
}
.mm em {
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}
.mm.fps {
  color: var(--ecg-line);
}
@media (max-width: 640px) {
  .mini-mon {
    gap: 10px;
    padding: 0 14px;
  }
  .mm.fps {
    display: none;
  }
}

/* ---------- 指标 ---------- */
.core {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.metric {
  --c: var(--vp-c-text-3);
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-alt);
}
.r-good {
  --c: var(--good);
}
.r-ni {
  --c: var(--warn);
}
.r-poor {
  --c: var(--bad);
}
.mt-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mt-name {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.mt-full {
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c) 14%, transparent);
  font-size: 12px;
  font-weight: 500;
  color: var(--c);
}
.mt-val {
  margin-top: 16px;
  font-size: 2.2rem;
  font-weight: 650;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--c);
  transition: color var(--dur-base) var(--ease-out);
}
.r-none .mt-val {
  color: var(--vp-c-text-3);
}
.mt-q {
  margin-top: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.gauge {
  position: relative;
  display: flex;
  gap: 2px;
  height: 4px;
  margin-top: 16px;
}
.z {
  height: 100%;
  border-radius: 2px;
  opacity: 0.35;
}
.z.good {
  background: var(--good);
}
.z.ni {
  background: var(--warn);
}
.z.poor {
  background: var(--bad);
}
.needle {
  position: absolute;
  top: -4px;
  width: 4px;
  height: 12px;
  margin-left: -2px;
  border-radius: 2px;
  background: var(--c);
  box-shadow: 0 0 0 2px var(--vp-c-bg-alt);
  transition: left 600ms var(--ease-out);
}
.mt-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.minor {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.mini {
  --c: var(--vp-c-text-1);
  display: grid;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
}
.mini.r-good {
  --c: var(--good);
}
.mini.r-ni {
  --c: var(--warn);
}
.mini.r-poor {
  --c: var(--bad);
}
.mini-name {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.mini b {
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--c);
}
.mini-full {
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.hint {
  margin: 16px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}
.hint code {
  font-size: 12px;
}

/* ---------- 实验 ---------- */
.sec {
  margin: 64px 0 0;
  padding: 0;
  border: 0;
  font-size: 1.5rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.sec-sub {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.exps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 24px;
  align-items: start;
}
.exp {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-alt);
}
.ex-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ex-n {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.ex-head h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--vp-c-text-1);
}
.ex-tag {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-brand-1);
}
.ex-desc {
  min-height: 48px;
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.ex-ctrl {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.go {
  min-width: 96px;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-bg);
  transition:
    opacity var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
.go:hover {
  opacity: 0.85;
}
.go:active {
  transform: scale(0.97);
}
.go:disabled,
.go.busy {
  opacity: 0.5;
  cursor: progress;
}
.sw {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.sw i {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  transition: background-color var(--dur-base) var(--ease-out);
}
.sw i::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform var(--dur-base) var(--ease-out);
}
.sw[aria-checked='true'] {
  color: var(--good);
}
.sw[aria-checked='true'] i {
  background: var(--good);
}
.sw[aria-checked='true'] i::after {
  transform: translateX(16px);
}
.ex-res {
  /* 预留两行：结果文字出现时不能把下面的内容推开，否则实验本身就制造了布局偏移 */
  min-height: 42px;
  line-height: 1.6;
  margin: 12px 0 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.ex-res.show {
  opacity: 1;
}
.stage {
  margin-top: 16px;
  padding: 12px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 12px;
}
.ad {
  display: grid;
  place-items: center;
  height: 96px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--warn) 22%, transparent), color-mix(in srgb, var(--bad) 16%, transparent));
  font-size: 12px;
  color: var(--vp-c-text-1);
}
.ad.ph {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-3);
}
.fake {
  display: grid;
  gap: 8px;
}
.fake b,
.fake i {
  display: block;
  height: 8px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
}
.fake b {
  width: 60%;
  height: 12px;
  background: color-mix(in srgb, var(--vp-c-text-3) 30%, transparent);
}
.fake .s {
  width: 70%;
}
.bar {
  height: 4px;
  margin-top: 16px;
  border-radius: 2px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--info), var(--stable));
  transform-origin: 0 50%;
}

/* ---------- 记录 ---------- */
.log-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.reset {
  font-size: 13px;
  color: var(--vp-c-text-2);
  transition: color var(--dur-fast) var(--ease-out);
}
.reset:hover {
  color: var(--vp-c-brand-1);
}
.log {
  /* 固定高度：记录变多时不能把下面的内容往下推，否则它自己就成了布局偏移的来源 */
  height: 300px;
  contain: strict;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  border-top: 1px solid var(--vp-c-divider);
}
.log li {
  display: grid;
  grid-template-columns: 64px 8px 1fr;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 10px 0;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.log time {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.log li i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-text-3);
}
.k-cls i {
  background: var(--warn) !important;
}
.k-inp i {
  background: var(--ecg-info) !important;
}
.k-long i {
  background: var(--bad) !important;
}
.k-lcp i {
  background: var(--good) !important;
}
.foot {
  margin: 48px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--vp-c-text-3);
}
.foot a {
  color: var(--vp-c-brand-1);
}

@media (max-width: 860px) {
  .core,
  .exps {
    grid-template-columns: 1fr;
  }
  .minor {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ex-desc {
    min-height: 0;
  }
}
@media (max-width: 640px) {
  .ecg {
    height: 180px;
  }
  .legend {
    gap: 6px 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .live i {
    animation: none;
  }
}
</style>
