<script setup lang="ts">
// 目录「展开全部 / 只看当前章节」切换；选择记在本地，下次打开保持
import { ref, onMounted } from 'vue'

const KEY = 'fechuck:outline-expanded'
const expanded = ref(false)

function apply() {
  document.documentElement.classList.toggle('outline-expanded', expanded.value)
}
function toggle() {
  expanded.value = !expanded.value
  apply()
  try {
    localStorage.setItem(KEY, expanded.value ? '1' : '0')
  } catch {}
}

onMounted(() => {
  try {
    expanded.value = localStorage.getItem(KEY) === '1'
  } catch {}
  apply()
})
</script>

<template>
  <div class="outline-toggle-row">
    <button
      class="outline-toggle"
      type="button"
      :aria-pressed="expanded"
      :title="expanded ? '只展开当前章节' : '展开全部小节'"
      @click="toggle"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          v-if="expanded"
          d="M4 2.5 8 6l4-3.5M4 13.5 8 10l4 3.5"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
        />
        <path
          v-else
          d="M4 6.5 8 3l4 3.5M4 9.5 8 13l4-3.5"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
        />
      </svg>
      {{ expanded ? '收起' : '展开全部' }}
    </button>
  </div>
</template>

<style scoped>
/* 叠在「本页目录」标题那一行的右侧 */
.outline-toggle-row {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  height: 0;
}
.outline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
  transition: color var(--dur-fast) var(--ease-out);
}
.outline-toggle:hover {
  color: var(--vp-c-brand-1);
}
</style>
