<script setup lang="ts">
// 404：终端风格，和首页的终端呼应
import { ref, onMounted, nextTick } from 'vue'
import { data as posts } from '../posts.data'
import { scramble } from '../motion'

const recent = posts.slice(0, 3)
// 路径只在客户端读取，避免构建出的 404.html 与实际访问路径不一致导致水合告警
const path = ref('')
const errEl = ref<HTMLElement | null>(null)
onMounted(async () => {
  path.value = decodeURIComponent(location.pathname)
  await nextTick()
  if (errEl.value) scramble(errEl.value, `cd: no such file or directory: ${path.value}`, 900)
})
</script>

<template>
  <div class="nf">
    <div class="term">
      <div class="bar">
        <span class="d r"></span><span class="d y"></span><span class="d g"></span>
        <span class="title">404 — zsh</span>
      </div>
      <div class="body">
        <div><span class="p">➜</span><span class="t">~</span>cd {{ path || '…' }}</div>
        <div class="err" ref="errEl">cd: no such file or directory: {{ path || '…' }}</div>
        <div class="gap"><span class="p">➜</span><span class="t">~</span>ls posts | head -3</div>
        <a v-for="p in recent" :key="p.url" :href="p.url" class="post">
          <span>{{ p.title }}</span>
          <time>{{ p.date.replaceAll('-', '.') }}</time>
        </a>
        <div class="gap"><span class="p">➜</span><span class="t">~</span><span class="caret"></span></div>
      </div>
    </div>

    <h1>这个页面不存在</h1>
    <p>可能是链接写错了，也可能是文章被挪走了。</p>
    <div class="actions">
      <a href="/" class="btn primary">回到首页</a>
      <a href="/posts/" class="btn">全部文章 ›</a>
    </div>
  </div>
</template>

<style scoped>
.nf {
  max-width: 640px;
  margin: 0 auto;
  padding: clamp(48px, 10vh, 96px) 24px 32px;
  text-align: center;
}

.term {
  text-align: left;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-alt);
  overflow: hidden;
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.35);
}
.bar {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.d { width: 12px; height: 12px; border-radius: 50%; }
.r { background: #ff5f57; }
.y { background: #febc2e; }
.g { background: #28c840; }
.title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}
.body {
  padding: 20px 22px;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.8;
  color: var(--vp-c-text-1);
  word-break: break-all;
}
.p { color: var(--stable); margin-right: 8px; }
.t { color: var(--info); margin-right: 10px; }
.err { color: var(--leak); }
.gap { margin-top: 10px; }
.post {
  display: flex;
  gap: 16px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  word-break: normal;
}
.post span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.post time {
  margin-left: auto;
  flex: none;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}
.post:hover { color: var(--vp-c-brand-1); }
.caret {
  display: inline-block;
  width: 8px;
  height: 1.1em;
  vertical-align: -0.2em;
  background: var(--stable);
  animation: blink 1.1s steps(1) infinite;
}
@keyframes blink { 50% { opacity: 0; } }

h1 {
  margin: 48px 0 0;
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}
p {
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
}
.actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  margin-top: 28px;
}
.btn {
  font-size: 15px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: transform var(--dur-base) var(--ease-out);
}
.btn.primary {
  padding: 10px 22px;
  border-radius: 999px;
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
.btn.primary:hover { transform: scale(1.04); }
.btn:not(.primary):hover { text-decoration: underline; text-underline-offset: 4px; }

@media (max-width: 640px) {
  .body { font-size: 12.5px; padding: 16px; }
  .post time { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .caret { animation: none; }
}
</style>
