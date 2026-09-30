// 文章图片灯箱：基于 PhotoSwipe v5（https://photoswipe.com）
// - 事件委托：一个全局 click 监听，路由切换无需重新绑定
// - 首次点击才动态加载 PhotoSwipe 核心，不影响首屏体积
// - 同一篇文章内的图片自动组成图集：左右切换、滚轮 / 双指缩放、拖拽平移、下滑关闭
// - 自定义缩放控件：− / 百分比 / +，快捷键 + − 0
import type PhotoSwipe from 'photoswipe'
import type { SlideData } from 'photoswipe'

const SELECTOR = '.vp-doc img'
const STEP = 1.25 // 每次放大 / 缩小的倍率
const ZOOM_MS = 220 // 按钮缩放的过渡时长

// 被链接包裹的图片（点击应跳转）或显式标了 no-zoom 的不接管
function eligible(img: HTMLImageElement) {
  return !img.closest('a') && !img.closest('.no-zoom')
}

// alt 为空或只是 "banner" 这种文件名式的单词时不显示说明
function captionOf(alt: string) {
  const t = alt.trim()
  if (!t || /^[\w.-]+$/.test(t)) return ''
  return t
}

export function onImageClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const img = e.target
  if (!(img instanceof HTMLImageElement) || !img.matches(SELECTOR) || !eligible(img)) return
  e.preventDefault()
  open(img)
}

// ---- 缩放 ----
function zoomBy(pswp: PhotoSwipe, factor: number) {
  const s = pswp.currSlide
  if (!s || !s.isZoomable()) return
  const { min, max } = s.zoomLevels
  const next = Math.min(max, Math.max(min, s.currZoomLevel * factor))
  s.zoomTo(next, undefined, ZOOM_MS)
}

