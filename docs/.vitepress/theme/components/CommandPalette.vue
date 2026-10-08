<script setup lang="ts">
// ⌘K 全站命令面板：在任何页面按 ⌘K / Ctrl+K（或按 /）打开
// 能搜文章、随想、书签、实验室，也能直接执行命令：切主题、放音乐、随便逛逛……
import { ref, computed, watch, nextTick, inject, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useData, withBase } from 'vitepress'
import { data as posts } from '../posts.data'
import { data as notes } from '../notes.data'
import { data as bookmarks } from '../../../bookmarks/bookmarks.data'

const router = useRouter()
const { isDark } = useData()
const toggleAppearance = inject<((e: MouseEvent) => void) | null>('toggle-appearance', null)

type Kind = 'cmd' | 'post' | 'note' | 'lab' | 'page' | 'site'
interface Item {
  kind: Kind
  title: string
  sub?: string // 右侧的小字：日期 / 域名 / 快捷说明
  keys?: string // 额外参与搜索的文字（摘要、别名）
  run: () => void
}

const go = (url: string) => router.go(withBase(url))
const allSites = bookmarks.groups.flatMap((g) => g.sites)
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

/* ---------- 命令 ---------- */
const STYLES: [string, string][] = [
  ['lofi', 'lo-fi'],
  ['ambient', '氛围'],
  ['jazz', '爵士'],
  ['rainy', '雨天'],
  ['folk', '民谣'],
  ['synth', 'Synthwave'],
  ['guofeng', '古风'],
  ['musicbox', '八音盒']
]
const commands = computed<Item[]>(() => [
  {
    kind: 'cmd',
    title: isDark.value ? '切换到亮色主题' : '切换到暗色主题',
    keys: 'theme 主题 明暗 dark light 夜间',
    run: () => {
      const at = { clientX: innerWidth / 2, clientY: innerHeight * 0.2 } as MouseEvent
      toggleAppearance ? toggleAppearance(at) : (isDark.value = !isDark.value)
    }
  },
  { kind: 'cmd', title: '播放 / 暂停音乐', keys: 'music 音乐 播放 暂停 lofi', run: () => window.dispatchEvent(new Event('fechuck:music')) },
  ...STYLES.map(([id, name]) => ({
    kind: 'cmd' as const,
    title: `音乐：换成「${name}」`,
    keys: `music style 风格 ${id} ${name}`,
    run: () => window.dispatchEvent(new CustomEvent('fechuck:music', { detail: id }))
  })),
  { kind: 'cmd', title: '随机读一篇文章', keys: 'random 随机 文章', run: () => go(pick(posts).url) },
  {
    kind: 'cmd',
    title: '随便逛一个收藏的网站',
    sub: '新标签页',
    keys: 'surf 随便逛逛 书签 random',
    run: () => window.open(pick(allSites).url, '_blank', 'noopener')
  },
  { kind: 'cmd', title: '回到顶部', keys: 'top 顶部', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
  {
    kind: 'cmd',
    title: '复制当前页面链接',
    keys: 'copy link url 链接 分享',
    run: () => navigator.clipboard?.writeText(location.href.split('#')[0])
  },
  { kind: 'cmd', title: '在 GitHub 上看源码', sub: '新标签页', keys: 'github source 源码', run: () => window.open('https://github.com/inchill/fechuck', '_blank', 'noopener') }
])

/* ---------- 可搜索的内容 ---------- */
const PAGES: Item[] = [
  { kind: 'page', title: '首页', keys: 'home index', run: () => go('/') },
  { kind: 'page', title: '全部文章', keys: 'posts archive 归档', run: () => go('/posts/') },
  { kind: 'page', title: '随想', keys: 'notes', run: () => go('/notes/') },
  { kind: 'page', title: '书签', keys: 'bookmarks 收藏', run: () => go('/bookmarks/') },
  { kind: 'page', title: '实验室', keys: 'lab', run: () => go('/lab/') },
  { kind: 'page', title: '关于', keys: 'about 联系', run: () => go('/about/') },
  { kind: 'page', title: 'RSS 订阅', keys: 'rss feed 订阅', run: () => go('/feed.xml') }
]
const LAB: Item[] = [
  { kind: 'lab', title: '建造回放', keys: 'city git 回放 城市', run: () => go('/lab/city.html') },
  { kind: 'lab', title: '文章星图', keys: 'stars 星图 相似 星空', run: () => go('/lab/stars.html') },
  { kind: 'lab', title: 'Token 显微镜', keys: 'tokens tokenizer 分词', run: () => go('/lab/tokens.html') },
  { kind: 'lab', title: '上下文窗口模拟器', keys: 'context skills 上下文 缓存', run: () => go('/lab/context.html') }
]
const POSTS: Item[] = posts.map((p) => ({ kind: 'post', title: p.title, sub: p.date, keys: `${p.excerpt} ${(p.tags ?? []).join(' ')}`, run: () => go(p.url) }))
const NOTES: Item[] = notes.map((n) => ({ kind: 'note', title: n.title, sub: n.date, keys: `${n.excerpt ?? ''} ${(n.tags ?? []).join(' ')}`, run: () => go(n.url) }))
const SITES: Item[] = allSites.map((s) => ({
  kind: 'site',
  title: s.title,
  sub: s.host,
  keys: `${s.note} ${s.host}`,
  run: () => window.open(s.url, '_blank', 'noopener')
}))

const GROUPS: { kind: Kind; name: string }[] = [
  { kind: 'cmd', name: '命令' },
  { kind: 'post', name: '文章' },
  { kind: 'note', name: '随想' },
  { kind: 'lab', name: '实验室' },
  { kind: 'site', name: '书签' },
  { kind: 'page', name: '页面' }
]

/* ---------- 搜索 ---------- */
const open = ref(false)
const q = ref('')
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

// 打分：标题开头 > 标题包含 > 其他字段包含；多个词要全部命中
function score(it: Item, words: string[]) {
  const title = it.title.toLowerCase()
  const rest = `${it.keys ?? ''} ${it.sub ?? ''}`.toLowerCase()
  let s = 0
  for (const w of words) {
    if (title.startsWith(w)) s += 6
    else if (title.includes(w)) s += 4
    else if (rest.includes(w)) s += 1
    else return 0
  }
  return s
}

const results = computed(() => {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const pool: Item[] = words.length
    ? [...commands.value, ...POSTS, ...NOTES, ...LAB, ...SITES, ...PAGES]
    : [...commands.value.filter((c) => !c.title.startsWith('音乐：')), ...POSTS.slice(0, 4), ...LAB] // 没输入时：常用命令 + 最近文章 + 实验室
  const scored = words.length
    ? pool
        .map((it) => ({ it, s: score(it, words) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.it)
    : pool
  return GROUPS.map((g) => ({ ...g, items: scored.filter((it) => it.kind === g.kind).slice(0, words.length ? 6 : 8) })).filter((g) => g.items.length)
})
const flat = computed(() => results.value.flatMap((g) => g.items))
watch(q, () => (active.value = 0))

// 标题里命中的部分高亮
function parts(title: string) {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [{ t: title, hit: false }]
  const lower = title.toLowerCase()
  const marks = new Array(title.length).fill(false)
  for (const w of words) {
    let i = lower.indexOf(w)
    while (i >= 0) {
      for (let k = i; k < i + w.length; k++) marks[k] = true
      i = lower.indexOf(w, i + w.length)
    }
  }
  const out: { t: string; hit: boolean }[] = []
  for (let i = 0; i < title.length; i++) {
    const last = out[out.length - 1]
    if (last && last.hit === marks[i]) last.t += title[i]
    else out.push({ t: title[i], hit: marks[i] })
  }
  return out
}

/* ---------- 打开 / 关闭 / 键盘 ---------- */
function show() {
  open.value = true
  q.value = ''
  active.value = 0
  nextTick(() => inputEl.value?.focus())
}
function hide() {
  open.value = false
}
function exec(it: Item | undefined) {
  if (!it) return
  hide()
  it.run() // 在按键 / 点击事件里同步执行，新标签页不会被拦截
}
function move(d: number) {
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + d + n) % n
  nextTick(() => listEl.value?.querySelector('.item.on')?.scrollIntoView({ block: 'nearest' }))
}
function onInputKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') e.preventDefault(), move(1)
  else if (e.key === 'ArrowUp') e.preventDefault(), move(-1)
  else if (e.key === 'Enter' && !e.isComposing) e.preventDefault(), exec(flat.value[active.value])
  else if (e.key === 'Escape') hide()
}
function onGlobalKey(e: KeyboardEvent) {
  // 焦点不在输入框时（比如刚点完导航按钮）也要能用 Esc 关掉
  if (open.value && e.key === 'Escape') {
    e.preventDefault()
    hide()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value ? hide() : show()
    return
  }
  // 「/」也能打开，但在输入框里打字时不抢
  const t = e.target as HTMLElement
  if (e.key === '/' && !open.value && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
    e.preventDefault()
    show()
  }
}

// 打开时锁住页面滚动；切换页面时自动关闭
watch(open, (v) => document.documentElement.classList.toggle('palette-open', v))
watch(() => router.route.path, hide)

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  window.addEventListener('fechuck:palette', show)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  window.removeEventListener('fechuck:palette', show)
})

