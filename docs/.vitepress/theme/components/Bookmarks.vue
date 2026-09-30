<script setup lang="ts">
// 书签页：大标题 + 数字 → 精选三张 → 吸顶的分类 / 搜索 → 按分类编号的卡片墙
import { ref, computed } from 'vue'
import { data, type SiteItem } from '../../../bookmarks/bookmarks.data'

const { groups, featured } = data
const all = groups.flatMap((g) => g.sites)
const active = ref('') // 当前分类，空 = 全部
const q = ref('')

const shown = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return groups
    .map((g, i) => ({ ...g, no: String(i + 1).padStart(2, '0') }))
    .filter((g) => !active.value || g.name === active.value)
    .map((g) => ({
      ...g,
      sites: kw ? g.sites.filter((s) => `${s.title} ${s.host} ${s.note}`.toLowerCase().includes(kw)) : g.sites
    }))
    .filter((g) => g.sites.length)
})
const hits = computed(() => shown.value.reduce((n, g) => n + g.sites.length, 0))

// 没抓到图标时用衬线体首字母：英文取首字母，中文取第一个字
const initial = (s: SiteItem) => [...s.title.replace(/^[^\p{L}\p{N}]+/u, '')][0]?.toUpperCase() ?? '·'
const hideImg = (e: Event) => ((e.target as HTMLElement).style.display = 'none')
// 图标加载后：
// 1. 只有 16/32px 的小 favicon 放大会糊，改成居中小图
// 2. 图标底板默认白色（大多数 logo 是为浅色背景设计的）；
//    如果 logo 本身几乎是白色（白字、白线），底板换成深色，免得看不见
const fitImg = (e: Event) => {
  const img = e.target as HTMLImageElement
  const tile = img.parentElement
  if (img.naturalWidth && img.naturalWidth < 64) img.classList.add('small')
  tile?.classList.add('has-img')
  const { fill, lum } = analyze(img)
  // 铺满整块的方形图标（自带底色）直接满铺，不加白底留白
  if (fill > 0.9 && !img.classList.contains('small')) tile?.classList.add('bleed')
  else if (lum > 225) tile?.classList.add('on-dark')
}
function analyze(img: HTMLImageElement) {
  try {
    const n = 24
    const c = document.createElement('canvas')
    c.width = c.height = n
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, n, n)
    const d = ctx.getImageData(0, 0, n, n).data
    let sum = 0
    let count = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue // 只看不透明的像素
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      count++
    }
    return { fill: count / (n * n), lum: count ? sum / count : 0 }
  } catch {
    return { fill: 0, lum: 0 }
  }
}

