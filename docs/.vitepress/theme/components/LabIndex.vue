<script setup lang="ts">
// 实验室首页：几个和 AI 时代开发有关的互动小实验
import { withBase } from 'vitepress'

const items = [
  {
    href: '/lab/city.html',
    kind: 'city',
    accent: '#4b8fd6',
    wide: true,
    tag: '回放',
    title: '建造回放',
    desc: '把这个网站的代码仓库画成一座城：每栋楼是一个文件，按 git 提交回放它是怎么一点点长出来的。'
  },
  {
    href: '/lab/stars.html',
    kind: 'stars',
    accent: '#8a6bd6',
    tag: '可视化',
    title: '文章星图',
    desc: '每颗星是一篇文章，内容越相近离得越近。位置和分组按正文自动算出，看看我都在写些什么。'
  },
  {
    href: '/lab/tokens.html',
    kind: 'tokens',
    accent: '#d98a3d',
    tag: '工具',
    title: 'Token 显微镜',
    desc: '输入一段话，实时看它被模型切成哪些 token。中文、英文、代码、emoji 的差别一眼就能看出来。'
  },
  {
    href: '/lab/context.html',
    kind: 'context',
    accent: '#2fae82',
    tag: '演示',
    title: '上下文窗口模拟器',
    desc: '一句「提交代码」背后，Skill 是怎么分级加载的、上下文怎么一点点被填满、每一轮有多少命中了缓存。'
  },
  {
    href: '/lab/vitals.html',
    kind: 'vitals',
    accent: '#e05d6f',
    tag: '性能',
    title: 'Web Vitals 心电图',
    desc: '实时测量你正在看的这一页：LCP、CLS、INP 和主线程心跳。再亲手把它弄坏、修好。'
  }
]
// 心电图卡片的预览：一段心跳，中间卡住一下
const ecg = (() => {
  const beat = (x: number) => `l${x - 8},0 l3,-4 l3,4 l4,0 l2,3 l3,-26 l3,32 l2,-9 l6,0 l4,-6 l4,6`
  return { a: `M10,60 ${beat(16)} ${beat(16)} l6,0`, b: `M100,60 l32,0`, c: `M132,60 ${beat(16)} ${beat(16)} l4,0` }
})()

