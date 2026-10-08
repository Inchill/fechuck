<script setup lang="ts">
// 「建造回放」：把仓库画成一座等距视角的小城
// 每栋楼是一个文件，楼高 ≈ 代码行数；拖动时间轴，按 git 提交一次次回放这座城是怎么长出来的
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { data } from '../city.data'

const { paths, commits } = data
const N = commits.length

/* ---------- 街区：构建时已按导航菜单和代码类型分好（见 city.data.mts） ---------- */
const ZONES = data.zones
type Zone = number // 街区下标
const zoneOfFile = data.zone

/* ---------- 每次提交之后，每个文件有多少行、被改过几次 ---------- */
// lines[i][fileIdx]：第 i 次提交之后的行数；edits 同理
const lines: Int32Array[] = []
const edits: Int16Array[] = []
{
  const cur = new Int32Array(paths.length)
  const ed = new Int16Array(paths.length)
  for (const c of commits) {
    for (const [i, a, d] of c.f) {
      cur[i] = Math.max(0, cur[i] + a - d)
      ed[i]++
    }
    lines.push(cur.slice())
    edits.push(ed.slice())
  }
}
const firstSeen = paths.map((_, i) => commits.findIndex((c) => c.f.some((f) => f[0] === i)))

/* ---------- 城市布局：街区 2 行 × 3 列，街区里文件按出现顺序排成方阵 ---------- */
interface Lot {
  i: number // 文件序号
  gx: number
  gy: number
  zone: Zone
}
const lots: Lot[] = []
const plates: { zone: Zone; x: number; y: number; w: number; h: number }[] = []
{
  const byZone = new Map<Zone, number[]>()
  paths.forEach((_, i) => {
    const z = zoneOfFile[i]
    if (!byZone.has(z)) byZone.set(z, [])
    byZone.get(z)!.push(i)
  })
  const zones = ZONES.map((_, k) => k).filter((k) => byZone.has(k))
  const side = Math.max(...zones.map((k) => Math.ceil(Math.sqrt(byZone.get(k)!.length))))
  const plot = side + 2.6 // 街区之间留出「马路」
  const perRow = zones.length > 6 ? 4 : 3
  zones.forEach((z, k) => {
    const files = byZone.get(z)!.sort((a, b) => firstSeen[a] - firstSeen[b])
    const cols = Math.ceil(Math.sqrt(files.length))
    const ox = (k % perRow) * plot
    const oy = Math.floor(k / perRow) * plot
    files.forEach((i, j) => lots.push({ i, gx: ox + (j % cols), gy: oy + Math.floor(j / cols), zone: z }))
    plates.push({ zone: z, x: ox - 0.3, y: oy - 0.3, w: cols + 0.6, h: Math.ceil(files.length / cols) + 0.6 })
  })
  // 画家算法：离观察者远的先画
  lots.sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx)
}
const zoneColor = ZONES.map((z) => z.color)

/* ---------- 状态 ---------- */
const idx = ref(N - 1) // 当前停在第几次提交（默认展示最终的城市）
const playing = ref(false)
const heat = ref(false) // 着色模式：按街区 / 按修改次数
const hover = ref<{ i: number; x: number; y: number } | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const wrap = ref<HTMLElement | null>(null)

const commit = computed(() => commits[idx.value])
const touched = computed(() => new Map(commit.value?.f.map(([i, a, d]) => [i, { a, d }]) ?? []))
const totals = computed(() => {
  const l = lines[idx.value]
  let files = 0
  let sum = 0
  for (let i = 0; i < paths.length; i++) if (l[i] > 0) files++, (sum += l[i])
  return { files, sum }
})
const delta = computed(() => commit.value?.f.reduce((s, [, a, d]) => ({ a: s.a + a, d: s.d + d }), { a: 0, d: 0 }) ?? { a: 0, d: 0 })
const years = computed(() => {
  const out: { y: string; i: number }[] = []
  commits.forEach((c, i) => {
    const y = c.d.slice(0, 4)
    if (!out.some((o) => o.y === y)) out.push({ y, i })
  })
  return out
})
// 时间轴上每次提交一根柱子，高度按改动行数（取对数，免得大提交把其他压扁）
const bars = commits.map((c) => {
  const n = c.f.reduce((s, [, a, d]) => s + a + d, 0)
  return { h: Math.max(0.12, Math.log10(n + 1) / 4), ai: c.ai }
})
const fmt = (n: number) => n.toLocaleString('en-US')

