<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { data as posts } from '../posts.data'
import { data as notes } from '../notes.data'

const { page } = useData()

// 去掉结尾的 .html / .md / index，统一成可比较的路径
function norm(u: string) {
  return u.replace(/(index)?\.(html|md)$/, '').replace(/\/$/, '')
}

// 文章详情页在文章之间切换，随想详情页在随想之间切换
const isNote = computed(() => /^notes\/(?!index\.md$)/.test(page.value.relativePath))
const isArticle = computed(() => /^20\d\d\//.test(page.value.relativePath) || isNote.value)
const list = computed(() => (isNote.value ? notes : posts))
const unit = computed(() => (isNote.value ? '条' : '篇'))

// 列表已按日期倒序（0 最新）。上一篇=更新的(上方)，下一篇=更早的(下方)，与列表页视觉顺序一致
const cur = computed(() => {
  const here = norm('/' + page.value.relativePath)
  return list.value.findIndex((p) => norm(p.url) === here)
})
const prev = computed(() => (cur.value > 0 ? list.value[cur.value - 1] : null))
const next = computed(() =>
  cur.value >= 0 && cur.value < list.value.length - 1 ? list.value[cur.value + 1] : null
)
</script>

<template>
  <nav v-if="isArticle && (prev || next)" class="prev-next">
    <a v-if="prev" class="pn prev" :href="prev.url">
      <span class="dir">← 上一{{ unit }}</span>
      <span class="t">{{ prev.title }}</span>
    </a>
    <span v-else class="pn placeholder" aria-hidden="true"></span>
    <a v-if="next" class="pn next" :href="next.url">
      <span class="dir">下一{{ unit }} →</span>
      <span class="t">{{ next.title }}</span>
    </a>
  </nav>
</template>

<style scoped>
.prev-next {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin: var(--space-8) 0 var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--vp-c-divider);
}
.pn {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-decoration: none;
  transition: transform var(--dur-base) var(--ease-out),
    border-color var(--dur-base) var(--ease-out);
}
.pn:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-1);
}
.pn.next {
  text-align: right;
  align-items: flex-end;
}
.pn.placeholder {
  border: none;
}
.dir {
  font-family: var(--vp-font-family-mono);
  font-size: var(--step--1);
  color: var(--vp-c-text-3);
}
.pn:hover .dir {
  color: var(--vp-c-brand-1);
}
.t {
  font-size: var(--step-0);
  font-weight: 600;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}
@media (max-width: 640px) {
  .prev-next {
    grid-template-columns: 1fr;
  }
  .pn.placeholder {
    display: none;
  }
  .pn.next {
    text-align: left;
    align-items: flex-start;
  }
}
</style>