// 卡片聚光：鼠标位置写进 --mx / --my
function spot(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

// Token 卡片的预览：一句话切成彩色小块
const toks = ['渐进', '式', '披露', '·是', '·Skills', '·最', '关键', '的', '设计']
// 上下文卡片的预览：一排逐渐填满的格子
const cells = Array.from({ length: 40 }, (_, i) =>
  i < 4 ? 'a' : i < 6 ? 'b' : i < 8 ? 'c' : i < 9 ? 'd' : i < 22 ? 'f ' + ['a', 'b', 'c', 'd'][i % 4] : ''
)
</script>

<template>
  <div class="lab">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6 1.5h4M6.8 1.5v4.2L2.6 13a1 1 0 0 0 .9 1.5h9a1 1 0 0 0 .9-1.5L9.2 5.7V1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /><path d="M4.3 10h7.4" stroke="currentColor" stroke-width="1.3" /></svg>
        LAB <i>/</i> 实验室
      </div>
      <h1 class="headline">几个能上手玩的<span class="grad">小实验。</span></h1>
      <p class="sub">和 AI 时代的开发有关，点开就能玩，全部在浏览器里运行。</p>
      <ul class="facts">
        <li><b>{{ items.length }}</b> 个实验</li>
        <li><b>0</b> 个后端</li>
        <li><a href="https://github.com/Inchill/fechuck/tree/master/docs/.vitepress/theme/components" target="_blank" rel="noopener">源码都在 GitHub ↗</a></li>
      </ul>
    </header>

    <div class="grid">
      <a
        v-for="(it, n) in items"
        :key="it.href"
        class="card"
        :class="['k-' + it.kind, { wide: it.wide }]"
        :style="{ '--ac': it.accent, '--n': n }"
        :href="withBase(it.href)"
        @mousemove="spot"
      >
        <div class="preview" aria-hidden="true">
          <!-- 建造回放：几栋等距小楼 -->
          <svg v-if="it.kind === 'city'" viewBox="0 0 200 110" class="city-svg">
            <g v-for="(b, i) in [
              { x: 60, h: 34, c: '#6cb6f5' },
              { x: 84, h: 56, c: '#4b8fd6' },
              { x: 108, h: 24, c: '#3ddc9a' },
              { x: 132, h: 44, c: '#3ddc9a' },
              { x: 96, h: 18, c: '#a48be6', y: 14 },
              { x: 120, h: 30, c: '#d3a95c', y: 14 }
            ]" :key="i" :transform="`translate(${b.x}, ${78 + (b.y ?? 0) - b.h})`" class="bld" :style="{ animationDelay: i * 90 + 'ms' }">
              <polygon :points="`0,6 12,0 24,6 12,12`" :fill="b.c" opacity="0.95" />
              <polygon :points="`0,6 12,12 12,${12 + b.h} 0,${6 + b.h}`" :fill="b.c" opacity="0.7" />
              <polygon :points="`24,6 12,12 12,${12 + b.h} 24,${6 + b.h}`" :fill="b.c" opacity="0.45" />
            </g>
          </svg>
          <!-- 文章星图：几颗连成星座的星 -->
          <svg v-else-if="it.kind === 'stars'" viewBox="0 0 200 110" class="stars-svg">
            <g class="lines">
              <line x1="40" y1="70" x2="78" y2="40" /><line x1="78" y1="40" x2="104" y2="62" /><line x1="104" y1="62" x2="150" y2="34" />
              <line x1="150" y1="34" x2="168" y2="76" /><line x1="104" y1="62" x2="126" y2="88" />
            </g>
            <circle v-for="(p, i) in [[40, 70, '#f0a868'], [78, 40, '#f0a868'], [104, 62, '#6cb6f5'], [150, 34, '#a48be6'], [168, 76, '#a48be6'], [126, 88, '#3ddc9a']]" :key="i" :cx="p[0]" :cy="p[1]" :r="i === 2 ? 5 : 3.6" :fill="(p[2] as string)" class="st" :style="{ animationDelay: i * 120 + 'ms' }" />
          </svg>
          <!-- 心电图：一段心跳，中间主线程卡住变成红色平线 -->
          <svg v-else-if="it.kind === 'vitals'" viewBox="0 0 220 100" class="ecg-svg">
            <path :d="ecg.a" class="beat" />
            <rect x="100" y="20" width="32" height="62" rx="3" class="stall" />
            <path :d="ecg.b" class="flat" />
            <path :d="ecg.c" class="beat b2" />
          </svg>
          <!-- Token 显微镜：一句话切成彩色小块 -->
          <div v-else-if="it.kind === 'tokens'" class="toks">
            <span v-for="(t, i) in toks" :key="i" :class="'t' + (i % 5)" :style="{ animationDelay: i * 70 + 'ms', '--i': i }">{{ t }}</span>
          </div>
          <!-- 上下文模拟器：逐渐填满的格子 -->
          <div v-else class="cells">
            <span v-for="(c, i) in cells" :key="i" :class="c" :style="{ animationDelay: i * 25 + 'ms', '--i': i - 9 }"></span>
          </div>
        </div>
        <div class="body">
          <div class="meta">
            <span class="num">{{ String(n + 1).padStart(2, '0') }}</span>
            <span class="tag"><i></i>{{ it.tag }}</span>
          </div>
          <h2>{{ it.title }}</h2>
          <p>{{ it.desc }}</p>
          <span class="go" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
        </div>
      </a>
    </div>

    <p class="more">更多实验在路上。</p>
  </div>
</template>

