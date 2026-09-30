<script setup lang="ts">
import { computed } from 'vue'
import { data as posts } from '../posts.data'

// 按年份分组（年份倒序，组内已按日期倒序）
const groups = computed(() => {
  const map = new Map<string, typeof posts>()
  for (const p of posts) {
    const y = p.year || '其它'
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(p)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
})

// 2024-06-05 -> 06.05
function md(date: string) {
  return date ? date.slice(5).replace('-', '.') : ''
}
</script>

<template>
  <div class="post-list">
    <section v-for="[year, items] in groups" :key="year" class="year">
      <div class="year-label">{{ year }}</div>
      <ul>
        <li v-for="p in items" :key="p.url">
          <a :href="p.url" class="row">
            <span class="title">{{ p.title }}</span>
            <span class="dots" aria-hidden="true"></span>
            <time class="date">{{ md(p.date) }}</time>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.post-list {
  margin: var(--space-7) 0;
}
.year {
  display: grid;
  grid-template-columns: 4rem 1fr;
  gap: var(--space-2) var(--space-5);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--vp-c-divider);
}
.year-label {
  font-family: var(--vp-font-family-mono);
  font-size: var(--step-2);
  font-weight: 600;
  color: var(--vp-c-text-3);
  letter-spacing: -0.02em;
  line-height: 2;
}
.year ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.year li {
  margin: 0;
}
.row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  color: var(--vp-c-text-1);
  font-weight: 500;
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}
.row:hover {
  color: var(--vp-c-brand-1);
}
.title {
  flex: 0 1 auto;
}
.dots {
  flex: 1 1 auto;
  border-bottom: 1px dashed var(--vp-c-divider);
  transform: translateY(-0.25em);
  min-width: var(--space-5);
}
.date {
  flex: none;
  font-family: var(--vp-font-family-mono);
  font-size: var(--step--1);
  color: var(--vp-c-text-3);
}
@media (max-width: 640px) {
  .year {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
  .year-label {
    font-size: var(--step-1);
    line-height: 1.4;
  }
}
</style>
