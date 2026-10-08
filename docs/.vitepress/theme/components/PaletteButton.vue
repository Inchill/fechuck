<script setup lang="ts">
// 导航栏里的搜索入口：点一下打开 ⌘K 命令面板
import { ref, onMounted } from 'vue'

const mac = ref(true)
onMounted(() => (mac.value = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)))
const open = () => window.dispatchEvent(new Event('fechuck:palette'))
</script>

<template>
  <button type="button" class="pb" aria-label="搜索（⌘K）" @click="open">
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
    <span class="txt">搜索</span>
    <span class="keys"><kbd>{{ mac ? '⌘' : 'Ctrl' }}</kbd><kbd>K</kbd></span>
  </button>
</template>

<style scoped>
.pb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  margin-right: 16px;
  padding: 0 8px 0 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  font-size: 13px;
  color: var(--vp-c-text-3);
  transition:
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.pb:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.keys {
  display: inline-flex;
  gap: 2px;
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  /* 等宽字体里的 ⌘ 偏小、偏下，用系统字体才能和 K 对齐 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--vp-c-text-2);
}
/* 窄屏只留一个放大镜图标 */
@media (max-width: 960px) {
  .pb {
    width: 36px;
    height: 36px;
    margin-right: 4px;
    padding: 0;
    justify-content: center;
    border-color: transparent;
    background: transparent;
  }
  .txt,
  .keys {
    display: none;
  }
}
</style>
