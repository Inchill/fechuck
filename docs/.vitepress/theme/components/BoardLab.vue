<script setup lang="ts">
// 涂鸦白板：直接用我开源的 react-whiteboard 组件（React），在 Vue 页面里挂载
// React 和组件都在客户端按需加载，只有打开这个页面才会下载，不影响站点其他页面
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useData, withBase } from 'vitepress'

const { isDark } = useData()
const host = ref<HTMLElement>()
const ready = ref(false)
const failed = ref(false)

let unmount: (() => void) | undefined
let render: ((dark: boolean) => void) | undefined

onMounted(async () => {
  try {
    const [{ createElement }, { createRoot }, { Whiteboard }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@inchill/react-whiteboard'),
      import('@inchill/react-whiteboard/style.css')
    ])
    if (!host.value) return
    const root = createRoot(host.value)
    render = (dark) =>
      root.render(
        createElement(Whiteboard, {
          theme: dark ? 'dark' : 'light',
          locale: 'zh',
          storageKey: 'fechuck:lab-board', // 画的内容只保存在访客自己的浏览器里
          globalShortcuts: false, // 快捷键只在白板获得焦点时生效，不和博客的 ⌘K 等冲突
          captureWheel: false, // 普通滚轮留给页面滚动，Ctrl / ⌘ + 滚轮缩放画布
          githubUrl: 'https://github.com/Inchill/react-whiteboard'
        })
      )
    render(isDark.value)
    unmount = () => root.unmount()
    ready.value = true
  } catch (e) {
    console.error(e)
    failed.value = true
  }
})

// 跟随博客的明暗主题
watch(isDark, (dark) => render?.(dark))

onBeforeUnmount(() => unmount?.())
</script>

<template>
  <div class="bl">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M10.8 2.2a1.6 1.6 0 0 1 2.3 2.3L5.3 12.3 2.2 13l.7-3.1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
        <a :href="withBase('/lab/')">LAB</a> <i>/</i> 涂鸦白板
      </div>
      <h1 class="headline">一块白板，<span class="grad">随手画点什么。</span></h1>
      <p class="sub">
        用手写笔画，线条会跟着力度变粗变细；用鼠标画，快慢决定粗细。橡皮可以只擦掉划过的那一段。画的内容会自动保存在你自己的浏览器里，按
        <kbd>?</kbd> 查看全部快捷键。
      </p>
    </header>

    <section class="board" :class="{ ready }">
      <div ref="host" class="host"></div>
      <p v-if="!ready && !failed" class="state">正在载入白板…</p>
      <p v-if="failed" class="state">白板没能加载出来，刷新页面再试一次，或者直接打开 <a href="https://inchill.github.io/react-whiteboard/board/" target="_blank" rel="noopener">在线白板 ↗</a>。</p>
    </section>

    <footer class="about">
      <p>
        这块白板是我开源的 React 组件
        <a href="https://github.com/Inchill/react-whiteboard" target="_blank" rel="noopener">react-whiteboard</a>，
        gzip 后约 23 kB，没有其他依赖。实现思路写在
        <a :href="withBase('/2026/react-whiteboard.html')">这篇文章</a>里。
      </p>
      <ul class="links">
        <li><a href="https://inchill.github.io/react-whiteboard/" target="_blank" rel="noopener">项目主页 ↗</a></li>
        <li><a href="https://github.com/Inchill/react-whiteboard" target="_blank" rel="noopener">GitHub ↗</a></li>
        <li><a href="https://www.npmjs.com/package/@inchill/react-whiteboard" target="_blank" rel="noopener">npm ↗</a></li>
      </ul>
    </footer>
  </div>
</template>

<style scoped>
.bl {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}

/* ---------- 头部（和其他实验页保持一致） ---------- */
.hero {
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
  max-width: 640px;
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.1rem);
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.sub kbd {
  padding: 1px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85em;
}

/* ---------- 白板 ---------- */
.board {
  position: relative;
  margin-top: 40px;
  height: clamp(460px, 72vh, 780px);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.board.ready {
  background: transparent;
}
.host {
  position: absolute;
  inset: 0;
}
.state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 24px;
  text-align: center;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

/* ---------- 底部说明 ---------- */
.about {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px 32px;
  margin-top: 24px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.about p {
  margin: 0;
  max-width: 620px;
}
.about a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.about a:hover {
  text-decoration: underline;
}
.links {
  display: flex;
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

@media (max-width: 640px) {
  .board {
    /* 留出上下空间，手机上手指还能滑动页面 */
    height: 64vh;
    border-radius: 14px;
  }
}
</style>
