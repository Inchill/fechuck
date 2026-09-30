<script setup lang="ts">
// 全站极简页脚：年份区间取自文章数据（构建期确定，避免 SSR / 客户端年份不一致）
import { data as posts } from '../posts.data'

const years = posts.map((p) => p.year).filter(Boolean).sort()
const from = years[0]
const to = years[years.length - 1]
const range = from && to && from !== to ? `${from}–${to}` : from || ''
</script>

<template>
  <footer class="site-footer">
    <span>© {{ range }} 休言</span>
    <span class="dot" aria-hidden="true"></span>
    <a href="/feed.xml">RSS</a>
    <span class="dot" aria-hidden="true"></span>
    <a href="https://github.com/inchill" target="_blank" rel="noopener">GitHub</a>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 40px 24px 48px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
.site-footer a {
  color: var(--vp-c-text-3);
  text-decoration: none;
  /* 下划线从左往右生长，和正文链接一致 */
  background: linear-gradient(currentColor, currentColor) no-repeat right bottom / 0 1px;
  padding-bottom: 1px;
  transition:
    color var(--dur-fast) var(--ease-out),
    background-size 400ms var(--ease-out);
}
.site-footer a:hover {
  color: var(--vp-c-brand-1);
  background-size: 100% 1px;
  background-position: left bottom;
}
.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}
</style>
