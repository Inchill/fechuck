import DefaultTheme from 'vitepress/theme'
import giscusTalk from 'vitepress-plugin-comment-with-giscus'
import { useData, useRoute } from 'vitepress'
import { toRefs, onMounted, h, provide, nextTick, defineComponent } from 'vue'
import 'photoswipe/style.css'

import './style.css'
import { onImageClick } from './lightbox'
import { setupNavScroll } from './navScroll'
import { setupMotion } from './motion'
import PostList from './components/PostList.vue'
import NoteList from './components/NoteList.vue'
import CustomHome from './components/CustomHome.vue'
import PrevNext from './components/PrevNext.vue'
import ArticleMeta from './components/ArticleMeta.vue'
import BackToTop from './components/BackToTop.vue'
import OutlineToggle from './components/OutlineToggle.vue'
import SiteFooter from './components/SiteFooter.vue'
import NotFound from './components/NotFound.vue'
import SelectionShare from './components/SelectionShare.vue'

// 切换明暗：新主题从按钮位置圆形扩散铺满全屏（View Transitions）
// 不支持该 API 或用户偏好减少动效时，退回普通切换
function useAppearanceTransition() {
    const { isDark } = useData()
    const enabled = () =>
        'startViewTransition' in document &&
        window.matchMedia('(prefers-reduced-motion: no-preference)').matches

    provide('toggle-appearance', async ({ clientX: x, clientY: y }: MouseEvent) => {
        if (!enabled()) {
            isDark.value = !isDark.value
            return
        }
        const root = document.documentElement
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
        const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`]

        // 切换期间关掉所有 CSS 过渡：否则导航栏等元素的颜色会在新画面里再单独渐变一次，看起来像闪
        root.classList.add('theme-switching')
        const vt = (document as any).startViewTransition(async () => {
            isDark.value = !isDark.value
            await nextTick()
        })
        await vt.ready
        root.animate(
            { clipPath: isDark.value ? clipPath.reverse() : clipPath },
            {
                duration: 480,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                // 保持最后一帧：切到暗色时旧画面缩成 0，动画结束瞬间若恢复原状会闪一下亮色
                fill: 'forwards',
                pseudoElement: `::view-transition-${isDark.value ? 'old' : 'new'}(root)`
            }
        )
        vt.finished.finally(() => root.classList.remove('theme-switching'))
    })
}

// 用默认主题的布局槽位注入自定义组件：
// 文章顶部信息 / 上一篇下一篇 / 目录开关 / 404 / 页脚与回到顶部
const Layout = defineComponent({
    name: 'FechuckLayout',
    setup() {
        useAppearanceTransition()
        setupMotion()
        return () =>
            h(DefaultTheme.Layout, null, {
                'doc-before': () => h(ArticleMeta),
                'doc-after': () => h(PrevNext),
                'aside-outline-before': () => h(OutlineToggle),
                'not-found': () => h(NotFound),
                // 页脚 + 右下角悬浮的「回到顶部」（不放在目录里，长目录时也始终看得到）
                'layout-bottom': () => [h(SiteFooter), h(BackToTop), h(SelectionShare)]
            })
    }
})

export default {
    ...DefaultTheme,
    Layout,
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx)
        // 文章 / 随想列表组件全局注册，供 md 页面直接使用
        ctx.app.component('PostList', PostList)
        ctx.app.component('NoteList', NoteList)
        ctx.app.component('CustomHome', CustomHome)
    },
    setup() {
        // 获取前言和路由
        const { frontmatter } = toRefs(useData())
        const route = useRoute()
        
        // 评论组件 - https://giscus.app/
        giscusTalk({
            repo: 'Inchill/fechuck',
            repoId: 'R_kgDOMDJlRA',
            category: 'Announcements', // 默认: `General`
            categoryId: 'DIC_kwDOMDJlRM4CfwxK',
            mapping: 'pathname', // 默认: `pathname`
            inputPosition: 'top', // 默认: `top`
            lang: 'zh-CN', // 默认: `zh-CN`
            // i18n 国际化设置（注意：该配置会覆盖 lang 设置的默认语言）
            // 配置为一个对象，里面为键值对组：
            // [你的 i18n 配置名称]: [对应 Giscus 中的语言包名称]
            locales: {
                'zh-Hans': 'zh-CN',
                'en-US': 'en'
            },
            homePageShowComment: false, // 首页是否显示评论区，默认为否
            lightTheme: 'light', // 默认: `light`
            darkTheme: 'transparent_dark', // 默认: `transparent_dark`
            // ...
        }, {
            frontmatter, route
        },
            // 是否全部页面启动评论区。
            // 默认为 true，表示启用，此参数可忽略；
            // 如果为 false，表示不启用。
            // 可以在页面使用 `comment: true` 前言单独启用
            true
        )

        // 文章图片灯箱（PhotoSwipe）：事件委托，路由切换无需重新绑定
        onMounted(() => document.addEventListener('click', onImageClick))
        // 导航栏：滚动后毛玻璃，下滚隐藏、上滚出现
        onMounted(setupNavScroll)
    }
}