function spot(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

/* ---------- 随便逛逛：像老虎机一样滚几下，停在一个网站上 ---------- */
const pick = ref<SiteItem | null>(null)
const rolling = ref(false)
let timer = 0
function roll() {
  if (!all.length || rolling.value) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let target = all[Math.floor(Math.random() * all.length)]
  if (all.length > 1) while (target === pick.value) target = all[Math.floor(Math.random() * all.length)]
  if (reduce) return void (pick.value = target)
  rolling.value = true
  let i = 0
  const tick = () => {
    if (++i >= 14) {
      pick.value = target
      rolling.value = false
      return
    }
    pick.value = all[Math.floor(Math.random() * all.length)]
    timer = window.setTimeout(tick, 40 + i * i * 1.1) // 越转越慢
  }
  clearTimeout(timer)
  tick()
}
</script>

<template>
  <div class="bm">
    <!-- ---------- 头部 ---------- -->
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4 2.5h8v11L8 10.5 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
        BOOKMARKS <i>/</i> 书签
      </div>
      <h1 class="headline">我常打开的<span class="grad">那些网站。</span></h1>
      <p class="sub">AI、电子书、课程、博客、工具和设计资源，还有一些好玩的。</p>
      <div class="stats">
        <div class="big">
          <b>{{ all.length }}</b><span>个网站</span>
          <em>·</em>
          <b class="sm">{{ groups.length }}</b><span>个分类</span>
        </div>
        <button type="button" class="dice" :disabled="rolling" @click="roll">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4" /><circle cx="5.6" cy="5.6" r="1" fill="currentColor" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="10.4" cy="10.4" r="1" fill="currentColor" /></svg>
          随便逛逛
        </button>
      </div>

      <Transition name="pick">
        <div v-if="pick" class="pick" :class="{ rolling }">
          <div class="ico big">
            <span>{{ initial(pick) }}</span>
            <img v-if="pick.icon" :key="pick.icon" :src="pick.icon" alt="" @load="fitImg" @error="hideImg" />
          </div>
          <div class="pick-main">
            <div class="pick-title">{{ pick.title }}</div>
            <div class="pick-note">{{ pick.note || pick.host }}</div>
          </div>
          <div class="pick-actions">
            <a class="go" :href="pick.url" target="_blank" rel="noopener" :tabindex="rolling ? -1 : 0">去看看 →</a>
            <button type="button" class="close" aria-label="关闭" @click="pick = null">×</button>
          </div>
        </div>
      </Transition>
    </header>

    <!-- ---------- 精选 ---------- -->
    <section v-if="featured.length" class="feat">
      <div class="sec-head">
        <h2>先从这里逛起</h2>
        <span>{{ featured.length }} 个入口</span>
      </div>
      <div class="feat-grid">
        <a v-for="(f, i) in featured" :key="f.url" class="fcard" :class="`v${i % 3}`" :href="f.url" target="_blank" rel="noopener" @mousemove="spot">
          <div class="flabel">{{ f.label }}</div>
          <span class="arrow" aria-hidden="true">↗</span>
          <div class="ico huge">
            <span>{{ initial(f) }}</span>
            <img v-if="f.icon" :src="f.icon" alt="" @load="fitImg" @error="hideImg" />
          </div>
          <div class="ftitle">{{ f.title }}</div>
          <p class="fnote">{{ f.note }}</p>
        </a>
      </div>
    </section>

    <!-- ---------- 吸顶工具条 ---------- -->
    <div class="toolbar">
      <div class="chips" role="tablist" aria-label="分类">
        <button type="button" :class="{ on: !active }" @click="active = ''">全部</button>
        <button v-for="g in groups" :key="g.name" type="button" :class="{ on: active === g.name }" @click="active = active === g.name ? '' : g.name">
          {{ g.name }}
        </button>
      </div>
      <label class="search">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        <input v-model="q" type="search" placeholder="搜索书签" aria-label="搜索书签" />
        <span v-if="q" class="hits">{{ hits }}</span>
      </label>
    </div>

    <!-- ---------- 分类 ---------- -->
    <section v-for="g in shown" :key="g.name" class="group">
      <div class="sec-head">
        <h2><i>{{ g.no }}</i>{{ g.name }}</h2>
        <span>{{ g.sites.length }} 个网站</span>
      </div>
      <p v-if="g.desc" class="gdesc">{{ g.desc }}</p>
      <div class="grid">
        <a v-for="s in g.sites" :key="s.url" class="site" :href="s.url" target="_blank" rel="noopener" @mousemove="spot">
          <div class="head">
            <div class="ico">
              <span>{{ initial(s) }}</span>
              <img v-if="s.icon" :src="s.icon" alt="" loading="lazy" @load="fitImg" @error="hideImg" />
            </div>
            <div class="name">
              <div class="title">{{ s.title }}</div>
              <div class="host">{{ s.host }}</div>
            </div>
          </div>
          <p v-if="s.note" class="note">{{ s.note }}</p>
          <span class="arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
    <p v-if="!shown.length" class="empty">没有找到和「{{ q }}」相关的网站。</p>
  </div>
</template>

<style scoped>
.bm {
  --serif: 'Iowan Old Style', 'Palatino Linotype', Georgia, 'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', serif;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip; /* 头部柔光不撑出横向滚动条 */
}

/* ================= 头部 ================= */
.hero {
  position: relative;
  padding: clamp(48px, 9vh, 96px) 0 0;
}
.hero::before {
  /* 右上角一团品牌色柔光 */
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
.stats {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 36px;
  padding-top: 22px;
  border-top: 1px solid var(--vp-c-divider);
}
.big {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap; /* 「个网站」不能被挤成两行 */
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.big b {
  font-family: var(--vp-font-family-mono);
  font-size: clamp(2.6rem, 6vw, 3.6rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--vp-c-text-1);
}
.big b.sm {
  font-size: clamp(1.6rem, 3.4vw, 2rem);
}
.big em {
  margin: 0 6px;
  font-style: normal;
  color: var(--vp-c-text-3);
}
.dice {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 7px;
  white-space: nowrap;
  height: 38px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    linear-gradient(100deg, var(--info), var(--stable)) border-box;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: box-shadow var(--dur-base) var(--ease-out);
}
.dice svg {
  color: var(--vp-c-brand-1);
  transition: transform 500ms var(--ease-out);
}
.dice:hover {
  box-shadow: 0 10px 28px -10px color-mix(in srgb, var(--info) 60%, transparent);
}
.dice:hover svg {
  transform: rotate(90deg);
}

/* 随便逛逛的结果 */
.pick {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 16px 16px 16px 18px;
  border: 1px solid transparent;
  border-radius: 20px;
  background:
    linear-gradient(var(--vp-c-bg-alt), var(--vp-c-bg-alt)) padding-box,
    linear-gradient(100deg, var(--info), var(--stable)) border-box;
  box-shadow: 0 18px 40px -22px color-mix(in srgb, var(--info) 50%, transparent);
}
.pick-main {
  flex: 1;
  min-width: 0;
}
.pick-title {
  font-size: 16px;
  font-weight: 650;
}
.pick-note {
  margin-top: 2px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pick.rolling .pick-title,
.pick.rolling .pick-note {
  opacity: 0.55;
}
.pick-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.go {
  padding: 7px 16px;
  border-radius: 999px;
  background: linear-gradient(100deg, var(--info), var(--stable));
  /* 亮色下渐变偏深，配白字；暗色下渐变偏亮，配深色字 */
  color: var(--vp-c-bg);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-decoration: none;
  box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--info) 70%, transparent);
  transition:
    filter var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out),
    opacity var(--dur-fast);
}
.go:hover {
  filter: brightness(1.1);
  box-shadow: 0 10px 22px -8px color-mix(in srgb, var(--info) 80%, transparent);
}
.pick.rolling .go {
  opacity: 0.4;
  pointer-events: none;
}
.close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  color: var(--vp-c-text-3);
}
.close:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}
.pick-enter-active,
.pick-leave-active {
  transition:
    opacity 240ms var(--ease-out),
    translate 320ms var(--ease-out);
}
.pick-enter-from,
.pick-leave-to {
  opacity: 0;
  translate: 0 -6px;
}

