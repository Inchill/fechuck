// 分享卡片（Open Graph 图片）：构建时给每篇文章 / 随想生成一张 1200×630 的 PNG，
// 链接发到微信、Twitter、Slack 等地方时显示成一张带标题的卡片。
// 渲染用 @resvg/resvg-js（SVG → PNG），中文字体取系统字体：
// 本地 macOS 用苹方 / 冬青黑体，GitHub Actions 上由 deploy.yml 安装 Noto Sans CJK。
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { HeadConfig, PageData } from 'vitepress'

export const hostname = 'https://www.fechuck.com'
const SITE_TITLE = '休言的博客'
const SITE_DESC = '在 AI 时代，一个软件工程师的思考与实践，不局限于前端。'

const W = 1200
const H = 630
const SANS = `'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif`
const MONO = `'JetBrains Mono', 'SF Mono', Menlo, 'DejaVu Sans Mono', monospace`

export interface OgEntry {
  slug: string // 2024/elasticsearch.md → 2024-elasticsearch
  title: string
  date: string // YYYY-MM-DD
  kind: '文章' | '随想'
}

/** relativePath（2024/elasticsearch.md）→ 图片文件名 */
export const slugOf = (relativePath: string) =>
  relativePath.replace(/\.md$/, '').replace(/\//g, '-')

/** 这个页面是否是会生成专属卡片的文章 / 随想 */
export const isOgPage = (relativePath: string) =>
  /^20\d\d\/.+\.md$/.test(relativePath) || /^notes\/(?!index\.md$).+\.md$/.test(relativePath)

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 粗略估算字宽（单位：em），用来给 SVG 文本手动换行
function charWidth(c: string) {
  if (/[⺀-鿿＀-￯　-〿]/.test(c)) return 1
  if (c === ' ') return 0.3
  if (/[A-Z]/.test(c)) return 0.68
  if (/[mwMW]/.test(c)) return 0.85
  return 0.55
}

/** 按宽度换行：中文逐字断，英文按整词断；超过 maxLines 行时末行加省略号 */
function wrap(text: string, maxEm: number, maxLines: number) {
  const tokens = text.match(/[⺀-鿿＀-￯　-〿]|[^\s⺀-鿿＀-￯　-〿]+|\s+/g) ?? []
  const lines: string[] = []
  let line = ''
  let w = 0
  for (const tk of tokens) {
    const tw = [...tk].reduce((s, c) => s + charWidth(c), 0)
    if (w + tw > maxEm && line.trim()) {
      lines.push(line.trim())
      line = /^\s+$/.test(tk) ? '' : tk
      w = /^\s+$/.test(tk) ? 0 : tw
    } else {
      line += tk
      w += tw
    }
  }
  if (line.trim()) lines.push(line.trim())
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = [...kept[maxLines - 1]].slice(0, -1).join('') + '…'
    return kept
  }
  return lines
}

function cardSvg(title: string, sub: string, kind: string) {
  const clean = title.replace(/\p{Extended_Pictographic}/gu, '').trim()
  const size = [...clean].length > 28 ? 58 : 66
  const lines = wrap(clean, (W - 160) / size, 3)
  const lineH = size * 1.28
  // 标题块在 170~500 之间垂直居中
  const top = 170 + (330 - lines.length * lineH) / 2 + size * 0.9
  const titleSvg = lines
    .map((l, i) => `<text x="80" y="${Math.round(top + i * lineH)}" font-size="${size}" font-weight="700" fill="#e7edf1" letter-spacing="-1">${esc(l)}</text>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}">
  <defs>
    <radialGradient id="g1" cx="88%" cy="0%" r="75%">
      <stop offset="0" stop-color="#6cb6f5" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#6cb6f5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="0%" cy="100%" r="70%">
      <stop offset="0" stop-color="#3ddc9a" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#3ddc9a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6cb6f5"/>
      <stop offset="1" stop-color="#3ddc9a"/>
    </linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.2" fill="#26323c"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#0b0f14"/>
  <rect width="${W}" height="${H}" fill="url(#dots)" opacity="0.7"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>

  <!-- 站点 logo（与 public/logo.svg 同一图形：渐变圆角方块 + 终端提示符 >_） -->
  <svg x="80" y="72" width="48" height="48" viewBox="4 4 56 56">
    <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#brand)"/>
    <path d="M21 23.5 L30.5 32 L21 40.5" fill="none" stroke="#0b0f14" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M34.5 41 H44" fill="none" stroke="#0b0f14" stroke-width="5.2" stroke-linecap="round"/>
  </svg>
  <text x="144" y="106" font-size="26" fill="#e7edf1">${SITE_TITLE}</text>
  ${kind ? `<text x="${W - 80}" y="106" font-size="22" fill="#93a5b1" text-anchor="end">${esc(kind)}</text>` : ''}

  ${titleSvg}

  <rect x="80" y="516" width="64" height="4" rx="2" fill="url(#brand)"/>
  <text x="80" y="566" font-size="24" fill="#93a5b1" font-family="${MONO}">${esc(sub)}</text>
  <text x="${W - 80}" y="566" font-size="24" fill="#5d6e79" text-anchor="end" font-family="${MONO}">fechuck.com</text>
</svg>`
}

function render(svg: string) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: true, defaultFontFamily: 'Noto Sans CJK SC' }
  })
    .render()
    .asPng()
}

/** 在 buildEnd 里调用：生成 og/default.png 和每篇文章的 og/<slug>.png */
export function generateOgImages(outDir: string, entries: OgEntry[]) {
  const dir = path.join(outDir, 'og')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'default.png'), render(cardSvg('写代码，也写思考。', '文章 · 随想', '')))
  for (const e of entries) {
    const png = render(cardSvg(e.title, e.date.replaceAll('-', '.'), e.kind))
    writeFileSync(path.join(dir, `${e.slug}.png`), png)
  }
}

/** transformHead：给每个页面加上 Open Graph / Twitter 卡片的 meta */
export function ogHead(pageData: PageData): HeadConfig[] {
  const own = isOgPage(pageData.relativePath) && !pageData.frontmatter.draft
  const title = pageData.title || SITE_TITLE
  const desc = pageData.frontmatter.description || pageData.description || SITE_DESC
  const url = `${hostname}/${pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')}`
  const image = `${hostname}/og/${own ? slugOf(pageData.relativePath) : 'default'}.png`
  return [
    ['meta', { property: 'og:type', content: own ? 'article' : 'website' }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: desc }],
    ['meta', { property: 'og:url', content: url }],
    ['meta', { property: 'og:image', content: image }],
    ['meta', { property: 'og:image:width', content: String(W) }],
    ['meta', { property: 'og:image:height', content: String(H) }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: desc }],
    ['meta', { name: 'twitter:image', content: image }]
  ]
}