<style scoped>
.lab {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}
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
  white-space: nowrap; /* 「小实验。」不要在手机上被拆成两行 */
}
.sub {
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  color: var(--vp-c-text-2);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}
.facts li {
  margin: 0;
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.facts b {
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.facts a {
  color: inherit;
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}
.facts a:hover {
  color: var(--vp-c-brand-1);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 56px;
}
.card {
  --mx: 50%;
  --my: 50%;
  --ac: var(--vp-c-brand-1);
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  animation: enter 700ms var(--ease-out) backwards;
  animation-delay: calc(var(--n) * 70ms + 120ms);
  transition:
    transform 500ms var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    box-shadow 500ms var(--ease-out);
}
@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}
/* 第一张卡片占两列，左右排：五个实验正好排成 2 + 3 */
.card.wide {
  grid-column: span 2;
  flex-direction: row;
}
.card.wide .preview {
  flex: 1.35;
  height: auto;
  min-height: 220px;
}
.card.wide .body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px;
}
.card.wide h2 {
  font-size: 1.5rem;
}
.card.wide .city-svg {
  max-width: 400px;
  height: 210px;
}
/* 鼠标跟随的柔光，颜色取每个实验自己的主题色 */
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(400px circle at var(--mx) var(--my), color-mix(in srgb, var(--ac) 10%, transparent), transparent 60%);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.card:hover::before {
  opacity: 1;
}
.card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--ac) 40%, var(--vp-c-divider));
  box-shadow: 0 28px 60px -30px color-mix(in srgb, var(--ac) 45%, rgba(16, 24, 32, 0.4));
}
.dark .card:hover {
  box-shadow: 0 30px 70px -24px rgba(0, 0, 0, 0.7);
}

