// GEO（生成式引擎优化）：让 ChatGPT、Perplexity、Claude 这类 AI 搜索更容易读懂、更愿意引用这个博客
// - 每页的结构化数据（JSON-LD）：文章是 BlogPosting + 面包屑，首页是 WebSite，关于页是 ProfilePage
// - canonical、发布 / 更新时间、Markdown 版本的 alternate 链接
// - 构建结束时生成 llms.txt、llms-full.txt 和每篇文章的 .md 纯文本版本
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { HeadConfig, PageData } from 'vitepress'
import { hostname, isOgPage, slugOf } from './og.mjs'

export const SITE = {
  name: '休言的博客',
  desc: '在 AI 时代，一个软件工程师的思考与实践，不局限于前端。',
  lang: 'zh-CN'
}
// 作者信息：所有页面的结构化数据都指向这一个人，sameAs 帮 AI 把站点和你的其他主页对上
export const AUTHOR = {
  '@type': 'Person',
  '@id': `${hostname}/about/#person`,
  name: '休言',
  url: `${hostname}/about/`,
  jobTitle: '软件工程师',
  sameAs: ['https://github.com/inchill']
}

const pageUrl = (rel: string) => `${hostname}/${rel.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')}`
const mdUrl = (rel: string) => `${hostname}/${rel}`

/** 从源文件里取摘要：description 没写时，用正文第一段（和 RSS 的规则一致） */
export function excerptOf(src: string, max = 120): string {
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/```[\s\S]*?```/g, '')
  const buf: string[] = []
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      if (buf.length) break
      continue
    }
    if (/^(#|>|[-*+]\s|\d+\.\s|\||<|!\[|---|===|\[\[toc\]\])/.test(line)) {
      if (buf.length) break
      continue
    }
    buf.push(line)
  }
  const text = buf.join(' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  // 太长时尽量在句号处截断，保证是一句完整的话；实在没有句号才硬截
  const cut = text.slice(0, max)
  const end = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'), cut.lastIndexOf('. '))
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut + '…'
}

const toDate = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : undefined)
const ld = (data: object): HeadConfig => ['script', { type: 'application/ld+json' }, JSON.stringify({ '@context': 'https://schema.org', ...data })]

export function geoHead(pageData: PageData): HeadConfig[] {
  const rel = pageData.relativePath
  const fm = pageData.frontmatter
  const url = pageUrl(rel)
  const title = pageData.title || SITE.name
  const desc = fm.description || pageData.description || SITE.desc
  const head: HeadConfig[] = [['link', { rel: 'canonical', href: url }]]

  // 草稿：能访问，但不让搜索引擎和 AI 收录
  if (fm.draft) return [...head, ['meta', { name: 'robots', content: 'noindex' }]]

  if (isOgPage(rel)) {
    const published = toDate(fm.date)
    const modified = pageData.lastUpdated ? new Date(pageData.lastUpdated).toISOString().slice(0, 10) : published
    const isNote = rel.startsWith('notes/')
    head.push(
      ['link', { rel: 'alternate', type: 'text/markdown', href: mdUrl(rel), title: 'Markdown' }],
      ['meta', { name: 'author', content: AUTHOR.name }],
      ['meta', { property: 'article:author', content: AUTHOR.url }]
    )
    if (published) head.push(['meta', { property: 'article:published_time', content: published }])
    if (modified) head.push(['meta', { property: 'article:modified_time', content: modified }])
    for (const t of fm.tags ?? []) head.push(['meta', { property: 'article:tag', content: String(t) }])
    head.push(
      ld({
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: title,
        description: desc,
        url,
        mainEntityOfPage: url,
        inLanguage: SITE.lang,
        datePublished: published,
        dateModified: modified,
        author: AUTHOR,
        publisher: AUTHOR,
        image: `${hostname}/og/${slugOf(rel)}.png`,
        keywords: (fm.tags ?? []).join(', ') || undefined,
        articleSection: isNote ? '随想' : '文章',
        isPartOf: { '@type': 'WebSite', '@id': `${hostname}/#website`, name: SITE.name, url: `${hostname}/` },
        encodingFormat: 'text/html',
        associatedMedia: { '@type': 'MediaObject', contentUrl: mdUrl(rel), encodingFormat: 'text/markdown' }
      }),
      ld({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: `${hostname}/` },
          { '@type': 'ListItem', position: 2, name: isNote ? '随想' : '文章', item: `${hostname}/${isNote ? 'notes' : 'posts'}/` },
          { '@type': 'ListItem', position: 3, name: title, item: url }
        ]
      })
    )
    return head
  }

  if (rel === 'index.md') {
    head.push(
      ld({
        '@type': 'WebSite',
        '@id': `${hostname}/#website`,
        name: SITE.name,
        url: `${hostname}/`,
        description: SITE.desc,
        inLanguage: SITE.lang,
        author: AUTHOR,
        publisher: AUTHOR
      })
    )
  } else if (rel === 'about/index.md') {
    head.push(ld({ '@type': 'ProfilePage', url, name: title, inLanguage: SITE.lang, mainEntity: { ...AUTHOR, description: desc } }))
  } else if (/^(posts|notes|bookmarks)\/index\.md$/.test(rel)) {
    head.push(ld({ '@type': 'CollectionPage', url, name: title, description: desc, inLanguage: SITE.lang, isPartOf: { '@id': `${hostname}/#website` } }))
  }
  return head
}

