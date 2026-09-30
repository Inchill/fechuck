<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { withBase } from 'vitepress'
import { data as posts } from '../posts.data'
import { data as notes } from '../notes.data'
import HomeTerminal from './HomeTerminal.vue'
import { scramble } from '../motion'

// ---------- 数据 ----------
const latest = posts[0]
const recent = posts.slice(1, 5)
const latestNote = notes[0]

const totalWords = posts.reduce((s, p) => s + (p.words || 0), 0)
const years = [...new Set(posts.map((p) => p.year).filter(Boolean))].sort()
const firstYear = years[0] ?? ''

// 统计数字：SSR 直接给终值，进入视口后在客户端从 0 滚上来
const stat = ref({ posts: posts.length, notes: notes.length, words: totalWords })
const wordsLabel = computed(() => {
  const w = stat.value.words
  return w >= 10000 ? (w / 10000).toFixed(1) : String(w)
})
const wordsUnit = totalWords >= 10000 ? '万字' : '字'

// 写作热力：从最早年份到最近年份，每年 12 格
const activity = computed(() => {
  const count = new Map<string, number>()
  for (const p of posts) {
    const key = p.date.slice(0, 7)
    if (key) count.set(key, (count.get(key) ?? 0) + 1)
  }
  return years.map((y) => ({
    year: y,
    months: Array.from({ length: 12 }, (_, i) => {
      const key = `${y}-${String(i + 1).padStart(2, '0')}`
      const n = count.get(key) ?? 0
      return { key, n, level: Math.min(n, 3) }
    })
  }))
})

// 2024-06-05 -> 2024.06.05 / 06.05
const fmt = (d: string) => (d ? d.replaceAll('-', '.') : '')
const md = (d: string) => (d ? d.slice(5).replace('-', '.') : '')

// ---------- 交互 ----------
const root = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const pillTitle = ref<HTMLElement | null>(null)
let rafId = 0
let onScroll: (() => void) | null = null
let io: IntersectionObserver | null = null