/* ---------- 预览区 ---------- */
/* 预览区内嵌在卡片里：圆角 + 主题色微光 + 一层淡淡的点阵 */
.preview {
  position: relative;
  display: grid;
  place-items: center;
  height: 168px;
  border-radius: 16px;
  /* 整块铺满：从上往下由浅主题色过渡到更淡，再叠一层柔和的顶光；细描边让预览区边界清楚 */
  background:
    radial-gradient(140% 100% at 50% 0%, color-mix(in srgb, var(--ac) 12%, transparent), transparent 75%),
    linear-gradient(180deg, color-mix(in srgb, var(--ac) 7%, var(--vp-c-bg)), color-mix(in srgb, var(--ac) 3%, var(--vp-c-bg)));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ac) 12%, transparent);
  overflow: hidden;
}
.preview::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(color-mix(in srgb, var(--vp-c-text-3) 28%, transparent) 1px, transparent 1px);
  background-size: 14px 14px;
  mask-image: radial-gradient(ellipse at 50% 40%, #000 20%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 40%, #000 20%, transparent 75%);
  opacity: 0.6;
  pointer-events: none;
}
.preview > * {
  position: relative;
}
.city-svg,
.stars-svg {
  width: 92%;
  max-width: 280px;
  height: 140px;
  overflow: visible;
}
/* 星图卡片：亮色主题是浅色天空，暗色主题才是夜空，和其它卡片保持统一 */
.stars-svg .lines line {
  stroke: var(--vp-c-text-3);
  stroke-opacity: 0.45;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.dark .k-stars .preview {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(108, 182, 245, 0.16), transparent 60%),
    #070a0f;
}
.dark .stars-svg .lines line {
  stroke: rgba(200, 225, 255, 0.4);
}
.st {
  filter: drop-shadow(0 0 4px currentColor);
  animation: pop 600ms var(--ease-out) both;
}
.bld {
  animation: rise 700ms var(--ease-out) backwards;
  transform-box: fill-box;
}
/* 悬停时预览「活」过来：楼长高、星星闪、token 跳一下、上下文继续被填满 */
.bld {
  transition: translate 500ms var(--ease-out);
}
.card:hover .bld:nth-child(2n) {
  translate: 0 -6px;
}
.card:hover .bld:nth-child(3n) {
  translate: 0 -3px;
}
.card:hover .st {
  animation: twinkle 1.6s ease-in-out infinite;
}
.card:hover .lines line {
  animation: flow 1.2s linear infinite;
}
@keyframes twinkle {
  50% {
    opacity: 0.45;
  }
}
@keyframes flow {
  to {
    stroke-dashoffset: -12;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    translate: 0 14px;
  }
}
.toks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  max-width: 92%;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}
.toks span {
  padding: 2px 4px;
  border-radius: 5px;
  animation: pop 500ms var(--ease-out) backwards;
  transition: transform 400ms var(--ease-out);
  transition-delay: calc(var(--i) * 40ms);
}
.card:hover .toks span {
  transform: translateY(-4px);
}
.t0 {
  background: rgba(108, 182, 245, 0.2);
  box-shadow: inset 0 -2px 0 #4b8fd6;
}
.t1 {
  background: rgba(61, 220, 154, 0.2);
  box-shadow: inset 0 -2px 0 #2fae82;
}
.t2 {
  background: rgba(240, 168, 104, 0.22);
  box-shadow: inset 0 -2px 0 #d98a3d;
}
.t3 {
  background: rgba(164, 139, 230, 0.22);
  box-shadow: inset 0 -2px 0 #8a6bd6;
}
.t4 {
  background: rgba(232, 138, 168, 0.2);
  box-shadow: inset 0 -2px 0 #d0628a;
}
.cells {
  display: grid;
  grid-template-columns: repeat(10, 14px);
  gap: 3px;
}
.cells span {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--vp-c-default-soft);
  animation: pop 400ms var(--ease-out) backwards;
  transition: background-color 300ms var(--ease-out);
}
/* 悬停前是空格子，悬停后按顺序一格格填上 */
.cells .f {
  background: var(--vp-c-default-soft);
}
.card:hover .cells .f {
  transition-delay: calc(var(--i) * 45ms);
}
.cells .a:not(.f),
.card:hover .cells .f.a {
  background: #4b8fd6;
}
.cells .b:not(.f),
.card:hover .cells .f.b {
  background: #2fae82;
}
.cells .c:not(.f),
.card:hover .cells .f.c {
  background: #c98a2e;
}
.cells .d:not(.f),
.card:hover .cells .f.d {
  background: #6fb4f0;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

/* ---------- 文字区 ---------- */
.body {
  position: relative;
  padding: 16px 12px 12px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.num {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
.tag i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ac);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac) 18%, transparent);
}
/* 右下角的圆形箭头：悬停时填上主题色 */
.go {
  position: absolute;
  right: 12px;
  top: 12px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  color: var(--vp-c-text-3);
  transition:
    background-color var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out),
    transform 400ms var(--ease-out);
}
.card:hover .go {
  border-color: var(--ac);
  background: var(--ac);
  color: #fff;
  transform: rotate(45deg);
}
.card.wide .go {
  top: 24px;
  right: 24px;
}
.body h2 {
  margin: 10px 0 0;
  padding: 0;
  border: 0;
  font-size: 1.1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.35;
  color: var(--vp-c-text-1);
}
.body p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}
.more {
  margin: 40px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

/* 中等宽度两列（第一张仍占满一行），手机一列 */
@media (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
    margin-top: 40px;
  }
  .card.wide {
    grid-column: auto;
    flex-direction: column;
  }
  .card.wide .preview {
    flex: none;
    min-height: 0;
    height: 168px;
  }
  .card.wide .body {
    padding: 16px 12px 12px;
  }
  .card.wide .go {
    top: 12px;
    right: 12px;
  }
  .card.wide h2 {
    font-size: 1.1rem;
  }
  .card.wide .city-svg {
    max-width: 280px;
    height: 140px;
  }
}
.ecg-svg {
  width: 82%;
  max-width: 280px;
  height: 120px;
  overflow: visible;
}
.ecg-svg path {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.ecg-svg .beat {
  stroke: var(--stable);
  stroke-dasharray: 400;
  animation: trace 1.6s var(--ease-out) backwards;
}
.ecg-svg .b2 {
  animation-delay: 0.5s;
}
.ecg-svg .flat {
  stroke: #d64545;
}
.ecg-svg .stall {
  fill: #d64545;
  opacity: 0.1;
}
.card:hover .ecg-svg .beat {
  filter: drop-shadow(0 0 4px var(--stable));
}
@keyframes trace {
  from {
    stroke-dashoffset: 400;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bld,
  .toks span,
  .cells span,
  .card:hover .st,
  .card:hover .lines line,
  .card {
    animation: none;
  }
}
</style>