function zoomReset(pswp: PhotoSwipe) {
  const s = pswp.currSlide
  if (!s) return
  s.zoomTo(s.zoomLevels.initial, undefined, ZOOM_MS)
}

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${paths}</svg>`

let pswp: PhotoSwipe | null = null

async function open(clicked: HTMLImageElement) {
  const imgs = [...document.querySelectorAll<HTMLImageElement>(SELECTOR)].filter(eligible)
  const index = Math.max(0, imgs.indexOf(clicked))

  const items = imgs.map((el) => {
    const src = el.currentSrc || el.src
    const known = el.complete && el.naturalWidth > 0
    // 懒加载还没加载的图片先按渲染尺寸 / 默认比例占位，加载完再修正
    const w = known ? el.naturalWidth : el.clientWidth * 2 || 1600
    const h = known ? el.naturalHeight : el.clientHeight * 2 || 1000
    return { element: el, src, msrc: known ? src : undefined, width: w, height: h, alt: el.alt, known }
  })

  const { default: PhotoSwipeCore } = await import('photoswipe')

  pswp = new PhotoSwipeCore({
    dataSource: items as SlideData[],
    index,
    showHideAnimationType: 'zoom', // 从文中缩略图位置放大展开，关闭时缩回原位
    bgOpacity: 1, // 背景是半透明的站点色蒙层 + 页面模糊（毛玻璃，见 style.css）
    // 四周留白：桌面端留出宽一些的边，让图片「浮」在毛玻璃上；手机上保持紧凑
    paddingFn: (viewport) =>
      viewport.x > 768
        ? { top: 72, bottom: 72, left: 88, right: 88 }
        : { top: 64, bottom: 64, left: 12, right: 12 },
    zoom: false, // 默认的单级缩放按钮换成下面自定义的 − / 百分比 / +
    wheelToZoom: true, // 滚轮 / 触控板双指直接连续缩放
    secondaryZoomLevel: (z) => Math.max(1, z.fit * 2), // 双击放大到 2 倍（至少原图 1:1）
    maxZoomLevel: (z) => Math.max(4, z.fit * 8), // 最多放大到原图 4 倍或适配尺寸的 8 倍
    imageClickAction: 'zoom-or-close',
    tapAction: 'toggle-controls',
    doubleTapAction: 'zoom',
    closeTitle: '关闭（Esc）',
    arrowPrevTitle: '上一张（←）',
    arrowNextTitle: '下一张（→）',
    errorMsg: '图片加载失败'
  })

  pswp.on('uiRegister', () => {
    const ui = pswp!.ui!

    ui.registerElement({
      name: 'zoom-out',
      order: 8,
      isButton: true,
      title: '缩小（−）',
      html: icon('<path d="M6 12h12"/>'),
      onClick: (_e, _el, p) => zoomBy(p, 1 / STEP)
    })

    // 当前缩放比例，相对原图尺寸；点一下回到适配屏幕
    ui.registerElement({
      name: 'zoom-level',
      order: 9,
      isButton: true,
      title: '适配屏幕（0）',
      onClick: (_e, _el, p) => zoomReset(p),
      onInit: (el, p) => {
        // 缩放动画（按钮、双击、滚轮）过程中逐帧同步，只在数值变化时改 DOM
        let last = ''
        let raf = 0
        const update = () => {
          const s = p.currSlide
          if (s) {
            const zoomable = s.isZoomable()
            const text = `${Math.round(s.currZoomLevel * 100)}%`
            const key = `${text}|${zoomable}|${s.zoomLevels.min}|${s.zoomLevels.max}`
            if (key !== last) {
              last = key
              el.textContent = text
              const bar = el.parentElement
              bar?.classList.toggle('pswp--zoom-disabled', !zoomable)
              const out = bar?.querySelector<HTMLButtonElement>('.pswp__button--zoom-out')
              const inn = bar?.querySelector<HTMLButtonElement>('.pswp__button--zoom-in')
              if (out) out.disabled = !zoomable || s.currZoomLevel <= s.zoomLevels.min + 1e-3
              if (inn) inn.disabled = !zoomable || s.currZoomLevel >= s.zoomLevels.max - 1e-3
            }
          }
          raf = requestAnimationFrame(update)
        }
        update()
        p.on('destroy', () => cancelAnimationFrame(raf))
      }
    })

    ui.registerElement({
      name: 'zoom-in',
      order: 10,
      isButton: true,
      title: '放大（+）',
      html: icon('<path d="M6 12h12M12 6v12"/>'),
      onClick: (_e, _el, p) => zoomBy(p, STEP)
    })

    // 底部说明：取图片 alt
    ui.registerElement({
      name: 'caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit: (el, p) => {
        const update = () => {
          const text = captionOf((p.currSlide?.data as any)?.alt ?? '')
          el.textContent = text
          el.hidden = !text
        }
        p.on('change', update)
        update()
      }
    })
  })

  // 快捷键：+ / = 放大，- 缩小，0 适配屏幕
  pswp.on('keydown', (e) => {
    const k = e.originalEvent.key
    if (k === '+' || k === '=') zoomBy(pswp!, STEP)
    else if (k === '-' || k === '_') zoomBy(pswp!, 1 / STEP)
    else if (k === '0') zoomReset(pswp!)
    else return
    e.preventDefault()
  })

  // 毛玻璃背景：打开动画开始时加上模糊，开始关闭时撤掉，页面平滑地虚化、再恢复清晰
  pswp.on('openingAnimationStart', () => pswp?.element?.classList.add('pswp--glass'))
  pswp.on('close', () => pswp?.element?.classList.remove('pswp--glass'))

  pswp.on('destroy', () => {
    pswp = null
  })

  pswp.init()

  // 尺寸未知的图片后台加载，拿到真实宽高后刷新对应 slide
  items.forEach((item, i) => {
    if (item.known) return
    const probe = new Image()
    probe.onload = () => {
      item.width = probe.naturalWidth
      item.height = probe.naturalHeight
      item.msrc = item.src
      item.known = true
      pswp?.refreshSlideContent(i)
    }
    probe.src = item.src
  })
}
