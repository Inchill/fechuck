<script setup lang="ts">
// 文章星图：每颗星是一篇文章 / 随想，内容越相近离得越近（数据见 stars.data.mts）
// 悬停看最相近的几篇，点击打开；「按时间点亮」会按写作顺序一颗颗亮起来
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, withBase } from 'vitepress'
import { data } from '../stars.data'

const router = useRouter()
const { groups, links } = data
const VW = 1000
const VH = 620
const COLORS = ['#6cb6f5', '#3ddc9a', '#f0a868', '#a48be6', '#e88aa8', '#7fd1d1']

// 把 0~1 的坐标放大到画布上，再做几轮简单的「互相推开」，避免星星和标题叠在一起
const stars = (() => {
  const s = data.stars.map((st) => ({ ...st, px: 60 + st.x * (VW - 120), py: 50 + st.y * (VH - 110) }))
  for (let it = 0; it < 120; it++) {
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const dx = s[j].px - s[i].px
        const dy = s[j].py - s[i].py
        const d = Math.hypot(dx, dy) || 0.01
        const min = 78
        if (d < min) {
          const push = (min - d) / 2
          s[i].px -= (dx / d) * push
          s[i].py -= (dy / d) * push
          s[j].px += (dx / d) * push
          s[j].py += (dy / d) * push
        }
      }
    for (const st of s) {
      st.px = Math.min(VW - 50, Math.max(50, st.px))
      st.py = Math.min(VH - 40, Math.max(40, st.py))
    }
  }
  return s
})()
const radius = (w: number) => Math.min(9, 3 + Math.sqrt(w) / 14)
const short = (t: string) => {
  const s = t.replace(/[：:，,？?].*$/, '')
  return [...s].length > 14 ? [...s].slice(0, 13).join('') + '…' : s
}

// 星云：每个星座在成员中心画一团柔光
const nebulae = groups.map((g, k) => {
  const mem = stars.filter((s) => s.c === k)
  const cx = mem.reduce((a, s) => a + s.px, 0) / mem.length
  const cy = mem.reduce((a, s) => a + s.py, 0) / mem.length
  const r = Math.max(90, ...mem.map((s) => Math.hypot(s.px - cx, s.py - cy) + 60))
  const top = Math.min(...mem.map((s) => s.py))
  return { k, cx, cy, r, name: g.name, color: COLORS[k % COLORS.length], labelY: Math.max(18, top - 30) }
})

// 背景的小星星：固定种子，每次一样
const dust = (() => {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: 140 }, () => ({ x: rnd() * VW, y: rnd() * VH, r: rnd() * 1.1 + 0.2, d: rnd() * 4 }))
})()

/* ---------- 交互 ---------- */
const hover = ref(-1)
const focusGroup = ref(-1)
const lit = ref(stars.length) // 已点亮几颗（按时间点亮时从 0 开始数）
const playing = ref(false)
const order = stars.map((_, i) => i).sort((a, b) => stars[a].date.localeCompare(stars[b].date))
const rank = new Map(order.map((i, r) => [i, r]))
const isLit = (i: number) => rank.get(i)! < lit.value
const litDate = computed(() => (lit.value > 0 && lit.value <= order.length ? stars[order[Math.min(lit.value, order.length) - 1]].date : ''))

const near = computed(() => (hover.value >= 0 ? new Set([hover.value, ...stars[hover.value].near]) : null))
const dim = (i: number) => (near.value ? !near.value.has(i) : focusGroup.value >= 0 ? stars[i].c !== focusGroup.value : false)
const hoverLinks = computed(() => (hover.value >= 0 ? stars[hover.value].near.map((j) => [hover.value, j]) : []))

const tip = computed(() => {
  if (hover.value < 0) return null
  const s = stars[hover.value]
  return {
    s,
    near: s.near.slice(0, 2).map((j) => stars[j].title),
    left: (s.px / VW) * 100,
    top: (s.py / VH) * 100,
    flip: s.px > VW * 0.62
  }
})

function open(i: number) {
  router.go(withBase(stars[i].url))
}

let timer = 0
function play() {
  if (playing.value) return stop()
  lit.value = 0
  playing.value = true
  timer = window.setInterval(() => {
    lit.value++
    if (lit.value >= order.length) stop()
  }, 420)
}
function stop() {
  playing.value = false
  clearInterval(timer)
  if (lit.value < order.length) lit.value = order.length
}

// 鼠标移动时整片星空轻微视差
const tilt = ref({ x: 0, y: 0 })
function onMove(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  tilt.value = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 }
}

