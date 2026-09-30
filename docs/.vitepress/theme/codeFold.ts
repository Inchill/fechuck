// 长代码块折叠：超过 FOLD_LINES 行的代码块默认只显示前面一段，底部渐隐 +「展开全部」按钮
// 展开后底部换成「收起」；复制按钮始终复制完整代码（折叠只是视觉上的）
const FOLD_LINES = 24 // 超过这么多行才折叠
const SHOW_LINES = 15 // 折叠时露出的行数

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function foldCodeBlocks() {
  const blocks = document.querySelectorAll<HTMLElement>('.vp-doc div[class*="language-"]')
  blocks.forEach((block) => {
    if (block.dataset.fold) return
    const pre = block.querySelector<HTMLElement>('pre')
    const lines = block.querySelectorAll('pre code > .line').length
    if (!pre || lines <= FOLD_LINES) return
    block.dataset.fold = '1'

    // 按实际行高算出折叠高度，字号、行高改了也不会切在半行上
    // 注意 .line 是行内元素，它的高度只是字形高度，行距要取 code 的 line-height
    const code = pre.querySelector<HTMLElement>('code')
    const lineH = (code && parseFloat(getComputedStyle(code).lineHeight)) || 23.6
    const padTop = parseFloat(getComputedStyle(pre).paddingTop) || 20
    const folded = Math.round(padTop + lineH * SHOW_LINES)

    block.classList.add('code-fold', 'is-folded')
    pre.style.maxHeight = `${folded}px`

    const bar = document.createElement('div')
    bar.className = 'code-fold-bar'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'code-fold-btn'
    bar.append(btn)
    block.append(bar)

    const render = () => {
      const open = !block.classList.contains('is-folded')
      btn.innerHTML = open
        ? `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>收起`
        : `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>展开全部 · 共 ${lines} 行`
      btn.setAttribute('aria-expanded', String(open))
    }
    render()

    btn.addEventListener('click', () => {
      const opening = block.classList.contains('is-folded')
      const anim = !reduced()
      if (opening) {
        block.classList.remove('is-folded')
        if (anim) {
          pre.style.maxHeight = `${pre.scrollHeight}px`
          pre.addEventListener('transitionend', () => {
            if (!block.classList.contains('is-folded')) pre.style.maxHeight = 'none'
          }, { once: true })
        } else {
          pre.style.maxHeight = 'none'
        }
      } else {
        // 收起时让按钮「钉」在屏幕上原来的位置：代码块缩了多少，页面就同步往上补多少，
        // 视觉上是内容从上方收拢，而不是整页跳走（类似 GitHub 的 Show less）
        const anchor = btn.getBoundingClientRect().top
        const keep = () => {
          const dy = btn.getBoundingClientRect().top - anchor
          if (Math.abs(dy) > 0.5) window.scrollTo({ top: window.scrollY + dy, behavior: 'instant' as ScrollBehavior })
        }
        // 代码块开头本来就在屏幕内时不需要补偿，底部自然上移即可
        const needKeep = block.getBoundingClientRect().top < 0

        // 先把 none 换成具体高度，下一帧再收，才有过渡
        pre.style.maxHeight = `${pre.scrollHeight}px`
        void pre.offsetHeight
        block.classList.add('is-folded')
        pre.style.maxHeight = `${folded}px`

        if (needKeep) {
          if (anim) {
            const until = performance.now() + 520
            const loop = () => {
              keep()
              if (performance.now() < until) requestAnimationFrame(loop)
            }
            requestAnimationFrame(loop)
          } else {
            keep()
          }
        }
      }
      render()
    })
  })
}
