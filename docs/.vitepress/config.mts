import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "休言的博客",
  description: "A VitePress Site",
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  themeConfig: {
    logo: '/favicon.ico',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '文章', link: '/2024/pv' },
    ],

    outline: {
      label: '本页目录'
    },

    lastUpdated: {
      text: '最后更新'
    },

    sidebar: [
      {
        text: '2024',
        items: [
          { text: '如何统计页面的 PV&UV？', link: '/2024/pv' },
          { text: '数学编程之阻尼效应', link: '/2024/damping-effect' },
          { text: 'web 音频基础', link: '/2024/audio' },
          { text: 'Midjourney 的基本使用', link: '/2024/mid-journey' },
          { text: '小程序内嵌 h5 如何跳转其它小程序？', link: '/2024/web-view' }
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
    },
    math: true
  },
})
