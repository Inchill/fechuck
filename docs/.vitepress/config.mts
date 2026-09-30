import { defineConfig, createContentLoader, type SiteConfig } from 'vitepress'
import { Feed } from 'feed'
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { hostname, generateOgImages, ogHead, isOgPage, slugOf, type OgEntry } from './og.mjs'

// 从正文首个 H1 提取标题（与 posts.data.ts 保持一致）
function extractTitle(src?: string): string {
  if (!src) return ''
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const m = body.match(/^#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : ''
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "休言的博客",
  description: "在 AI 时代，一个软件工程师的思考与实践，不局限于前端。",
  // dark-first：默认暗色，保留右上角切换开关
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    // 字体：Latin=IBM Plex Sans，代码=JetBrains Mono（CJK 走系统回落）
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
    }],
    // RSS 订阅
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: '休言的博客', href: '/feed.xml' }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '文章', link: '/posts/' },
      { text: '随想', link: '/notes/' },
      { text: '关于', link: '/about/' },
    ],

    outline: {
      level: [2, 3],
      label: '本页目录'
    },

    lastUpdated: {
      text: '最后更新'
    },

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

  // 构建结束时生成 RSS（文章 + 碎片，按日期倒序，过滤 draft）
  // 文章 / 随想正文里没有 ## 或 ### 小标题时，右侧目录是空的：直接关掉侧栏，让正文居中
  // （在生成页面时就决定，避免先按有侧栏排版、加载后再跳到居中）
  transformPageData(pageData, { siteConfig }) {
    if (!/^(20\d\d|notes)\/(?!index\.md$).+\.md$/.test(pageData.relativePath)) return
    if (pageData.frontmatter.aside !== undefined) return
    try {
      const src = readFileSync(path.join(siteConfig.srcDir, pageData.relativePath), 'utf8')
      const body = src.replace(/```[\s\S]*?```/g, '')
      if (!/^#{2,3}\s/m.test(body)) pageData.frontmatter.aside = false
    } catch {}
  },

  // 每个页面加上分享卡片（Open Graph / Twitter）的 meta，图片由 buildEnd 生成
  transformHead({ pageData }) {
    return ogHead(pageData)
  },

  async buildEnd(config: SiteConfig) {
    const feed = new Feed({
      title: '休言的博客',
      description: '在 AI 时代，一个软件工程师的思考与实践，不局限于前端。',
      id: hostname,
      link: hostname,
      language: 'zh-CN',
      copyright: `Copyright © ${new Date().getFullYear()} 休言`,
      feedLinks: { rss: `${hostname}/feed.xml` }
    })

    const entries = await createContentLoader(['20*/*.md', 'notes/*.md'], {
      includeSrc: true
    }).load()

    entries
      .filter((e) => !e.frontmatter.draft && e.frontmatter.date)
      .sort((a, b) => +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date))
      .forEach((e) => {
        feed.addItem({
          title: extractTitle(e.src) || e.url,
          id: `${hostname}${e.url}`,
          link: `${hostname}${e.url}`,
          description: e.frontmatter.description ?? '',
          date: new Date(e.frontmatter.date)
        })
      })

    writeFileSync(path.join(config.outDir, 'feed.xml'), feed.rss2())

    // 分享卡片图片：每篇文章 / 随想一张，另加一张全站默认图
    const og: OgEntry[] = entries
      .filter((e) => !e.frontmatter.draft && e.frontmatter.date)
      .map((e) => {
        const rel = e.url.replace(/^\//, '').replace(/\.html$/, '.md')
        return { e, rel }
      })
      .filter(({ rel }) => isOgPage(rel))
      .map(({ e, rel }) => ({
        slug: slugOf(rel),
        title: extractTitle(e.src) || rel,
        date: new Date(e.frontmatter.date).toISOString().slice(0, 10),
        kind: rel.startsWith('notes/') ? '随想' : '文章'
      }))
    generateOgImages(config.outDir, og)
  }
})