onMounted(() => {
  // 进来时先按时间点亮一遍（不喜欢动画的读者直接全亮）
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) play()
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="sm">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5 9.3 6.7 14.5 8 9.3 9.3 8 14.5 6.7 9.3 1.5 8 6.7 6.7z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
        <a href="/lab/">LAB</a> <i>/</i> 文章星图
      </div>
      <h1 class="headline">写过的东西，<span class="grad">像一片星空。</span></h1>
      <p class="sub">每颗星是一篇文章，内容越相近，离得越近。位置和分组都是按正文自动算出来的，没有手动分类。</p>
    </header>

    <div class="sky-wrap" @mousemove="onMove" @mouseleave="(tilt = { x: 0, y: 0 }), (hover = -1)">
      <svg class="sky" :viewBox="`0 0 ${VW} ${VH}`" role="img" aria-label="文章星图">
        <defs>
          <radialGradient v-for="n in nebulae" :id="'neb' + n.k" :key="n.k">
            <stop offset="0%" :stop-color="n.color" stop-opacity="0.26" />
            <stop offset="60%" :stop-color="n.color" stop-opacity="0.07" />
            <stop offset="100%" :stop-color="n.color" stop-opacity="0" />
          </radialGradient>
          <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- 背景星尘（视差移动得最少） -->
        <g class="dust" :style="{ transform: `translate(${tilt.x * -4}px, ${tilt.y * -4}px)` }">
          <circle v-for="(d, i) in dust" :key="i" :cx="d.x" :cy="d.y" :r="d.r" :style="{ animationDelay: d.d + 's' }" />
        </g>

        <g :style="{ transform: `translate(${tilt.x * -10}px, ${tilt.y * -10}px)` }" class="layer">
          <!-- 星云 -->
          <g v-for="n in nebulae" :key="'n' + n.k" class="nebula" :class="{ dim: focusGroup >= 0 && focusGroup !== n.k }">
            <circle :cx="n.cx" :cy="n.cy" :r="n.r" :fill="`url(#neb${n.k})`" />
            <text :x="n.cx" :y="n.labelY" class="neb-name" :fill="n.color">{{ n.name }}</text>
          </g>

          <!-- 连线：每篇连向最相近的两篇 -->
          <line
            v-for="([a, b, s], i) in links"
            :key="'l' + i"
            class="link"
            :class="{ off: !isLit(a) || !isLit(b), dim: dim(a) || dim(b) }"
            :x1="stars[a].px"
            :y1="stars[a].py"
            :x2="stars[b].px"
            :y2="stars[b].py"
            :style="{ opacity: 0.18 + Math.min(0.5, s * 1.4) }"
          />
          <!-- 悬停时：连向它最相近的几篇 -->
          <line v-for="([a, b], i) in hoverLinks" :key="'h' + i" class="link hot" :x1="stars[a].px" :y1="stars[a].py" :x2="stars[b].px" :y2="stars[b].py" />

          <!-- 星星 -->
          <g
            v-for="(s, i) in stars"
            :key="s.url"
            class="star"
            :class="{ off: !isLit(i), dim: dim(i), hot: hover === i, note: s.kind === '随想' }"
            :transform="`translate(${s.px}, ${s.py})`"
            tabindex="0"
            role="link"
            :aria-label="s.title"
            @mouseenter="hover = i"
            @focus="hover = i"
            @blur="hover = -1"
            @click="open(i)"
            @keydown.enter="open(i)"
          >
            <circle class="halo" :r="radius(s.words) * 2.6" :fill="COLORS[s.c % COLORS.length]" />
            <circle class="core" :r="radius(s.words)" :fill="COLORS[s.c % COLORS.length]" filter="url(#glow)" :style="{ animationDelay: (i % 7) * 0.6 + 's' }" />
            <circle class="dot" :r="radius(s.words) * 0.42" />
            <text class="label" :x="radius(s.words) + 6" y="4">{{ short(s.title) }}</text>
          </g>
        </g>
      </svg>

      <!-- 悬停卡片 -->
      <div v-if="tip" class="tip" :class="{ flip: tip.flip }" :style="{ left: tip.left + '%', top: tip.top + '%' }">
        <div class="tip-meta">{{ tip.s.kind }} · {{ tip.s.date }}</div>
        <div class="tip-title">{{ tip.s.title }}</div>
        <div v-if="tip.near.length" class="tip-near">
          最相近：<span v-for="t in tip.near" :key="t">《{{ short(t) }}》</span>
        </div>
      </div>

      <div v-if="playing || lit < stars.length" class="clock">{{ litDate }}</div>
    </div>

    <div class="below">
      <div class="groups">
        <button v-for="n in nebulae" :key="n.k" type="button" :class="{ on: focusGroup === n.k }" @click="focusGroup = focusGroup === n.k ? -1 : n.k">
          <i :style="{ background: n.color }"></i>{{ n.name }}
        </button>
      </div>
      <button type="button" class="replay" @click="play">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5 9.3 6.7 14.5 8 9.3 9.3 8 14.5 6.7 9.3 1.5 8 6.7 6.7z" fill="currentColor" /></svg>
        {{ playing ? '停止' : '按时间点亮' }}
      </button>
    </div>
    <p class="note">
      原理：正文按词切开，用 TF-IDF 衡量每两篇的相似度，再用多维缩放（MDS）摊到平面上，离得近的归成一组，组名取组内最有代表性的词。全部在构建时计算，不调用任何模型。
    </p>
  </div>
</template>

<style scoped>
.sm {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}
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
  max-width: 40em;
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  color: var(--vp-c-text-2);
}

