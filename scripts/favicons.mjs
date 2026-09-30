// 给书签页抓网站图标，存到 docs/public/bookmarks/icons/<域名>.<扩展名>
// 已经有的跳过；抓不到的在页面上显示首字母。图标提交进仓库，部署时只补抓缺的
// 某个网站抓不到或抓得不好看，手动放一张 <域名>.png（如 excalidraw.com.png）进去即可
//   node scripts/favicons.mjs          只抓缺的
//   node scripts/favicons.mjs --force  全部重新抓
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import groups from '../docs/bookmarks/links.mts'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../docs/public/bookmarks/icons')
const FORCE = process.argv.includes('--force')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const EXT = { 'image/png': 'png', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '')

async function get(url, ms = 8000) {
  return fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(ms) })
}

// 从首页 HTML 里找图标：优先 apple-touch-icon（尺寸大、清晰），其次标了 sizes 的最大 icon，最后 /favicon.ico
async function candidates(pageUrl) {
  const list = []
  try {
    const res = await get(pageUrl)
    const html = (await res.text()).slice(0, 200_000)
    const base = res.url || pageUrl
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0]
      const rel = tag.match(/\brel=["']?([^"'>]+)/i)?.[1].toLowerCase() ?? ''
      const href = tag.match(/\bhref=["']?([^"'\s>]+)/i)?.[1]
      if (!href || !/\bicon\b/.test(rel)) continue
      const size = Number(tag.match(/\bsizes=["']?(\d+)/i)?.[1] ?? 0)
      const score = (rel.includes('apple-touch') ? 1000 : 0) + (size || 16) + (/\.svg(\?|$)/i.test(href) ? 500 : 0)
      try {
        list.push({ url: new URL(href.replace(/&amp;/g, '&'), base).href, score })
      } catch {}
    }
    list.push({ url: new URL('/favicon.ico', base).href, score: 0 })
  } catch {
    list.push({ url: new URL('/favicon.ico', pageUrl).href, score: 0 })
  }
  return list.sort((a, b) => b.score - a.score).map((c) => c.url)
}

// 网站自己拿不到（被墙、反爬、没有图标）时，再试公共的图标服务
const fallbacks = (host) => [
  `https://www.google.com/s2/favicons?domain=${host}&sz=128`,
  `https://icons.duckduckgo.com/ip3/${host}.ico`
]

async function fetchIcon(site) {
  // links.mts 里手动指定了 icon 的，优先用它
  const manual = site.icon ? [site.icon] : []
  for (const url of [...manual, ...(await candidates(site.url)), ...fallbacks(hostOf(site.url))]) {
    try {
      const res = await get(url)
      if (!res.ok) continue
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
      const ext = EXT[type] ?? url.match(/\.(png|ico|svg|jpe?g|webp|gif)(\?|$)/i)?.[1].toLowerCase()
      const buf = Buffer.from(await res.arrayBuffer())
      if (!ext || buf.length < 64 || buf.length > 500_000 || /^\s*</.test(buf.toString('utf8', 0, 20)) && ext !== 'svg') continue
      return { ext: ext === 'jpeg' ? 'jpg' : ext, buf }
    } catch {}
  }
  return null
}

mkdirSync(DIR, { recursive: true })
const have = new Map(readdirSync(DIR).map((f) => [f.replace(/\.[^.]+$/, ''), f]))
const sites = [...new Map(groups.flatMap((g) => g.sites).map((s) => [hostOf(s.url), s])).entries()]
const todo = sites.filter(([host]) => FORCE || !have.has(host))
console.log(`共 ${sites.length} 个网站，需要抓取 ${todo.length} 个`)

let ok = 0
const miss = []
let i = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < todo.length) {
    const [host, site] = todo[i++]
    const icon = await fetchIcon(site)
    if (!icon) {
      miss.push(host)
      continue
    }
    if (have.has(host)) rmSync(join(DIR, have.get(host)), { force: true })
    writeFileSync(join(DIR, `${host}.${icon.ext}`), icon.buf)
    ok++
  }
}))
console.log(`抓到 ${ok} 个${miss.length ? `，没抓到（显示首字母）：${miss.join('、')}` : ''}`)
