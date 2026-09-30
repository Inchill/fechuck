// 全站动效（用户在「动效预览」里挑的：01 页面切换 / 02 标题浮现 / 03 乱码解码 / 11 段落渐入）
// 06 链接下划线、08 复制反馈是纯 CSS，见 style.css「动效」一节
import { watch } from 'vue'
import { useRoute, onContentUpdated } from 'vitepress'
import { foldCodeBlocks } from './codeFold'

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const CJK = /[　-〿一-鿿＀-￯]/

/* ---------- 03 乱码解码 ---------- */
const ASCII_POOL = '!<>-_/[]{}=+*^?#01ABCDEFXYZabcdefxyz'
const CJK_POOL = '的一是在不了有和人这中大为上个我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所'
const pick = (s: string) => s[Math.floor(Math.random() * s.length)]

/** 文字从随机字符从左到右「解码」成 text。中文位置用随机汉字填充，宽度不会跳 */
export function scramble(el: HTMLElement, text = el.textContent ?? '', duration = 800) {
  if (reduced()) {
    el.textContent = text
    return
  }
  const chars = [...text]
  const start = performance.now()
  const tick = (now: number) => {
    const k = Math.min(1, (now - start) / duration)
    const done = Math.floor(k * chars.length)
    el.textContent = chars
      .map((c, i) => (i < done || /\s/.test(c) ? c : CJK.test(c) ? pick(CJK_POOL) : pick(ASCII_POOL)))
      .join('')
    if (k < 1) requestAnimationFrame(tick)
    else el.textContent = text
  }
  requestAnimationFrame(tick)
}

/* ---------- 02 文章标题逐字浮现 ---------- */
function splitTitle() {
  if (reduced()) return
  // 只在文章页和随想详情页
  if (!/^\/(20\d\d|notes)\/.+/.test(location.pathname)) return
  const h1 = document.querySelector<HTMLElement>('.vp-doc h1')
  if (!h1 || h1.dataset.split) return
  h1.dataset.split = '1'

  const units: HTMLElement[] = []
  for (const node of [...h1.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue // 跳过标题锚点 #
    // 中文按字拆，英文 / 数字按整词拆，保证不会在单词中间换行
    const parts =
      node.textContent?.match(/[　-〿一-鿿＀-￯]|[^\s　-〿一-鿿＀-￯]+|\s+/g) ?? []
    const frag = document.createDocumentFragment()
    for (const p of parts) {
      if (/^\s+$/.test(p)) {
        frag.append(p)
        continue
      }
      const s = document.createElement('span')
      s.className = 'tc'
      s.textContent = p
      frag.append(s)
      units.push(s)
    }
    node.replaceWith(frag)
  }
  // 总时长控制在 0.7s 内，长标题也不拖沓
  const step = Math.min(45, 700 / Math.max(1, units.length))
  units.forEach((s, i) => (s.style.animationDelay = `${Math.round(i * step)}ms`))
}

/* ---------- 11 正文段落滚动渐入 ---------- */
let io: IntersectionObserver | null = null
function revealBlocks() {
  io?.disconnect()
  io = null
  if (reduced() || !('IntersectionObserver' in window)) return
  if (!/^\/(20\d\d|notes)\/.+/.test(location.pathname)) return

  const blocks = [...document.querySelectorAll<HTMLElement>('.vp-doc > div > *')].filter(
    (el) => el.tagName !== 'H1'
  )
  // 首屏内已经看得见的不动，只隐藏首屏以下的
  const vh = window.innerHeight
  const hidden = blocks.filter((el) => el.getBoundingClientRect().top > vh * 0.92)
  if (!hidden.length) return

  io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue
        en.target.classList.add('rv-in')
        io?.unobserve(en.target)
      }
    },
    // 顶部留超大余量：跳转锚点、快速拖动滚动条越过的内容也立刻显示
    { rootMargin: '100000px 0px -8% 0px', threshold: 0.01 }
  )
  hidden.forEach((el) => {
    el.classList.add('rv')
    io!.observe(el)
  })
}

/* ---------- 01 页面切换过渡 ---------- */
let routeTimer = 0
function playRouteEnter() {
  if (reduced()) return
  const root = document.documentElement
  root.classList.remove('route-enter')
  void root.offsetWidth // 强制重排，让同一个 class 能重新触发动画
  root.classList.add('route-enter')
  clearTimeout(routeTimer)
  routeTimer = window.setTimeout(() => root.classList.remove('route-enter'), 700)
}

/** 在 Layout 的 setup 里调用 */
export function setupMotion() {
  const route = useRoute()
  // 只在站内跳转时播放，首次打开页面不播（不拖慢首屏）
  watch(
    () => route.path,
    () => playRouteEnter(),
    { flush: 'post' }
  )
  onContentUpdated(() => {
    foldCodeBlocks() // 先折叠长代码块，再计算段落渐入（折叠会改变元素位置）
    splitTitle()
    revealBlocks()
  })
}