/* ---------- llms.txt / llms-full.txt / 每篇文章的 .md ---------- */
export interface LlmsEntry {
  rel: string // 2025/claude-mcp.md
  title: string
  date: string
  desc: string
  src: string
}

// 去掉 frontmatter、Vue 组件和 [[toc]]，留下干净的 Markdown 正文
function cleanBody(src: string) {
  return src
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^\[\[toc\]\]\s*$/gm, '')
    .replace(/^<[A-Z][\w-]*\s*\/>\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function writeLlms(outDir: string, srcDir: string, entries: LlmsEntry[]) {
  const posts = entries.filter((e) => !e.rel.startsWith('notes/'))
  const notes = entries.filter((e) => e.rel.startsWith('notes/'))
  const line = (e: LlmsEntry) => `- [${e.title}](${mdUrl(e.rel)})：${e.desc}（${e.date}）`

  // 每篇文章一份纯 Markdown（和网页同路径，扩展名换成 .md）
  for (const e of entries) {
    const file = path.join(outDir, e.rel)
    mkdirSync(path.dirname(file), { recursive: true })
    const header = `---\ntitle: ${e.title}\nauthor: 休言\ndate: ${e.date}\nurl: ${pageUrl(e.rel)}\n---\n\n`
    writeFileSync(file, header + cleanBody(e.src) + '\n')
  }

  const about = existsSync(path.join(srcDir, 'about/index.md')) ? cleanBody(readFileSync(path.join(srcDir, 'about/index.md'), 'utf8')) : ''
  const llms = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.desc}作者：休言，软件工程师。`,
    '',
    '这是一个中文个人技术博客。「文章」是完整的技术长文（实践、原理、踩坑记录），「随想」是较短的观点和碎片。每个链接都是对应文章的纯 Markdown 版本，网页版把 .md 换成 .html 即可。',
    '',
    '## 文章',
    '',
    ...posts.map(line),
    '',
    '## 随想',
    '',
    ...notes.map(line),
    '',
    '## 其他',
    '',
    `- [关于](${hostname}/about/)：作者介绍和联系方式`,
    `- [书签](${hostname}/bookmarks/)：作者收藏的网站，按 AI、电子书、工具、设计等分类`,
    `- [实验室](${hostname}/lab/)：几个互动小实验，包括代码仓库的建造回放、文章星图、Token 显微镜、上下文窗口模拟器、Web Vitals 心电图`,
    `- [全文合集](${hostname}/llms-full.txt)：所有文章和随想的完整 Markdown`,
    `- [RSS](${hostname}/feed.xml)`,
    ''
  ].join('\n')
  writeFileSync(path.join(outDir, 'llms.txt'), llms)

  const full = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.desc}`,
    '',
    about,
    '',
    ...entries.map((e) => `\n---\n\n<!-- ${pageUrl(e.rel)} · ${e.date} -->\n\n${cleanBody(e.src)}`)
  ].join('\n')
  writeFileSync(path.join(outDir, 'llms-full.txt'), full + '\n')
}

/** 扫一遍源文件，找出草稿页（sitemap 里去掉它们） */
export function draftUrls(srcDir: string): Set<string> {
  const out = new Set<string>()
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.name.startsWith('.') || f.name === 'public' || f.name === 'node_modules') continue
      const p = path.join(dir, f.name)
      if (f.isDirectory()) walk(p)
      else if (f.name.endsWith('.md') && /^---[\s\S]*?\ndraft:\s*true[\s\S]*?\n---/.test(readFileSync(p, 'utf8'))) {
        out.add(path.relative(srcDir, p).replace(/\\/g, '/').replace(/\.md$/, '.html'))
      }
    }
  }
  walk(srcDir)
  return out
}
