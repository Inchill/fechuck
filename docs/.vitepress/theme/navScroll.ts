// 导航栏随滚动变化：
// - 离开顶部 → html.nav-scrolled：毛玻璃背景 + 底部发丝线
// - 往下滚一段距离 → html.nav-hidden：导航栏上移隐藏；往上滚立刻出现
const HIDE_AFTER = 240 // 滚过这么多像素后才允许隐藏，避免首屏就抖动
const DELTA = 6 // 单次滚动超过这个距离才判定方向，过滤触控板的细碎抖动

export function setupNavScroll() {
  const root = document.documentElement
  let lastY = window.scrollY
  let raf = 0

  const update = () => {
    raf = 0
    const y = Math.max(0, window.scrollY)
    root.classList.toggle('nav-scrolled', y > 8)

    const dy = y - lastY
    if (Math.abs(dy) < DELTA) return
    // 往下滚且已经离开首屏一段 → 隐藏；往上滚或回到顶部附近 → 显示
    root.classList.toggle('nav-hidden', dy > 0 && y > HIDE_AFTER)
    lastY = y
  }

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  update()
}