const ICONS: Record<Kind, string> = {
  cmd: 'M4 5l3 3-3 3M8.5 11.5H12',
  post: 'M4 2.5h6l2.5 2.5v8.5h-8.5zM6 7h4.5M6 9.5h4.5',
  note: 'M3.5 3.5h9v6l-3 3h-6zM9.5 12.5v-3h3',
  lab: 'M6 2h4M6.8 2v4L3 13h10L9.2 6V2',
  page: 'M2.5 3.5h11v9h-11zM2.5 6h11',
  site: 'M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.6.6M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7.5 12l.6-.6'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pal">
      <div v-if="open" class="pal-mask" @mousedown.self="hide">
        <div class="pal" role="dialog" aria-label="命令面板">
          <div class="pal-input">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
            <input
              ref="inputEl"
              v-model="q"
              type="text"
              placeholder="搜文章、书签，或输入命令…"
              aria-label="搜索"
              autocomplete="off"
              spellcheck="false"
              @keydown="onInputKey"
            />
            <kbd>esc</kbd>
          </div>

          <div ref="listEl" class="pal-list">
            <p v-if="!flat.length" class="empty">没有找到和「{{ q }}」相关的内容。</p>
            <section v-for="g in results" :key="g.kind">
              <div class="g-name">{{ g.name }}</div>
              <button
                v-for="it in g.items"
                :key="it.kind + it.title"
                type="button"
                class="item"
                :class="{ on: flat[active] === it }"
                @mousemove="active = flat.indexOf(it)"
                @click="exec(it)"
              >
                <svg class="ic" :class="'k-' + it.kind" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <path :d="ICONS[it.kind]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="title"><template v-for="(p, i) in parts(it.title)" :key="i"><mark v-if="p.hit">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span>
                <span v-if="it.sub" class="sub">{{ it.sub }}</span>
                <span class="enter" aria-hidden="true">↵</span>
              </button>
            </section>
          </div>

          <div class="pal-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>↵</kbd> 打开</span>
            <span><kbd>esc</kbd> 关闭</span>
            <span class="tip">任何页面按 <kbd>⌘K</kbd> 或 <kbd>/</kbd> 都能打开</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pal-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 14vh 16px 16px;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  backdrop-filter: blur(10px) saturate(1.2);
  -webkit-backdrop-filter: blur(10px) saturate(1.2);
}
.pal {
  display: flex;
  flex-direction: column;
  width: min(640px, 100%);
  max-height: min(560px, 76vh);
  border-radius: 18px;
  border: 1px solid transparent;
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    linear-gradient(140deg, color-mix(in srgb, var(--info) 60%, transparent), var(--vp-c-divider) 40%, color-mix(in srgb, var(--stable) 50%, transparent)) border-box;
  box-shadow:
    0 30px 80px -24px rgba(16, 24, 32, 0.45),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  overflow: hidden;
}
.dark .pal {
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)) padding-box,
    linear-gradient(140deg, color-mix(in srgb, var(--info) 60%, transparent), var(--vp-c-divider) 40%, color-mix(in srgb, var(--stable) 50%, transparent)) border-box;
  box-shadow: 0 30px 90px -20px rgba(0, 0, 0, 0.8);
}
.pal-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
}
.pal-input input {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  color: var(--vp-c-text-1);
  background: transparent;
}
.pal-input input::placeholder {
  color: var(--vp-c-text-3);
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 5px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  /* 等宽字体里 ⌘ ↵ ↑ 这些符号偏小、偏下，用系统字体才能在框里居中 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--vp-c-text-2);
}
.pal-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px 8px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.empty {
  margin: 24px 12px;
  font-size: 13.5px;
  color: var(--vp-c-text-3);
}
.g-name {
  padding: 10px 10px 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  text-align: left;
  color: var(--vp-c-text-1);
}
.item.on {
  background: var(--vp-c-brand-soft);
}
.ic {
  flex: none;
  color: var(--vp-c-text-3);
}
.item.on .ic {
  color: var(--vp-c-brand-1);
}
.title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title mark {
  background: none;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.sub {
  flex: none;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}
.enter {
  flex: none;
  width: 14px;
  font-size: 12px;
  color: var(--vp-c-brand-1);
  opacity: 0;
}
.item.on .enter {
  opacity: 1;
}
.pal-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}
.pal-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pal-foot .tip {
  margin-left: auto;
}

.pal-enter-active,
.pal-leave-active {
  transition: opacity 180ms var(--ease-out);
}
.pal-enter-active .pal {
  transition:
    transform 260ms var(--ease-out),
    opacity 200ms var(--ease-out);
}
.pal-enter-from,
.pal-leave-to {
  opacity: 0;
}
.pal-enter-from .pal {
  transform: translateY(-8px) scale(0.98);
}

@media (max-width: 640px) {
  .pal-mask {
    padding-top: 8vh;
  }
  .pal-foot .tip,
  .pal-foot span:not(.tip):nth-child(-n + 3) {
    display: none;
  }
  .pal-foot {
    display: none;
  }
}
</style>