/* ================= 通用：小节标题 ================= */
.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.sec-head h2 {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0;
  font-size: 1.3rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.sec-head h2 i {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  color: var(--stable);
}
.sec-head > span {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

/* ================= 图标 ================= */
.ico {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  overflow: hidden;
}
.ico img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* 有图标时：白色底板 + 细边，logo 四周留白（选择器加 .bm 提高优先级，精选卡片里也生效） */
.bm .ico.has-img {
  background: #fff;
  border: 0;
  box-shadow: inset 0 0 0 1px rgba(16, 24, 32, 0.08);
}
.bm .ico.has-img img:not(.small) {
  inset: 14%;
  width: 72%;
  height: 72%;
}
.bm .ico.has-img.on-dark {
  background: #161b22;
}
.bm .ico.has-img.bleed img {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bm .ico.has-img > span {
  visibility: hidden;
}
.ico img.small {
  inset: 50%;
  width: 22px;
  height: 22px;
  translate: -50% -50%;
  object-fit: contain;
}
.ico.big {
  width: 44px;
  height: 44px;
}
.ico.huge {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  font-size: 36px;
}
.ico.huge img.small {
  width: 32px;
  height: 32px;
}

/* ================= 精选 ================= */
.feat {
  margin-top: 72px;
}
.feat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 20px;
}
.fcard {
  --mx: 50%;
  --my: 50%;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 250px;
  padding: 22px 24px 26px;
  border-radius: 20px;
  border: 1px solid var(--vp-c-divider);
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  transition:
    transform 500ms var(--ease-out),
    box-shadow 500ms var(--ease-out);
}
.fcard:hover {
  transform: translateY(-4px);
  box-shadow: 0 24px 60px -26px rgba(16, 24, 32, 0.35);
}
.fcard::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(360px circle at var(--mx) var(--my), var(--hl, var(--info-soft)), transparent 60%);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.fcard:hover::before {
  opacity: 1;
}
.flabel {
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
}
.fcard .ico {
  margin-top: 28px;
}
.ftitle {
  margin-top: auto;
  padding-top: 28px;
  font-size: 1.3rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.fnote {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.65;
}
/* 三张卡三种性格：反色 / 品牌色 / 素色 */
.fcard.v0 {
  --hl: rgba(255, 255, 255, 0.08);
  background: var(--vp-c-text-1);
  border-color: transparent;
  color: var(--vp-c-bg);
}
.fcard.v0 .flabel,
.fcard.v0 .fnote {
  color: color-mix(in srgb, var(--vp-c-bg) 72%, transparent);
}
.fcard.v0 .ico:not(.has-img) {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.fcard.v0 .arrow {
  color: color-mix(in srgb, var(--vp-c-bg) 60%, transparent);
}
.fcard.v1 {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 25%, transparent);
  background: linear-gradient(160deg, color-mix(in srgb, var(--info) 14%, var(--vp-c-bg)), color-mix(in srgb, var(--stable) 10%, var(--vp-c-bg)));
  color: var(--vp-c-text-1);
}
.fcard.v1 .flabel,
.fcard.v1 .ftitle {
  color: var(--vp-c-brand-1);
}
.fcard.v1 .fnote {
  color: var(--vp-c-text-2);
}
.fcard.v1 .ico:not(.has-img) {
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
}
.fcard.v2 {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
}
.fcard.v2 .flabel,
.fcard.v2 .fnote {
  color: var(--vp-c-text-2);
}
.fcard.v2 .ico:not(.has-img) {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}

/* ================= 吸顶工具条 ================= */
.toolbar {
  position: sticky;
  top: var(--vp-nav-height);
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 56px calc(-1 * clamp(20px, 5vw, 48px)) 0;
  padding: 12px clamp(20px, 5vw, 48px);
  background: color-mix(in srgb, var(--vp-c-bg) 78%, transparent);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid transparent;
  transition:
    top 320ms var(--ease-out),
    border-color var(--dur-base);
}
@media (min-width: 960px) {
  /* 导航栏下滑隐藏时，工具条顶上去 */
  html.nav-hidden .toolbar {
    top: 0;
  }
}
@media (max-width: 959px) {
  /* 手机上导航栏不固定，工具条贴顶 */
  .toolbar {
    top: 0;
  }
}
.chips {
  display: flex;
  flex-wrap: wrap; /* 分类多了就换行，桌面端一眼看全 */
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chips button {
  flex: none;
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
  transition:
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}
.chips button:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}
.chips button.on {
  color: var(--vp-c-bg);
  background: var(--vp-c-text-1);
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  width: 220px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  transition: border-color var(--dur-fast) var(--ease-out);
}
.search:focus-within {
  border-color: var(--vp-c-brand-1);
}
.search input {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  color: var(--vp-c-text-1);
  background: transparent;
}
.hits {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-brand-1);
}

/* ================= 分类卡片 ================= */
.group {
  margin-top: 48px;
  scroll-margin-top: 140px;
}
.gdesc {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-3);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 20px;
}
.site {
  --mx: 50%;
  --my: 50%;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  transition:
    transform 400ms var(--ease-out),
    border-color var(--dur-base) var(--ease-out),
    background-color var(--dur-base) var(--ease-out),
    box-shadow 400ms var(--ease-out);
}
.dark .site {
  background: var(--vp-c-bg-alt);
}
.site::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(300px circle at var(--mx) var(--my), var(--info-soft), transparent 60%);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.site:hover::before {
  opacity: 1;
}
.site:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, var(--vp-c-divider));
  box-shadow: 0 18px 44px -24px rgba(16, 24, 32, 0.3);
}
.dark .site:hover {
  box-shadow: 0 22px 50px -22px rgba(0, 0, 0, 0.75);
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.name {
  min-width: 0;
  padding-right: 18px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}
.host {
  margin-top: 3px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.arrow {
  position: absolute;
  top: 18px;
  right: 20px;
  font-size: 15px;
  color: var(--vp-c-text-3);
  transition:
    transform var(--dur-base) var(--ease-out),
    color var(--dur-base) var(--ease-out);
}
.site:hover .arrow,
.fcard:hover .arrow {
  transform: translate(3px, -3px);
  color: var(--vp-c-brand-1);
}
.fcard.v0:hover .arrow {
  color: var(--vp-c-bg);
}
.empty {
  margin-top: 48px;
  color: var(--vp-c-text-3);
}

@media (max-width: 480px) {
  /* 窄屏：数字缩小，放不下时「随便逛逛」换到下一行 */
  .stats {
    flex-wrap: wrap;
    align-items: center;
  }
  .big {
    gap: 6px;
  }
  .big b {
    font-size: 2.4rem;
  }
  .big b.sm {
    font-size: 1.5rem;
  }
  .big em {
    margin: 0 2px;
  }
  .dice {
    height: 34px;
    padding: 0 14px;
    font-size: 13px;
  }
}
@media (max-width: 768px) {
  .feat-grid {
    grid-template-columns: 1fr;
  }
  .fcard {
    min-height: 0;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  /* 手机上横向滑动，不占太多高度 */
  .chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    mask-image: linear-gradient(90deg, #000 85%, transparent);
  }
  .search {
    width: 100%;
    order: -1;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .pick {
    flex-wrap: wrap;
  }
  .pick-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
