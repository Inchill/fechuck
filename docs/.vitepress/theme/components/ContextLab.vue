<script setup lang="ts">
// 实验室里的「上下文窗口模拟器」独立页：和其它实验一样的头部与宽度，正文还是复用文章里的 ContextSim
import { withBase } from 'vitepress'
import ContextSim from './ContextSim.vue'
</script>

<template>
  <div class="cl">
    <header class="hero">
      <div class="eyebrow">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="1.5" y="3" width="13" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M4 6.5h5M4 9.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
        <a :href="withBase('/lab/')">LAB</a> <i>/</i> 上下文窗口模拟器
      </div>
      <h1 class="headline">一句话背后，<span class="grad">上下文怎么被填满。</span></h1>
      <p class="sub">以「提交代码」为例，一步步看 Skill 怎么分级加载、每一轮有多少命中缓存。勾上「对比」，看把所有 Skill 塞进系统提示会多占多少空间。</p>
    </header>

    <ContextSim />

    <p class="foot">
      背后的原理，在
      <a :href="withBase('/2026/skills.html')">《读懂 Skills：是什么、怎么写、为什么有效》</a>
      里有更完整的介绍。
    </p>
  </div>
</template>

<style scoped>
.cl {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 48px) 120px;
  overflow-x: clip;
}
.hero {
  position: relative;
  padding: clamp(48px, 9vh, 96px) 0 20px;
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
  max-width: 680px;
  margin: 16px 0 0;
  font-size: clamp(1rem, 1.5vw, 1.1rem);
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.foot {
  margin: 32px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--vp-c-text-3);
}
.foot a {
  color: var(--vp-c-brand-1);
}
</style>
