<script setup lang="ts">
import { data as notes } from '../notes.data'

// 2026-09-28 -> 2026.09.28
function fmt(date: string) {
  return date ? date.replaceAll('-', '.') : ''
}
</script>

<template>
  <div class="note-list">
    <p v-if="!notes.length" class="empty">还没有碎片。第一条随想马上就来。</p>
    <ol v-else>
      <li v-for="n in notes" :key="n.url" class="item">
        <time class="date">{{ fmt(n.date) }}</time>
        <div class="body">
          <a :href="n.url" class="title">{{ n.title }}</a>
          <p v-if="n.excerpt" class="excerpt">{{ n.excerpt }}</p>
          <div v-if="n.tags?.length" class="tags">
            <span v-for="t in n.tags" :key="t" class="tag">{{ t }}</span>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.note-list {
  margin: var(--space-7) 0;
}
.empty {
  color: var(--vp-c-text-3);
}
.note-list ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  gap: var(--space-5);
  padding: var(--space-5) 0;
  border-top: 1px solid var(--vp-c-divider);
  position: relative;
}
.date {
  font-family: var(--vp-font-family-mono);
  font-size: var(--step--1);
  color: var(--vp-c-text-3);
  padding-top: 0.15em;
}
.title {
  font-size: var(--step-1);
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}
.title:hover {
  color: var(--vp-c-brand-1);
}
.excerpt {
  margin: var(--space-2) 0 0;
  color: var(--vp-c-text-2);
  line-height: 1.7;
}
.tags {
  margin-top: var(--space-3);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.tag {
  font-family: var(--vp-font-family-mono);
  font-size: var(--step--1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 2px 8px;
  border-radius: 999px;
}
@media (max-width: 640px) {
  .item {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
}
</style>
