<script setup lang="ts">
// 划词引用：在文章正文里选中一段文字，浮出「复制引用 / 复制链接」
// 复制的链接带 Text Fragment（#:~:text=），打开后浏览器会直接滚到并高亮这段话；
// 同时带上最近的小节锚点，不支持 Text Fragment 的浏览器至少能定位到那一节
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useData } from 'vitepress'

const { page } = useData()

const show = ref(false)
const done = ref('') // 复制成功后的提示文字
const pos = ref({ x: 0, y: 0, below: false })
let text = ''
let range: Range | null = null
let hideTimer = 0

const isArticle = () => /^\/(20\d\d|notes)\/.+/.test(location.pathname)

function currentSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const t = sel.toString().replace(/\s+/g, ' ').trim()
  if ([...t].length < 2) return null
  const r = sel.getRangeAt(0)
  const el = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement)
  const a = el(r.startContainer)
  const b = el(r.endContainer)
  // 只在正文里生效；代码块、行内输入框里不打扰（选代码一般就是要复制代码）
  if (!a?.closest('.vp-doc') || !b?.closest('.vp-doc')) return null
  if (a.closest('div[class*="language-"], pre, input, textarea') || b.closest('div[class*="language-"], pre')) return null
  return { t, r }
}

function update() {
  if (!isArticle()) return hide()
  const cur = currentSelection()
  if (!cur) return hide()
  text = cur.t
  range = cur.r
  const rect = cur.r.getBoundingClientRect()
  const below = rect.top < 90 // 太靠上（被导航栏挡住）就放到选区下方
  pos.value = {
    x: Math.min(Math.max(rect.left + rect.width / 2, 110), innerWidth - 110),
    y: below ? rect.bottom + 10 : rect.top - 10,
    below
  }
  done.value = ''
  show.value = true
}

function hide() {
  show.value = false
}

/* ---------- 链接与引用 ---------- */
const enc = (s: string) =>
  encodeURIComponent(s).replace(/-/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%26')

function textFragment(t: string) {
  const chars = [...t]
  if (chars.length <= 80) return `text=${enc(t)}`
  // 太长时用「开头…结尾」的形式；英文尽量在空格处截断，避免截断单词导致匹配失败
  let start = chars.slice(0, 24).join('')
  let end = chars.slice(-24).join('')
  if (/\s/.test(start)) start = start.replace(/\s+\S*$/, '')
  if (/\s/.test(end)) end = end.replace(/^\S*\s+/, '')
  return `text=${enc(start)},${enc(end)}`
}

// 选区之前最近的 h2 / h3 的 id
function nearestHeadingId() {
  if (!range) return ''
  const hs = [...document.querySelectorAll<HTMLElement>('.vp-doc h2[id], .vp-doc h3[id]')]
  let id = ''
  for (const h of hs) {
    if (h.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) id = h.id
    else break
  }
  return id
}

function link() {
  const base = location.origin + location.pathname
  return `${base}#${nearestHeadingId()}:~:${textFragment(text)}`
}

async function copy(s: string) {
  try {
    await navigator.clipboard.writeText(s)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = s
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.append(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

async function copyQuote() {
  const title = page.value.title || document.title
  await copy(`「${text}」\n—— 休言《${title}》\n${link()}`)
  flash('已复制引用')
}
async function copyLink() {
  await copy(link())
  flash('已复制链接')
}
function flash(msg: string) {
  done.value = msg
  clearTimeout(hideTimer)
  hideTimer = window.setTimeout(hide, 1200)
}

/* ---------- 事件 ---------- */
const onUp = (e: Event) => {
  if ((e.target as Element)?.closest?.('.sel-share')) return
  setTimeout(update, 10)
}
const onKeyUp = (e: KeyboardEvent) => {
  if (e.shiftKey || e.key === 'Shift') setTimeout(update, 10)
}
const onDown = (e: Event) => {
  if (!(e.target as Element)?.closest?.('.sel-share')) hide()
}
const onSelChange = () => {
  if (show.value && !currentSelection() && !done.value) hide()
}

let coarse = false
onMounted(() => {
  // 触屏设备有系统自带的选词菜单，不再叠一层
  coarse = window.matchMedia('(pointer: coarse)').matches
  if (coarse) return
  document.addEventListener('mouseup', onUp)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('mousedown', onDown)
  document.addEventListener('selectionchange', onSelChange)
  window.addEventListener('scroll', hide, { passive: true })
})
onBeforeUnmount(() => {
  if (coarse) return
  document.removeEventListener('mouseup', onUp)
  document.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('mousedown', onDown)
  document.removeEventListener('selectionchange', onSelChange)
  window.removeEventListener('scroll', hide)
  clearTimeout(hideTimer)
})
</script>

<template>
  <Transition name="sel">
    <div
      v-if="show"
      class="sel-share"
      :class="{ below: pos.below }"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      role="toolbar"
      aria-label="引用选中的文字"
      @mousedown.prevent
    >
      <template v-if="!done">
        <button type="button" @click="copyQuote">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M3 9.5c0-2.6 1.3-4.3 3.5-5M3 9.5h3v3.5H3zM9.5 9.5c0-2.6 1.3-4.3 3.5-5M9.5 9.5h3v3.5h-3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          </svg>
          复制引用
        </button>
        <span class="sep" aria-hidden="true"></span>
        <button type="button" @click="copyLink">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
          复制链接
        </button>
      </template>
      <span v-else class="done">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ done }}
      </span>
    </div>
  </Transition>
</template>

<style scoped>
/* 和站点同一套语言：页面底色 + 品牌蓝绿渐变细边框 + 带品牌色的柔和投影，图标用品牌色 */
.sel-share {
  --edge: linear-gradient(100deg, var(--info), var(--stable));
  position: fixed;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid transparent;
  border-radius: 999px;
  /* 双层背景实现渐变边框：内层是底色，外层渐变只露出 1px 边 */
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    var(--edge) border-box;
  transform: translate(-50%, calc(-100% - 8px));
  transform-origin: 50% 100%;
  color: var(--vp-c-text-1);
  box-shadow:
    0 12px 32px -12px color-mix(in srgb, var(--info) 45%, transparent),
    0 4px 12px -4px rgba(16, 24, 32, 0.12);
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  user-select: none;
}
:global(.dark) .sel-share {
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)) padding-box,
    var(--edge) border-box;
  box-shadow:
    0 14px 36px -12px color-mix(in srgb, var(--info) 35%, transparent),
    0 4px 12px -4px rgba(0, 0, 0, 0.5);
}
.sel-share.below {
  transform: translate(-50%, 8px);
  transform-origin: 50% 0;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  color: inherit;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
button svg {
  color: var(--vp-c-brand-1);
}
button:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.sep {
  width: 1px;
  height: 14px;
  background: var(--vp-c-divider);
}
.done {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  color: var(--stable);
}

/* 从选区方向轻轻弹出 */
.sel-enter-active {
  transition:
    opacity 180ms var(--ease-out),
    scale 220ms var(--ease-out),
    translate 220ms var(--ease-out);
}
.sel-leave-active {
  transition:
    opacity 120ms ease-in,
    scale 120ms ease-in;
}
.sel-enter-from,
.sel-leave-to {
  opacity: 0;
  scale: 0.94;
  translate: 0 4px;
}
.sel-share.below.sel-enter-from {
  translate: 0 -4px;
}
</style>
