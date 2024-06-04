import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "休言的博客",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '文章', link: '/2024/web-view' },
    ],

    sidebar: [
      {
        text: '2024',
        items: [
          { text: '小程序内嵌 h5 如何跳转其它小程序？', link: '/2024/web-view' },
          { text: '程序员使用 Midjourney 的正确姿势', link: '/2024/mid-journey' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/inchill' }
    ]
  },
  markdown: {
    image: {
      // 默认禁用图片懒加载
      lazyLoading: true
    }
  }
})
