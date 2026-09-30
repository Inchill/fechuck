<script setup lang="ts">
// 右下角悬浮的「回到顶部」：离开首屏后出现，外圈随阅读进度走满
import { ref, onMounted, onBeforeUnmount } from 'vue'

const show = ref(false)
const progress = ref(0)
const R = 21
const C = 2 * Math.PI * R

let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const y = window.scrollY
    const max = document.documentElement.scrollHeight - window.innerHeight
    show.value = y > window.innerHeight * 0.8
    progress.value = max > 0 ? Math.min(1, y / max) : 0
  })
}
const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

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
  <button
    class="back-to-top"
    :class="{ show }"
    type="button"
    title="回到顶部"
    aria-label="回到顶部"
    :tabindex="show ? 0 : -1"
    @click="toTop"
  >
    <svg class="ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="track" cx="24" cy="24" :r="R" />
      <circle
        class="bar"
        cx="24"
        cy="24"
        :r="R"
        :stroke-dasharray="C"
        :stroke-dashoffset="C * (1 - progress)"
      />
    </svg>
    <svg class="arrow" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
      <path d="M8 13V3.5M3.5 8 8 3.5 12.5 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  /* 离右边缘留出距离；超宽屏时跟随页面内容区（VitePress 最大宽度 1440px）往里收 */
  right: max(56px, calc((100vw - var(--vp-layout-max-width, 1440px)) / 2 + 56px));
  bottom: 56px;
  z-index: 40;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
  color: var(--vp-c-text-1);
  background: color-mix(in srgb, var(--vp-c-bg-soft) 88%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  backdrop-filter: saturate(180%) blur(16px);
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 12px 32px -10px rgba(0, 0, 0, 0.45);
  opacity: 0;
  transform: translateY(12px) scale(0.9);
  pointer-events: none;
  transition:
    opacity 300ms var(--ease-out),
    transform 300ms var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.back-to-top.show {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.back-to-top:hover {
  color: var(--vp-c-brand-1);
}
.back-to-top:hover .arrow {
  transform: translateY(-2px);
}
.back-to-top:active {
  transform: scale(0.94);
}

.ring {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
.track,
.bar {
  fill: none;
  stroke-width: 2.5;
}
.track {
  stroke: var(--vp-c-divider);
}
.bar {
  stroke: var(--vp-c-brand-1);
  stroke-linecap: round;
  transition: stroke-dashoffset 120ms linear;
}
.arrow {
  position: relative;
  transition: transform 250ms var(--ease-out);
}

@media (max-width: 640px) {
  .back-to-top {
    right: 20px;
    bottom: 24px;
    width: 44px;
    height: 44px;
  }
}
</style>
