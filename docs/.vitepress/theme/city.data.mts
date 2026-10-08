// 「建造回放」的数据：构建时读 git 历史，算出每次提交改了哪些文件、各加删了多少行
// 浏览器端按顺序累加，就能还原任意时刻每个文件有多少行（= 楼有多高）
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface CityCommit {
  h: string // 短哈希
  d: string // 日期 YYYY-MM-DD
  m: string // 提交说明
  ai: boolean // 提交信息里带有 AI 协作者（Co-Authored-By: Claude 等）
  f: [number, number, number][] // [文件序号, 新增行, 删除行]
}
export interface CityZone {
  id: string
  name: string
  color: string
}
export interface CityData {
  paths: string[]
  zone: number[] // 每个文件属于哪个街区（zones 的下标）
  zones: CityZone[]
  commits: CityCommit[]
}

declare const data: CityData
export { data }

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

// 只统计「人写的」文本文件：跳过依赖缓存、构建产物、锁文件、图片音频等
const SKIP = [
  /(^|\/)node_modules\//,
  /^docs\/\.vitepress\/(cache|dist)\//,
  /^docs\/public\//,
  /^public\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /\.(png|jpe?g|gif|webp|ico|svg|mp3|m4a|woff2?|ttf|bak)$/i,
  /(^|\/)CNAME$/,
  /(^|\/)\.(npmrc|gitignore|nvmrc)$/
]
// 街区：导航栏里的每个菜单自动成为一个街区（菜单名 = 街区名），代码按类型另分几个街区
// 以后在 config.mts 的 nav 里加菜单，城里就会多出一个同名街区，不用改这里
const NAV_COLORS = ['#3ddc9a', '#2fae82', '#a48be6', '#f0a868', '#e88aa8', '#7fd1d1', '#c5d86d']
const CODE_ZONES: CityZone[] = [
  { id: 'components', name: '组件', color: '#6cb6f5' },
  { id: 'theme', name: '主题与配置', color: '#4b8fd6' },
  { id: 'infra', name: '工程', color: '#d3a95c' },
  { id: 'pages', name: '其他页面', color: '#8a98a3' }
]

/** 从 config.mts 里读出导航菜单：[{ name: '文章', dir: 'posts' }, …] */
function readNav(): { name: string; dir: string }[] {
  try {
    const src = readFileSync(ROOT + 'docs/.vitepress/config.mts', 'utf8')
    const block = src.match(/\bnav:\s*\[([\s\S]*?)\n\s*\]/)?.[1] ?? ''
    return [...block.matchAll(/text:\s*['"]([^'"]+)['"]\s*,\s*link:\s*['"]\/([^/'"]+)\/?['"]/g)].map((m) => ({ name: m[1], dir: m[2] }))
  } catch {
    return []
  }
}

function zoner(nav: { name: string; dir: string }[]) {
  const zones: CityZone[] = [...nav.map((n, k) => ({ id: 'nav:' + n.dir, name: n.name, color: NAV_COLORS[k % NAV_COLORS.length] })), ...CODE_ZONES]
  const at = (id: string) => zones.findIndex((z) => z.id === id)
  const of = (p: string) => {
    if (p.startsWith('docs/.vitepress/theme/components/')) return at('components')
    if (p.startsWith('docs/.vitepress/')) return at('theme')
    for (const n of nav) {
      if (p.startsWith(`docs/${n.dir}/`)) return at('nav:' + n.dir)
      // 「文章」菜单指向 /posts/，但文章本身按年份放在 docs/2024/ 这样的目录里
      if (n.dir === 'posts' && /^docs\/20\d\d\//.test(p)) return at('nav:' + n.dir)
    }
    if (p.startsWith('docs/')) return at('pages')
    return at('infra')
  }
  return { zones, of }
}

const AI = /co-authored-by:.*(claude|anthropic|copilot|gpt|openai|cursor|codex)/i

export default {
  load(): CityData {
    // 本地调试用：可以直接读一份导出的 JSON
    if (process.env.CITY_JSON && existsSync(process.env.CITY_JSON)) return JSON.parse(readFileSync(process.env.CITY_JSON, 'utf8'))
    let raw = ''
    try {
      raw = execFileSync(
        'git',
        [
          '-c',
          'core.quotePath=false',
          'log',
          '--reverse',
          '--no-merges',
          '--no-renames',
          '--numstat',
          '--date=short',
          '--format=@@%h%x1f%ad%x1f%s%x1f%(trailers:key=Co-Authored-By,valueonly,separator=%x2C)'
        ],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
      )
    } catch {
      return { paths: [], zone: [], zones: [], commits: [] } // 不是 git 仓库（或者浅克隆）时，页面显示提示
    }
    const paths: string[] = []
    const index = new Map<string, number>()
    const commits: CityCommit[] = []
    for (const chunk of raw.split('@@').slice(1)) {
      const [head, ...lines] = chunk.split('\n')
      const [h, d, m, co = ''] = head.split('\x1f')
      const f: CityCommit['f'] = []
      for (const line of lines) {
        const mm = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
        if (!mm || mm[1] === '-') continue // 二进制文件没有行数
        const p = mm[3].replace(/^"(.*)"$/, '$1')
        if (SKIP.some((re) => re.test(p))) continue
        if (!index.has(p)) {
          index.set(p, paths.length)
          paths.push(p)
        }
        f.push([index.get(p)!, +mm[1], +mm[2]])
      }
      if (f.length) commits.push({ h, d, m, ai: AI.test('co-authored-by: ' + co), f })
    }
    // 归街区，并去掉没有文件的街区
    const { zones, of } = zoner(readNav())
    const raw0 = paths.map(of)
    const used = zones.map((_, i) => raw0.includes(i))
    const remap = zones.map((_, i) => used.slice(0, i).filter(Boolean).length)
    return { paths, zone: raw0.map((z) => remap[z]), zones: zones.filter((_, i) => used[i]), commits }
  }
}