/* ---------- 星空 ---------- */
.sky-wrap {
  --sky: #0a0e14;
  --label: rgba(231, 237, 241, 0.72);
  position: relative;
  margin-top: 36px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background:
    radial-gradient(ellipse at 30% 20%, rgba(108, 182, 245, 0.12), transparent 60%),
    radial-gradient(ellipse at 80% 90%, rgba(61, 220, 154, 0.08), transparent 55%),
    var(--sky);
  overflow: hidden;
}
/* 亮色模式也保持「夜空」，只是边框和阴影跟着主题走 */
:root:not(.dark) .sky-wrap {
  box-shadow: 0 30px 70px -36px rgba(16, 24, 32, 0.55);
}
.sky {
  display: block;
  width: 100%;
  height: auto;
}
.layer,
.dust {
  transition: transform 600ms var(--ease-out);
}
.dust circle {
  fill: #fff;
  opacity: 0.35;
  animation: twinkle 4s ease-in-out infinite;
}
@keyframes twinkle {
  50% {
    opacity: 0.08;
  }
}
.nebula {
  transition: opacity 400ms var(--ease-out);
}
.nebula.dim {
  opacity: 0.2;
}
.neb-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-anchor: middle;
  opacity: 0.85;
}
.link {
  stroke: rgba(200, 225, 255, 0.9);
  stroke-width: 1;
  transition: opacity 400ms var(--ease-out);
}
.link.off {
  opacity: 0 !important;
}
.link.dim {
  opacity: 0.04 !important;
}
.link.hot {
  stroke: #fff;
  stroke-width: 1.4;
  stroke-dasharray: 4 4;
  opacity: 0.85;
  animation: flow 1s linear infinite;
}
@keyframes flow {
  to {
    stroke-dashoffset: -16;
  }
}
.star {
  cursor: pointer;
  outline: none;
  transition: opacity 500ms var(--ease-out);
}
.star .halo {
  opacity: 0.12;
  transition:
    opacity 300ms var(--ease-out),
    r 300ms var(--ease-out);
}
.star .core {
  animation: pulse 4.2s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes pulse {
  50% {
    opacity: 0.75;
  }
}
.star .dot {
  fill: #fff;
}
.star.note .dot {
  fill: transparent;
}
.label {
  font-size: 12.5px;
  fill: var(--label);
  paint-order: stroke;
  stroke: var(--sky);
  stroke-width: 3px;
  transition: fill 300ms;
}
.star.hot .halo {
  opacity: 0.35;
}
.star.hot .label {
  fill: #fff;
  font-weight: 600;
}
.star.dim {
  opacity: 0.18;
}
/* 还没点亮：缩小并隐藏 */
.star.off {
  opacity: 0;
}
.star:not(.off) {
  animation: appear 700ms var(--ease-out);
}
@keyframes appear {
  from {
    opacity: 0;
  }
}

.tip {
  position: absolute;
  z-index: 2;
  width: 250px;
  margin: 16px 0 0 16px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(14, 19, 26, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  color: #e7edf1;
  pointer-events: none;
}
.tip.flip {
  translate: calc(-100% - 32px) 0;
}
.tip-meta {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: rgba(231, 237, 241, 0.55);
}
.tip-title {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}
.tip-near {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(231, 237, 241, 0.7);
}
.clock {
  position: absolute;
  right: 18px;
  bottom: 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: rgba(231, 237, 241, 0.7);
  pointer-events: none;
}

/* ---------- 下方：星座筛选 ---------- */
.below {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 16px;
}
.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.groups button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}
.groups button i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.groups button:hover,
.groups button.on {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-text-3);
}
.replay {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    linear-gradient(100deg, var(--info), var(--stable)) border-box;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}
.replay svg {
  color: var(--vp-c-brand-1);
}
.note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}

@media (max-width: 640px) {
  .label {
    display: none;
  }
  .star.hot .label {
    display: inline;
  }
  .neb-name {
    font-size: 18px;
  }
  .tip {
    width: 200px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dust circle,
  .star .core,
  .link.hot {
    animation: none;
  }
}
</style>
