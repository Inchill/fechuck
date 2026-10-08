<script setup lang="ts">
// 实验室首页：几个和 AI 时代开发有关的互动小实验
import { withBase } from 'vitepress'

const items = [
  {
    href: '/lab/city.html',
    kind: 'city',
    tag: '回放',
    title: '建造回放',
    desc: '把这个网站的代码仓库画成一座城：每栋楼是一个文件，按 git 提交回放它是怎么一点点长出来的。'
  },
  {
    href: '/lab/stars.html',
    kind: 'stars',
    tag: '可视化',
    title: '文章星图',
    desc: '每颗星是一篇文章，内容越相近离得越近。位置和分组按正文自动算出，看看我都在写些什么。'
  },
  {
    href: '/lab/tokens.html',
    kind: 'tokens',
    tag: '工具',
    title: 'Token 显微镜',
    desc: '输入一段话，实时看它被模型切成哪些 token。中文、英文、代码、emoji 的差别一眼就能看出来。'
  },
  {
    href: '/lab/context.html',
    kind: 'context',
    tag: '演示',
    title: '上下文窗口模拟器',
    desc: '一句「提交代码」背后，Skill 是怎么分级加载的、上下文怎么一点点被填满、每一轮有多少命中了缓存。'
  }
]

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
const cells = Array.from({ length: 40 }, (_, i) => (i < 4 ? 'a' : i < 6 ? 'b' : i < 8 ? 'c' : i < 9 ? 'd' : ''))
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
    </header>

    <div class="grid">
      <a v-for="it in items" :key="it.href" class="card" :class="'k-' + it.kind" :href="withBase(it.href)" @mousemove="spot">
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
          <!-- Token 显微镜：一句话切成彩色小块 -->
          <div v-else-if="it.kind === 'tokens'" class="toks">
            <span v-for="(t, i) in toks" :key="i" :class="'t' + (i % 5)" :style="{ animationDelay: i * 70 + 'ms' }">{{ t }}</span>
          </div>
          <!-- 上下文模拟器：逐渐填满的格子 -->
          <div v-else class="cells">
            <span v-for="(c, i) in cells" :key="i" :class="c" :style="{ animationDelay: i * 25 + 'ms' }"></span>
          </div>
        </div>
        <div class="body">
          <div class="meta">
            <span class="tag">{{ it.tag }}</span>
            <span class="arrow">↗</span>
          </div>
          <h2>{{ it.title }}</h2>
          <p>{{ it.desc }}</p>
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.lab {
  max-width: 1080px;
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
}
.sub {
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  color: var(--vp-c-text-2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 48px;
}
.card {
  --mx: 50%;
  --my: 50%;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  transition:
    transform 500ms var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    box-shadow 500ms var(--ease-out);
}
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(360px circle at var(--mx) var(--my), var(--info-soft), transparent 60%);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.card:hover::before {
  opacity: 1;
}
.card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider));
  box-shadow: 0 24px 60px -26px rgba(16, 24, 32, 0.3);
}
.dark .card:hover {
  box-shadow: 0 30px 70px -24px rgba(0, 0, 0, 0.7);
}

/* ---------- 预览区 ---------- */
.preview {
  display: grid;
  place-items: center;
  height: 150px;
  border-bottom: 1px solid var(--vp-c-divider);
  background:
    radial-gradient(ellipse at 50% 0%, var(--info-soft), transparent 70%),
    var(--vp-c-bg);
}
.city-svg,
.stars-svg {
  width: 82%;
  height: 100%;
}
/* 星图卡片的预览：深色夜空，亮暗主题都一样 */
.k-stars .preview {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(108, 182, 245, 0.18), transparent 60%),
    #0a0e14;
}
.stars-svg .lines line {
  stroke: rgba(200, 225, 255, 0.35);
  stroke-width: 1;
}
.st {
  filter: drop-shadow(0 0 4px currentColor);
  animation: pop 600ms var(--ease-out) both;
}
.bld {
  animation: rise 700ms var(--ease-out) both;
  transform-box: fill-box;
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
  max-width: 80%;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}
.toks span {
  padding: 2px 4px;
  border-radius: 4px;
  animation: pop 500ms var(--ease-out) both;
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
  animation: pop 400ms var(--ease-out) both;
}
.cells .a {
  background: #4b8fd6;
}
.cells .b {
  background: #2fae82;
}
.cells .c {
  background: #c98a2e;
}
.cells .d {
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
  padding: 18px 22px 22px;
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}
.arrow {
  font-size: 16px;
  color: var(--vp-c-text-3);
  transition:
    transform var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out);
}
.card:hover .arrow {
  transform: translate(3px, -3px);
  color: var(--vp-c-brand-1);
}
.body h2 {
  margin: 12px 0 0;
  padding: 0;
  border: 0;
  font-size: 1.2rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.35;
  color: var(--vp-c-text-1);
}
.body p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

@media (prefers-reduced-motion: reduce) {
  .bld,
  .toks span,
  .cells span {
    animation: none;
  }
}
</style>