/* ---------- 绘制 ---------- */
let ctx: CanvasRenderingContext2D | null = null
let W = 0
let H = 0
let TW = 24 // 一格的屏幕宽度
let OX = 0
let OY = 0
const shown = new Float32Array(paths.length) // 当前显示的楼高（会朝目标值缓动）
let raf = 0
let dark = false

const heightOf = (l: number) => (l <= 0 ? 0 : 3 + Math.sqrt(l) * 1.9) // 单位：像素（按 TW=24 设计，绘制时等比缩放）

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.round(Math.min(255, Math.max(0, k >= 0 ? c + (255 - c) * k : c * (1 + k))))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}
// 热度色：改得越多越「热」（蓝 → 绿 → 黄 → 橙）
function heatColor(n: number) {
  const stops = ['#4b8fd6', '#3ddc9a', '#e6c84f', '#ef8a3c']
  const t = Math.min(1, Math.log2(n + 1) / 4) * (stops.length - 1)
  const a = Math.floor(t)
  const b = Math.min(stops.length - 1, a + 1)
  const mix = (x: string, y: string, k: number) => {
    const p = parseInt(x.slice(1), 16)
    const q = parseInt(y.slice(1), 16)
    const c = (s: number) => Math.round(((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k)
    return '#' + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('')
  }
  return mix(stops[a], stops[b], t - a)
}

const iso = (gx: number, gy: number) => [OX + ((gx - gy) * TW) / 2, OY + ((gx + gy) * TW) / 4] as const

function fit() {
  const el = canvas.value
  if (!el || !wrap.value) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  W = wrap.value.clientWidth
  H = W < 640 ? 340 : 480
  el.width = W * dpr
  el.height = H * dpr
  el.style.height = H + 'px'
  ctx = el.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // 让整座城放进画布：先算网格的等距包围盒
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of plates) {
    for (const [x, y] of [
      [p.x, p.y],
      [p.x + p.w, p.y],
      [p.x, p.y + p.h],
      [p.x + p.w, p.y + p.h]
    ]) {
      minX = Math.min(minX, (x - y) / 2)
      maxX = Math.max(maxX, (x - y) / 2)
      minY = Math.min(minY, (x + y) / 4)
      maxY = Math.max(maxY, (x + y) / 4)
    }
  }
  const tallest = Math.max(...Array.from(lines[N - 1]).map(heightOf)) / 24
  TW = Math.min((W - 40) / (maxX - minX), (H - 80) / (maxY - minY + tallest))
  OX = (W - (maxX - minX) * TW) / 2 - minX * TW
  OY = H - 34 - (maxY - minY) * TW - minY * TW // 底部留出街区名的空间
  OY = Math.max(OY, tallest * TW + 16 - minY * TW)
}

function draw() {
  if (!ctx) return
  dark = document.documentElement.classList.contains('dark')
  ctx.clearRect(0, 0, W, H)
  const s = TW / 24

  // 街区地块
  for (const p of plates) {
    const pts = [iso(p.x, p.y), iso(p.x + p.w, p.y), iso(p.x + p.w, p.y + p.h), iso(p.x, p.y + p.h)]
    ctx.beginPath()
    pts.forEach(([x, y], k) => (k ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y)))
    ctx.closePath()
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.035)' : 'rgba(16,24,32,0.035)'
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(16,24,32,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 楼
  const inset = 0.16
  for (const lot of lots) {
    const h = shown[lot.i] * s
    if (h < 0.5) {
      // 已经删掉、或还没出生的文件：只画一块浅色地基
      if (firstSeen[lot.i] <= idx.value) {
        const [ax, ay] = iso(lot.gx + inset, lot.gy + inset)
        const [bx, by] = iso(lot.gx + 1 - inset, lot.gy + inset)
        const [cx, cy] = iso(lot.gx + 1 - inset, lot.gy + 1 - inset)
        const [dx, dy] = iso(lot.gx + inset, lot.gy + 1 - inset)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.lineTo(cx, cy)
        ctx.lineTo(dx, dy)
        ctx.closePath()
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(16,24,32,0.12)'
        ctx.setLineDash([2, 2])
        ctx.stroke()
        ctx.setLineDash([])
      }
      continue
    }
    const t = touched.value.get(lot.i)
    const base = heat.value ? heatColor(edits[idx.value][lot.i]) : zoneColor[lot.zone]
    const isNew = t && firstSeen[lot.i] === idx.value
    const isHover = hover.value?.i === lot.i
    const x0 = lot.gx + inset
    const x1 = lot.gx + 1 - inset
    const y0 = lot.gy + inset
    const y1 = lot.gy + 1 - inset
    const P = (x: number, y: number, up = 0) => {
      const [px, py] = iso(x, y)
      return [px, py - up] as const
    }
    const face = (pts: (readonly [number, number])[], fill: string) => {
      ctx!.beginPath()
      pts.forEach(([x, y], k) => (k ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y)))
      ctx!.closePath()
      ctx!.fillStyle = fill
      ctx!.fill()
    }
    // 这次提交改到的楼：发光
    if (t) {
      ctx.save()
      ctx.shadowColor = isNew ? '#3ddc9a' : '#ffc857'
      ctx.shadowBlur = 18 * Math.min(1.4, s)
    }
    face([P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], shade(base, dark ? -0.28 : -0.12)) // 左面
    face([P(x1, y0), P(x1, y1), P(x1, y1, h), P(x1, y0, h)], shade(base, dark ? -0.48 : -0.32)) // 右面
    face([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], t ? (isNew ? '#b9f5dc' : '#ffe2a3') : shade(base, dark ? 0.12 : 0.35)) // 顶面
    if (t) ctx.restore()
    if (isHover) {
      ctx.strokeStyle = dark ? '#fff' : '#101820'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (const [x, y] of [P(x0, y1), P(x0, y1, h), P(x0, y0, h), P(x1, y0, h), P(x1, y0), P(x1, y1), P(x0, y1)]) ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  // 街区名：最后画在地块前角，带一层底色，不会被楼挡住
  const font = getComputedStyle(document.body).fontFamily
  for (const p of plates) {
    const [lx, ly] = iso(p.x + p.w, p.y + p.h)
    const name = ZONES[p.zone].name
    ctx.font = `600 ${Math.round(Math.max(10.5, Math.min(13, 11 * s)))}px ${font}`
    const w = ctx.measureText(name).width + 14
    const y = ly + 8
    ctx.fillStyle = dark ? 'rgba(11,15,20,0.72)' : 'rgba(255,255,255,0.8)'
    ctx.beginPath()
    ctx.roundRect(lx - w / 2, y, w, 18, 9)
    ctx.fill()
    ctx.fillStyle = shade(zoneColor[p.zone], dark ? 0.05 : -0.3)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, lx, y + 9.5)
  }
}

// 楼高朝目标值缓动，动完就停
function animate() {
  cancelAnimationFrame(raf)
  const target = lines[idx.value]
  const step = () => {
    let moving = false
    for (let i = 0; i < paths.length; i++) {
      const goal = heightOf(target[i])
      const d = goal - shown[i]
      if (Math.abs(d) > 0.2) {
        shown[i] += d * 0.18
        moving = true
      } else shown[i] = goal
    }
    draw()
    if (moving) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

/* ---------- 悬停：找到鼠标下面的楼（从前往后找） ---------- */
function onMove(e: MouseEvent) {
  const r = canvas.value!.getBoundingClientRect()
  const mx = e.clientX - r.left
  const my = e.clientY - r.top
  const s = TW / 24
  for (let k = lots.length - 1; k >= 0; k--) {
    const lot = lots[k]
    const h = shown[lot.i] * s
    if (h < 0.5) continue
    const [cx, cy] = iso(lot.gx + 0.5, lot.gy + 0.5)
    // 近似：楼的屏幕轮廓是一个竖着的六边形，用「中心线 ± 半宽」判断
    const half = TW / 2 - TW * 0.16
    const dx = Math.abs(mx - cx)
    if (dx > half) continue
    const slope = (dx / half) * (TW / 4) * 0.68
    if (my <= cy + TW / 4 - slope && my >= cy - h - TW / 4 + slope) {
      hover.value = { i: lot.i, x: mx, y: my }
      draw()
      return
    }
  }
  if (hover.value) {
    hover.value = null
    draw()
  }
}
function onLeave() {
  hover.value = null
  draw()
}
const tip = computed(() => {
  const h = hover.value
  if (!h) return null
  const i = h.i
  return {
    path: paths[i].replace(/^docs\/\.vitepress\//, '.vitepress/').replace(/^docs\//, ''),
    lines: lines[idx.value][i],
    edits: edits[idx.value][i],
    born: commits[firstSeen[i]]?.d,
    x: Math.min(h.x + 14, W - 220),
    y: Math.max(h.y - 70, 8)
  }
})

/* ---------- 播放 ---------- */
let timer = 0
function go(i: number) {
  idx.value = Math.max(0, Math.min(N - 1, i))
}
function play() {
  if (playing.value) return stop()
  if (idx.value >= N - 1) {
    // 从一片空地开始
    go(0)
    shown.fill(0)
  }
  playing.value = true
  timer = window.setInterval(() => {
    if (idx.value >= N - 1) return stop()
    go(idx.value + 1)
  }, 900)
}
function stop() {
  playing.value = false
  clearInterval(timer)
}
function onTrack(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const pick = (x: number) => {
    const r = el.getBoundingClientRect()
    go(Math.round(((x - r.left) / r.width) * (N - 1)))
  }
  stop()
  pick(e.clientX)
  const move = (ev: PointerEvent) => pick(ev.clientX)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') stop(), go(idx.value - 1)
  else if (e.key === 'ArrowRight') stop(), go(idx.value + 1)
  else if (e.key === ' ') e.preventDefault(), play()
}

watch(idx, animate)
watch(heat, draw)

let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null
onMounted(() => {
  if (!N) return
  fit()
  for (let i = 0; i < paths.length; i++) shown[i] = heightOf(lines[N - 1][i])
  draw()
  ro = new ResizeObserver(() => {
    fit()
    draw()
  })
  ro.observe(wrap.value!)
  // 切换明暗主题时重画
  mo = new MutationObserver(draw)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => {
  stop()
  cancelAnimationFrame(raf)
  ro?.disconnect()
  mo?.disconnect()
})
</script>

<template>
  <div class="city">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2 14V7l3-2v9M6 14V3l4-1.5V14M11 14V6l3 1.5V14M1 14h14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
        <a href="/lab/">LAB</a> <i>/</i> 建造回放
      </div>
      <h1 class="headline">这个网站，<span class="grad">是怎么长出来的。</span></h1>
      <p class="sub">每栋楼是一个文件，楼高代表代码行数。拖动时间轴，回放 {{ N }} 次提交。</p>
    </header>

    <p v-if="!N" class="empty">构建时没有读到 git 历史（可能是浅克隆），暂时没有数据。</p>

    <div v-else class="stage" tabindex="0" @keydown="onKey">
      <div class="stats">
        <div><b>{{ fmt(totals.files) }}</b><span>个文件</span></div>
        <div><b>{{ fmt(totals.sum) }}</b><span>行</span></div>
        <div><b>{{ idx + 1 }}</b><span>/ {{ N }} 次提交</span></div>
        <div class="modes" role="radiogroup" aria-label="着色">
          <button type="button" role="radio" :aria-checked="!heat" :class="{ on: !heat }" @click="heat = false">按街区</button>
          <button type="button" role="radio" :aria-checked="heat" :class="{ on: heat }" @click="heat = true">按修改次数</button>
        </div>
      </div>

      <div ref="wrap" class="canvas-wrap">
        <canvas ref="canvas" @mousemove="onMove" @mouseleave="onLeave"></canvas>
        <div v-if="tip" class="tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
          <div class="tip-path">{{ tip.path }}</div>
          <div class="tip-meta">{{ fmt(tip.lines) }} 行 · 改过 {{ tip.edits }} 次 · {{ tip.born }} 出生</div>
        </div>
        <div class="legend">
          <template v-if="!heat">
            <span v-for="z in ZONES" :key="z.id"><i :style="{ background: z.color }"></i>{{ z.name }}</span>
          </template>
          <template v-else>
            <span class="heat-bar"><i></i></span>
            <span>改得少 → 改得多</span>
          </template>
          <span class="sep"></span>
          <span><i class="lit new"></i>新建</span>
          <span><i class="lit mod"></i>本次修改</span>
        </div>
      </div>

      <!-- 当前这次提交 -->
      <div class="commit">
        <div class="c-top">
          <time>{{ commit.d }}</time>
          <code>{{ commit.h }}</code>
          <span v-if="commit.ai" class="ai" title="提交信息里标注了 AI 协作者（Co-Authored-By）">✦ 与 AI 协作</span>
          <span class="diff"><b class="add">+{{ fmt(delta.a) }}</b> <b class="del">−{{ fmt(delta.d) }}</b> · {{ commit.f.length }} 个文件</span>
        </div>
        <div class="c-msg">{{ commit.m }}</div>
      </div>

      <!-- 时间轴：每次提交一根柱子，高度是改动量 -->
      <div class="timeline">
        <button type="button" class="play" :aria-label="playing ? '暂停' : '播放'" @click="play">
          <svg v-if="playing" viewBox="0 0 16 16" width="14" height="14"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
          <svg v-else viewBox="0 0 16 16" width="14" height="14"><path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
        </button>
        <div class="track" role="slider" :aria-valuemin="1" :aria-valuemax="N" :aria-valuenow="idx + 1" aria-label="提交" @pointerdown="onTrack">
          <span v-for="(b, i) in bars" :key="i" class="bar" :class="{ 'is-past': i <= idx, 'is-cur': i === idx, 'is-ai': b.ai }" :style="{ height: b.h * 100 + '%' }"></span>
        </div>
      </div>
      <div class="years">
        <button v-for="y in years" :key="y.y" type="button" @click="stop(), go(y.i)">{{ y.y }}</button>
        <span class="hint">← → 逐个提交 · 空格 播放</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.city {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}

/* ---------- 头部（和书签页同一套） ---------- */
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
.empty {
  margin-top: 48px;
  color: var(--vp-c-text-3);
}

/* ---------- 舞台 ---------- */
.stage {
  margin-top: 36px;
  outline: none;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px 28px;
  padding-top: 22px;
  border-top: 1px solid var(--vp-c-divider);
}
.stats div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
.stats b {
  font-family: var(--vp-font-family-mono);
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 500;
  letter-spacing: -0.03em;
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
}
.stats .modes {
  margin-left: auto;
  align-self: center;
  padding: 2px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
}
.modes button {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}
.modes button.on {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.canvas-wrap {
  position: relative;
  margin-top: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 50% 0%, var(--info-soft), transparent 70%),
    var(--vp-c-bg-alt);
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
}
.tip {
  position: absolute;
  z-index: 2;
  max-width: 260px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--vp-c-bg);
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 12px 30px -12px rgba(16, 24, 32, 0.35);
  pointer-events: none;
}
.tip-path {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
  word-break: break-all;
}
.tip-meta {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}
.legend {
  position: absolute;
  left: 14px;
  top: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  max-width: calc(100% - 28px);
  font-size: 11.5px;
  color: var(--vp-c-text-2);
  pointer-events: none;
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
}
.legend .sep {
  width: 1px;
  height: 10px;
  background: var(--vp-c-divider);
}
.legend .lit.new {
  background: #b9f5dc;
  box-shadow: 0 0 6px #3ddc9a;
}
.legend .lit.mod {
  background: #ffe2a3;
  box-shadow: 0 0 6px #ffc857;
}
.heat-bar i {
  width: 60px !important;
  height: 6px !important;
  border-radius: 3px !important;
  background: linear-gradient(90deg, #4b8fd6, #3ddc9a, #e6c84f, #ef8a3c);
}

/* ---------- 当前提交 ---------- */
.commit {
  margin-top: 16px;
  min-height: 62px;
}
.c-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}
.c-top time,
.c-top code {
  font-family: var(--vp-font-family-mono);
}
.c-top code {
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--vp-c-default-soft);
  font-size: 11.5px;
  color: var(--vp-c-text-2);
}
.ai {
  padding: 1px 8px;
  border-radius: 999px;
  background: linear-gradient(100deg, color-mix(in srgb, var(--info) 18%, transparent), color-mix(in srgb, var(--stable) 18%, transparent));
  font-size: 11.5px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.diff {
  margin-left: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}
.diff .add {
  color: var(--stable);
  font-weight: 500;
}
.diff .del {
  color: #e5534b;
  font-weight: 500;
}
.c-msg {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

/* ---------- 时间轴 ---------- */
.timeline {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-top: 14px;
}
.play {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(100deg, var(--info), var(--stable));
  color: var(--vp-c-bg);
  box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--info) 70%, transparent);
  transition: filter var(--dur-fast) var(--ease-out);
}
.play:hover {
  filter: brightness(1.1);
}
.track {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 44px;
  padding: 0 2px;
  cursor: pointer;
  touch-action: none;
}
.bar {
  flex: 1;
  min-height: 3px;
  border-radius: 2px 2px 0 0;
  background: var(--vp-c-divider);
  transition: background-color 200ms;
}
.bar.is-past {
  background: color-mix(in srgb, var(--vp-c-text-3) 70%, transparent);
}
.bar.is-ai.is-past {
  background: linear-gradient(var(--info), var(--stable));
}
.bar.is-ai:not(.is-past) {
  background: color-mix(in srgb, var(--info) 35%, transparent);
}
.bar.is-cur {
  background: var(--vp-c-brand-1) !important;
  box-shadow: 0 0 10px color-mix(in srgb, var(--vp-c-brand-1) 60%, transparent);
}
.years {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0 50px;
}
.years button {
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-2);
}
.years button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.hint {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

@media (max-width: 640px) {
  .stats .modes {
    margin-left: 0;
  }
  .legend {
    font-size: 10.5px;
  }
  .diff {
    margin-left: 0;
  }
  .years {
    margin-left: 0;
  }
  .hint {
    display: none;
  }
}
</style>