// 卡片聚光：鼠标位置写进 --mx / --my
function spot(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function countUp() {
  const target = { posts: posts.length, notes: notes.length, words: totalWords }
  const start = performance.now()
  const dur = 1200
  const tick = (t: number) => {
    const k = Math.min(1, (t - start) / dur)
    const e = 1 - Math.pow(1 - k, 3)
    stat.value = {
      posts: Math.round(target.posts * e),
      notes: Math.round(target.notes * e),
      words: Math.round(target.words * e)
    }
    if (k < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

onMounted(() => {
  // 顶部「最新」胶囊：标题随胶囊升起时「解码」出来
  if (pillTitle.value && latest) {
    setTimeout(() => scramble(pillTitle.value!, latest.title, 900), 150)
  }

  const el = root.value
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // 1) 终端「立起来」：随滚动从后仰 → 平视（--tp: 0 → 1），背景光晕视差（--sy）
  if (!reduced) {
    onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const vh = window.innerHeight
        const st = stage.value
        if (st) {
          const top = st.getBoundingClientRect().top
          const tp = Math.min(1, Math.max(0, (vh * 0.9 - top) / (vh * 0.6)))
          st.style.setProperty('--tp', tp.toFixed(3))
        }
        el.style.setProperty('--sy', String(Math.min(1, window.scrollY / vh)))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()
  }

  // 2) 滚动渐入：已在视口内的直接显示，其余隐藏后等进入视口
  const items = [...el.querySelectorAll<HTMLElement>('[data-reveal]')]
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach((i) => i.classList.add('in'))
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue
        const t = en.target as HTMLElement
        t.classList.add('in')
        if (t.dataset.count !== undefined) countUp()
        io?.unobserve(t)
      }
    },
    // 顶部留超大 margin：快速跳过（End 键、锚点）的卡片也算「已进入」，不会一直隐藏
    { rootMargin: '100000px 0px -10% 0px', threshold: 0.01 }
  )
  items.forEach((i) => io!.observe(i))
  el.classList.add('reveal-ready')
})

onBeforeUnmount(() => {
  if (onScroll) {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  }
  if (rafId) cancelAnimationFrame(rafId)
  io?.disconnect()
})
</script>

<template>
  <div class="home" ref="root">
    <!-- 背景：点阵 + 两块柔光，随滚动微漂 -->
    <div class="home-bg" aria-hidden="true">
      <div class="grid"></div>
      <div class="glow g1"></div>
      <div class="glow g2"></div>
    </div>

    <!-- ================= Hero ================= -->
    <section class="hero">
      <a v-if="latest" :href="latest.url" class="pill rise" style="--d: 0ms">
        <span class="pill-dot"></span>
        <span class="pill-label">最新</span>
        <span class="pill-title" ref="pillTitle">{{ latest.title }}</span>
        <span class="pill-arrow">›</span>
      </a>

      <h1 class="headline">
        <span class="rise" style="--d: 80ms">写代码，</span>
        <span class="rise grad" style="--d: 180ms">也写思考。</span>
      </h1>

      <p class="sub rise" style="--d: 280ms">
        你好，我是休言。这里放着我写的技术文章，<br class="br" />和一些随手记下的想法，随便看看。
      </p>

      <div class="cta rise" style="--d: 360ms">
        <a href="/posts/" class="btn primary">开始阅读</a>
        <a href="/about/" class="btn link">关于我 <span aria-hidden="true">›</span></a>
      </div>

      <!-- 终端舞台：带 3D 后仰，滚动时立起 -->
      <div class="stage rise" style="--d: 480ms" ref="stage">
        <div class="stage-glow" aria-hidden="true"></div>
        <div class="stage-tilt">
          <HomeTerminal />
        </div>
      </div>
    </section>

    <!-- ================= Bento ================= -->
    <section class="bento-wrap">
      <header class="sec-head" data-reveal>
        <h2>最近在写。</h2>
        <p>长文、随想，和一点点数字。</p>
      </header>

      <div class="bento">
        <!-- 最新文章：大卡 -->
        <a v-if="latest" :href="latest.url" class="card featured" data-reveal style="--d: 0ms" @pointermove="spot">
          <span class="watermark" aria-hidden="true">{{ latest.year }}</span>
          <div class="featured-body">
            <span class="badge">最新文章</span>
            <h3>{{ latest.title }}</h3>
            <p v-if="latest.excerpt">{{ latest.excerpt }}</p>
          </div>
          <div class="featured-foot">
            <time>{{ fmt(latest.date) }}</time>
            <span class="more">阅读全文 <span aria-hidden="true">→</span></span>
          </div>
        </a>

        <!-- 数字 -->
        <div class="card stats" data-reveal data-count style="--d: 80ms" @pointermove="spot">
          <span class="label">写作</span>
          <div class="big">
            <span class="num grad">{{ stat.posts }}</span><span class="unit">篇文章</span>
          </div>
          <div class="mini">
            <div><b>{{ wordsLabel }}</b> {{ wordsUnit }}</div>
            <div><b>{{ stat.notes }}</b> 条随想</div>
            <div v-if="firstYear">始于 <b>{{ firstYear }}</b></div>
          </div>
        </div>

        <!-- 关于 -->
        <a href="/about/" class="card about" data-reveal style="--d: 160ms" @pointermove="spot">
          <img :src="withBase('/logo.svg')" alt="" class="avatar" width="44" height="44" />
          <div>
            <h3>休言</h3>
            <p>软件工程师，写点技术，也写点想法。</p>
          </div>
          <span class="corner-arrow" aria-hidden="true">↗</span>
        </a>

        <!-- 更早的文章 -->
        <div class="card recent" data-reveal style="--d: 0ms" @pointermove="spot">
          <div class="card-head">
            <span class="label">更多文章</span>
            <a href="/posts/" class="head-link">全部 ›</a>
          </div>
          <ul>
            <li v-for="p in recent" :key="p.url">
              <a :href="p.url">
                <span class="t">{{ p.title }}</span>
                <time>{{ md(p.date) }}</time>
              </a>
            </li>
          </ul>
        </div>

        <!-- 最新随想 -->
        <a v-if="latestNote" :href="latestNote.url" class="card note" data-reveal style="--d: 80ms" @pointermove="spot">
          <span class="label">随想</span>
          <span class="quote" aria-hidden="true">“</span>
          <h3>{{ latestNote.title }}</h3>
          <p v-if="latestNote.excerpt">{{ latestNote.excerpt }}</p>
          <time>{{ fmt(latestNote.date) }}</time>
        </a>

        <!-- 写作热力 -->
        <div class="card activity" data-reveal style="--d: 0ms" @pointermove="spot">
          <div class="card-head">
            <span class="label">写作节奏</span>
            <span class="legend">
              少 <i class="c l0"></i><i class="c l1"></i><i class="c l2"></i><i class="c l3"></i> 多
            </span>
          </div>
          <div class="heat">
            <div v-for="y in activity" :key="y.year" class="heat-row">
              <span class="heat-year">{{ y.year }}</span>
              <div class="heat-cells">
                <i
                  v-for="m in y.months"
                  :key="m.key"
                  :class="['c', 'l' + m.level]"
                  :title="`${m.key.replace('-', '.')} · ${m.n} 篇`"
                ></i>
              </div>
            </div>
            <div class="heat-row axis" aria-hidden="true">
              <span class="heat-year"></span>
              <div class="heat-cells">
                <span v-for="n in 12" :key="n">{{ n % 3 === 1 ? n + '月' : '' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 订阅 -->
        <a href="/feed.xml" class="card rss" data-reveal style="--d: 80ms" @pointermove="spot">
          <span class="rss-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M5 19a1 1 0 1 0 0-.01M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" /></svg>
          </span>
          <h3>订阅更新</h3>
          <p>RSS 一把梭，新文章第一时间送达。</p>
          <span class="corner-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  --edge: clamp(20px, 5vw, 48px);
  position: relative;
  overflow-x: clip;
}

/* ================= 背景 ================= */
.home-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.home-bg .grid {
  position: absolute;
  inset: -10% 0 0;
  background-image: radial-gradient(circle at 1px 1px, var(--vp-c-divider) 1px, transparent 0);
  background-size: 28px 28px;
  opacity: 0.35;
  transform: translate3d(0, calc(var(--sy, 0) * -30px), 0);
  -webkit-mask-image: radial-gradient(90% 60% at 50% 0%, #000 30%, transparent 80%);
  mask-image: radial-gradient(90% 60% at 50% 0%, #000 30%, transparent 80%);
}
.dark .home-bg .grid { opacity: 0.5; }
.home-bg .glow {
  position: absolute;
  width: 60vmax;
  height: 60vmax;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  will-change: transform;
}
.home-bg .g1 {
  top: -30vmax;
  left: 50%;
  margin-left: -45vmax;
  background: radial-gradient(closest-side, var(--info-soft), transparent);
  transform: translate3d(0, calc(var(--sy, 0) * -80px), 0);
}
.home-bg .g2 {
  top: -20vmax;
  left: 50%;
  margin-left: -5vmax;
  background: radial-gradient(closest-side, var(--stable-soft), transparent);
  transform: translate3d(0, calc(var(--sy, 0) * -40px), 0);
}
.dark .home-bg .glow { opacity: 0.9; }

.hero,
.bento-wrap {
  position: relative;
  z-index: 1;
}

/* ================= Hero ================= */
.hero {
  padding: clamp(56px, 11vh, 120px) var(--edge) 0;
  text-align: center;
}

/* 顶部「最新」胶囊 */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  padding: 6px 14px 6px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: color-mix(in srgb, var(--vp-c-bg) 70%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  font-size: 13.5px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: border-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out);
}
.pill:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.pill-dot {
  width: 7px;
  height: 7px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--stable);
  box-shadow: 0 0 0 0 var(--stable);
  animation: pulse 2.4s var(--ease-out) infinite;
}
.pill-label {
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.pill-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 22em;
}
.pill-arrow {
  transition: transform var(--dur-base) var(--ease-out);
}
.pill:hover .pill-arrow { transform: translateX(3px); }

/* 大标题 */
.headline {
  margin: 28px auto 0;
  font-size: clamp(2.6rem, 7.2vw, 5.6rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.035em;
  color: var(--vp-c-text-1);
}
.headline > span { display: block; }
.grad {
  background: linear-gradient(100deg, var(--info) 10%, var(--stable) 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.sub {
  max-width: 38em;
  margin: 24px auto 0;
  font-size: clamp(1.02rem, 1.6vw, 1.25rem);
  line-height: 1.65;
  color: var(--vp-c-text-2);
  text-wrap: balance;
}

/* 按钮 */
.cta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 28px;
  margin-top: 36px;
}
.btn {
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  transition: all var(--dur-base) var(--ease-out);
}
.btn.primary {
  padding: 11px 24px;
  border-radius: 999px;
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.btn.primary:hover {
  transform: scale(1.04);
  box-shadow: 0 8px 30px -6px var(--info);
}
.btn.link {
  color: var(--vp-c-brand-1);
}
.btn.link:hover { text-decoration: underline; text-underline-offset: 4px; }

/* 终端舞台 */
.stage {
  --tp: 1;
  position: relative;
  max-width: 880px;
  margin: clamp(48px, 8vh, 80px) auto 0;
  perspective: 1400px;
}
.stage-tilt {
  transform-origin: 50% 100%;
  transform:
    rotateX(calc((1 - var(--tp)) * 22deg))
    scale(calc(0.9 + var(--tp) * 0.1));
  will-change: transform;
}
.stage-glow {
  position: absolute;
  inset: 10% 5% -8%;
  background: linear-gradient(100deg, var(--info), var(--stable));
  filter: blur(70px);
  opacity: calc(0.12 + var(--tp) * 0.18);
  border-radius: 40%;
}
.dark .stage-glow { opacity: calc(0.18 + var(--tp) * 0.22); }

/* 首屏依次升起 */
.rise {
  opacity: 0;
  transform: translateY(18px);
  animation: rise 900ms var(--ease-out) forwards;
  animation-delay: calc(var(--d, 0ms) + 100ms);
}
.headline > .rise { filter: blur(6px); }

/* ================= Bento ================= */
.bento-wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: clamp(96px, 16vh, 160px) var(--edge) clamp(80px, 12vh, 140px);
}
.sec-head {
  margin-bottom: 40px;
}
.sec-head h2 {
  margin: 0;
  font-size: clamp(2rem, 4.4vw, 3.4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.sec-head p {
  margin: 12px 0 0;
  font-size: clamp(1rem, 1.4vw, 1.2rem);
  color: var(--vp-c-text-2);
}

.bento {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: minmax(180px, auto);
  gap: 16px;
}

.card {
  --mx: 50%;
  --my: 50%;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid var(--vp-c-divider);
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
/* 鼠标聚光 */
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(420px circle at var(--mx) var(--my), var(--info-soft), transparent 60%);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.card:hover::before { opacity: 1; }
a.card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider));
  box-shadow: 0 24px 60px -24px rgba(16, 24, 32, 0.25);
}
.dark a.card:hover { box-shadow: 0 30px 70px -20px rgba(0, 0, 0, 0.7); }

.card h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.35;
}
.card p {
  margin: 10px 0 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}
.label {
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-link {
  font-size: 13.5px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.head-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.corner-arrow {
  position: absolute;
  top: 22px;
  right: 24px;
  font-size: 18px;
  color: var(--vp-c-text-3);
  transition: transform var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out);
}
a.card:hover .corner-arrow {
  transform: translate(3px, -3px);
  color: var(--vp-c-brand-1);
}

/* 最新文章 */
.featured {
  grid-column: span 4;
  grid-row: span 2;
  justify-content: space-between;
  padding: 40px;
  min-height: 380px;
  background:
    radial-gradient(120% 90% at 100% 0%, var(--info-soft), transparent 55%),
    radial-gradient(90% 80% at 0% 100%, var(--stable-soft), transparent 60%),
    var(--vp-c-bg-alt);
}
.watermark {
  position: absolute;
  right: -0.06em;
  bottom: -0.28em;
  z-index: -1;
  font-family: var(--vp-font-family-base);
  font-size: clamp(7rem, 16vw, 12rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.06em;
  color: transparent;
  -webkit-text-stroke: 1px var(--vp-c-divider);
  opacity: 0.9;
  user-select: none;
}
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--stable);
  background: var(--stable-soft);
}
.featured h3 {
  margin-top: 20px;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.2;
  max-width: 16em;
}
.featured p {
  font-size: clamp(15px, 1.3vw, 17px);
  max-width: 34em;
  margin-top: 16px;
}
.featured-foot {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 32px;
  font-size: 14px;
  color: var(--vp-c-text-3);
}
.more {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}
.more span {
  display: inline-block;
  transition: transform var(--dur-base) var(--ease-out);
}
.featured:hover .more span { transform: translateX(4px); }

/* 数字 */
.stats {
  grid-column: span 2;
  justify-content: space-between;
}
.big {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 8px;
}
.num {
  font-size: 4.2rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}
.unit {
  font-size: 15px;
  color: var(--vp-c-text-2);
}
.mini {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 16px;
  font-size: 13.5px;
  color: var(--vp-c-text-3);
}
.mini b {
  color: var(--vp-c-text-1);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 关于 */
.about {
  grid-column: span 2;
  gap: 16px;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

/* 更多文章 */
.recent {
  grid-column: span 3;
}
.recent ul {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
.recent li + li { border-top: 1px solid var(--vp-c-divider); }
.recent li a {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 12px 0;
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-size: 15px;
  transition: color var(--dur-fast) var(--ease-out), padding var(--dur-base) var(--ease-out);
}
.recent li a:hover {
  color: var(--vp-c-brand-1);
  padding-left: 6px;
}
.recent .t {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent time {
  margin-left: auto;
  flex: none;
  font-size: 13px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-3);
}

/* 随想 */
.note {
  grid-column: span 3;
}
.note .quote {
  position: absolute;
  top: -10px;
  right: 20px;
  z-index: -1;
  font-size: 160px;
  line-height: 1;
  font-family: Georgia, serif;
  color: var(--vp-c-divider);
}
.note h3 { margin-top: 16px; }
.note time {
  margin-top: auto;
  padding-top: 16px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

/* 写作节奏 */
.activity {
  grid-column: span 4;
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.legend .c {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.heat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}
.heat-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.heat-year {
  width: 3em;
  flex: none;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}
.heat-cells {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 6px;
}
.heat-cells .c {
  aspect-ratio: 1.6;
  border-radius: 6px;
  transition: transform var(--dur-fast) var(--ease-out);
}
.heat-cells .c:hover { transform: scale(1.12); }
.c.l0 { background: var(--vp-c-bg-soft); box-shadow: inset 0 0 0 1px var(--border-soft); }
.c.l1 { background: color-mix(in srgb, var(--stable) 35%, transparent); }
.c.l2 { background: color-mix(in srgb, var(--stable) 65%, transparent); }
.c.l3 { background: var(--stable); }
.axis .heat-cells span {
  font-size: 11px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

/* 订阅 */
.rss {
  grid-column: span 2;
  justify-content: flex-end;
}
.rss-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: auto;
  border-radius: 12px;
  background: var(--leak-soft);
}
.rss-icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: var(--leak);
  stroke-width: 2.2;
  stroke-linecap: round;
}

/* ================= 滚动渐入 ================= */
.reveal-ready [data-reveal]:not(.in) {
  opacity: 0;
  transform: translateY(32px) scale(0.98);
}
.reveal-ready [data-reveal] {
  transition:
    opacity 900ms var(--ease-out) var(--d, 0ms),
    transform 900ms var(--ease-out) var(--d, 0ms),
    border-color var(--dur-base) var(--ease-out),
    box-shadow 500ms var(--ease-out);
}
.reveal-ready a.card.in:hover {
  transition-delay: 0ms;
}

/* ================= 响应式 ================= */
@media (max-width: 960px) {
  .bento { grid-template-columns: repeat(2, 1fr); }
  .featured,
  .activity { grid-column: span 2; }
  .stats,
  .about,
  .recent,
  .note,
  .rss { grid-column: span 1; }
  .recent,
  .note,
  .rss { grid-column: span 2; }
  .featured { min-height: 320px; padding: 32px; }
}
@media (max-width: 640px) {
  /* 手机上终端平放：窄屏里 3D 后仰显得别扭，光晕也收一收 */
  .stage-tilt { transform: none; }
  .stage { margin-top: 36px; perspective: none; }
  .stage-glow { inset: 20% 10% -4%; filter: blur(48px); }
  .hero { padding-top: 40px; }
  .headline { margin-top: 20px; }
  .sub { margin-top: 16px; }
  .cta { margin-top: 24px; }
  .bento-wrap { padding-top: 72px; padding-bottom: 64px; }
  .sec-head { margin-bottom: 24px; }
  .br { display: none; }
  .cta { gap: 20px; }
  .pill-title { max-width: 12em; }
  .bento { grid-template-columns: 1fr; }
  .bento > .card { grid-column: span 1; }
  .featured { padding: 28px; min-height: 280px; }
  .card { border-radius: 22px; padding: 24px; }
  .heat-cells { gap: 4px; }
  .heat-cells .c { border-radius: 4px; }
}

@media (prefers-reduced-motion: reduce) {
  .rise {
    opacity: 1;
    transform: none;
    filter: none !important;
    animation: none;
  }
  .stage-tilt { transform: none; }
  .home-bg .glow,
  .home-bg .grid { transform: none; }
  .pill-dot { animation: none; }
}

@keyframes rise {
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--stable) 60%, transparent); }
  70%, 100% { box-shadow: 0 0 0 8px transparent; }
}
</style>
