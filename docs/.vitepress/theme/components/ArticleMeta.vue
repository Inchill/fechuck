<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useData } from 'vitepress'
import { data as posts } from '../posts.data'
import { data as notes } from '../notes.data'
import ReadAloud from './ReadAloud.vue'

const { page } = useData()

// 文章页（20xx/*.md）和随想详情页（notes/*.md，不含列表页）
const isArticle = computed(() => /^(20\d\d|notes)\/(?!index\.md$).+/.test(page.value.relativePath))

const post = computed(() => {
  const here = '/' + page.value.relativePath.replace(/\.md$/, '')
  const same = (u: string) => u.replace(/\.html$/, '') === here
  return posts.find((p) => same(p.url)) ?? notes.find((n) => same(n.url))
})

const date = computed(() => (post.value?.date ?? '').replaceAll('-', '.'))
// 中文阅读速度按每分钟约 400 字估算
const minutes = computed(() => Math.max(1, Math.round((post.value?.words ?? 0) / 400)))
const words = computed(() => (post.value?.words ?? 0).toLocaleString('en-US'))

// 顶部阅读进度条
const progress = ref(0)
let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const max = document.documentElement.scrollHeight - window.innerHeight
    progress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    followOutline()
  })
}

// 右侧目录跟随：当前高亮项跑出目录可视区时，滚动目录（不是页面）把它带回来
let lastActive: Element | null = null
function followOutline() {
  const link = document.querySelector('.VPDocAsideOutline .outline-link.active')
  if (!link || link === lastActive) return
  const box = document.querySelector<HTMLElement>('.VPDoc .aside-container')
  if (!box) return
  // 鼠标正停在目录上（在手动滚动 / 挑选条目），不抢滚动；移开后下一次滚动再补上
  if (box.matches(':hover')) return
  lastActive = link
  const lr = link.getBoundingClientRect()
  const br = box.getBoundingClientRect()
  const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vp-nav-height')) || 64
  const minY = br.top + nav + 24 // 顶部导航栏以下才算可见
  const maxY = br.bottom - 56 // 底部渐隐遮罩以上才算可见
  if (lr.top < minY) box.scrollBy({ top: lr.top - minY - 40, behavior: 'smooth' })
  else if (lr.bottom > maxY) box.scrollBy({ top: lr.bottom - maxY + 80, behavior: 'smooth' })
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <template v-if="isArticle">
    <div class="read-progress" aria-hidden="true" :style="{ transform: `scaleX(${progress})` }"></div>
    <div v-if="post" class="article-meta">
      <time>{{ date }}</time>
      <span class="sep" aria-hidden="true"></span>
      <span>约 {{ minutes }} 分钟读完</span>
      <span class="sep words" aria-hidden="true"></span>
      <span class="words">{{ words }} 字</span>
      <ReadAloud />
    </div>
  </template>
</template>

<style scoped>
.read-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 2px;
  background: linear-gradient(90deg, var(--info), var(--stable));
  transform-origin: 0 50%;
  pointer-events: none;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-bottom: 20px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-3);
}
.article-meta time {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
}
.sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}
/* 手机上收紧间距，让「朗读」按钮和日期、字数留在同一行 */
@media (max-width: 480px) {
  .article-meta {
    gap: 6px 8px;
    letter-spacing: 0;
  }
}
/* 更窄的屏幕（如 360px 的安卓机）放不下就先省掉字数，阅读时长已经够用 */
@media (max-width: 370px) {
  .article-meta .words {
    display: none;
  }
}
</style>
