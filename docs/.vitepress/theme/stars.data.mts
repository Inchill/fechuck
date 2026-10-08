// 「文章星图」的数据：构建时按文章内容算出两两之间的相似度，再把它们摊到一张二维平面上
// 不调用任何模型：中文按相邻两个字（bigram）、英文按单词切词，用 TF-IDF 加余弦相似度衡量「讲的东西像不像」
// 平面坐标用经典 MDS（多维缩放），相近的文章自然靠在一起；再用层次聚类分成几个「星座」
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export interface Star {
  title: string
  url: string
  date: string
  kind: '文章' | '随想'
  words: number
  x: number // 0~1
  y: number // 0~1
  c: number // 所属星座
  near: number[] // 最相近的几篇（下标）
}
export interface StarData {
  stars: Star[]
  links: [number, number, number][] // [a, b, 相似度]
  groups: { name: string; terms: string[] }[]
}

declare const data: StarData
export { data }

const DOCS = fileURLToPath(new URL('../../', import.meta.url))

// 常见但没有区分度的词
const STOP = new Set(
  (
    '的是了在和也有就不都而及与或一个这个那个我们你们他们可以进行通过如果因为所以但是然后就是还是这样那样什么怎么为了这些那些以及其中并且需要使用时候问题方法实现一下自己没有已经一些比如可能其实当然之后之前对于' +
    ' the a an and or of to in on for is are be with as by it this that from at we you can if not use using will'
  )
    .split(/\s+|(?<=[一-鿿])(?=[一-鿿])/)
    .filter(Boolean)
)

function readDocs() {
  const out: { title: string; url: string; date: string; kind: '文章' | '随想'; text: string }[] = []
  const dirs = readdirSync(DOCS).filter((d) => /^20\d\d$/.test(d)).map((d) => [d, '文章'] as const)
  dirs.push(['notes', '随想'] as never)
  for (const [dir, kind] of dirs) {
    const full = path.join(DOCS, dir)
    if (!existsSync(full)) continue
    for (const f of readdirSync(full)) {
      if (!f.endsWith('.md') || f === 'index.md') continue
      const src = readFileSync(path.join(full, f), 'utf8')
      const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
      if (/^draft:\s*true/m.test(fm)) continue
      const date = fm.match(/^date:\s*['"]?([\d-]+)/m)?.[1] ?? ''
      if (!date) continue
      const body = src.replace(/^---[\s\S]*?\n---/, '')
      const title = body.match(/^#\s+(.+)$/m)?.[1].trim() ?? f
      const tags = fm.match(/^tags:\s*\[(.*)\]/m)?.[1] ?? ''
      // 去掉代码块、链接地址、图片和 HTML，留下叙述文字；标题和标签多算几遍，权重更高
      const text = [title, title, tags, tags, body.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/<[^>]+>/g, ' ')].join('\n')
      out.push({ title, url: `/${dir}/${f.replace(/\.md$/, '.html')}`, date, kind, text })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

function tokens(text: string) {
  const out: string[] = []
  for (const m of text.toLowerCase().matchAll(/[一-鿿]+|[a-z][a-z0-9+#.-]{1,}/g)) {
    const w = m[0]
    if (/^[a-z]/.test(w)) {
      const t = w.replace(/[.-]+$/, '')
      if (!STOP.has(t) && t.length > 1) out.push(t)
    } else {
      for (let i = 0; i < w.length - 1; i++) {
        const bi = w.slice(i, i + 2)
        if (!STOP.has(bi) && !STOP.has(bi[0]) && !STOP.has(bi[1])) out.push(bi)
      }
    }
  }
  return out
}

// 经典 MDS：距离矩阵 → 双中心化 → 取前两个特征向量（幂迭代）
function mds(dist: number[][]): [number, number][] {
  const n = dist.length
  const d2 = dist.map((r) => r.map((v) => v * v))
  const rowMean = d2.map((r) => r.reduce((a, b) => a + b, 0) / n)
  const all = rowMean.reduce((a, b) => a + b, 0) / n
  const B = d2.map((r, i) => r.map((v, j) => -0.5 * (v - rowMean[i] - rowMean[j] + all)))
  const eig = (M: number[][], deflate?: { v: number[]; l: number }) => {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i + 1)) // 固定初值，结果可复现
    let l = 0
    for (let it = 0; it < 300; it++) {
      let w = M.map((r) => r.reduce((s, x, j) => s + x * v[j], 0))
      if (deflate) {
        const dot = deflate.v.reduce((s, x, j) => s + x * v[j], 0)
        w = w.map((x, i) => x - deflate.l * dot * deflate.v[i])
      }
      const norm = Math.hypot(...w) || 1
      l = norm
      v = w.map((x) => x / norm)
    }
    return { v, l }
  }
  const e1 = eig(B)
  const e2 = eig(B, e1)
  return e1.v.map((_, i) => [e1.v[i] * Math.sqrt(e1.l), e2.v[i] * Math.sqrt(e2.l)])
}

export default {
  watch: ['../../20*/*.md', '../../notes/*.md'],
  load(): StarData {
    const docs = readDocs()
    const n = docs.length
    if (n < 2) return { stars: [], links: [], groups: [] }

    // TF-IDF
    const tfs = docs.map((d) => {
      const m = new Map<string, number>()
      for (const t of tokens(d.text)) m.set(t, (m.get(t) ?? 0) + 1)
      return m
    })
    const df = new Map<string, number>()
    for (const m of tfs) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1)
    const vecs = tfs.map((m) => {
      const v = new Map<string, number>()
      let norm = 0
      for (const [t, c] of m) {
        const dfi = df.get(t)!
        // 只看「至少两篇都出现、又不是篇篇都有」的词：只出现在一篇里的词对「像不像」没有贡献
        if (dfi < 2 || dfi > n * 0.6) continue
        const w = (1 + Math.log(c)) * Math.log((1 + n) / dfi)
        v.set(t, w)
        norm += w * w
      }
      norm = Math.sqrt(norm) || 1
      for (const [t, w] of v) v.set(t, w / norm)
      return v
    })
    const cos = (a: Map<string, number>, b: Map<string, number>) => {
      let s = 0
      for (const [t, w] of a) s += w * (b.get(t) ?? 0)
      return s
    }
    const sim = vecs.map((a) => vecs.map((b) => cos(a, b)))

    // 二维坐标，归一化到 0~1（留边）
    const pts = mds(sim.map((r) => r.map((s) => Math.sqrt(Math.max(0, 1 - s)))))
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const nx = (v: number) => (v - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs) || 1)
    const ny = (v: number) => (v - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys) || 1)

    // 分组：在二维平面上做 k-means（位置本身就代表内容相近程度），离得近的归成一个「星座」
    const P = docs.map((_, i) => [nx(xs[i]), ny(ys[i])])
    const k = Math.min(n, Math.max(2, Math.round(Math.sqrt(n / 2)) + 1))
    // 初始中心：最远点采样，结果稳定可复现
    const centers = [P[0]]
    while (centers.length < k) {
      let far = 0
      let farD = -1
      P.forEach((p, i) => {
        const d = Math.min(...centers.map((c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2))
        if (d > farD) (farD = d), (far = i)
      })
      centers.push(P[far])
    }
    const cOf = new Array(n).fill(0)
    for (let it = 0; it < 50; it++) {
      P.forEach((p, i) => {
        let best = 0
        let bd = Infinity
        centers.forEach((c, j) => {
          const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2
          if (d < bd) (bd = d), (best = j)
        })
        cOf[i] = best
      })
      centers.forEach((_, j) => {
        const mem = P.filter((_, i) => cOf[i] === j)
        if (mem.length) centers[j] = [mem.reduce((s, p) => s + p[0], 0) / mem.length, mem.reduce((s, p) => s + p[1], 0) / mem.length]
      })
    }
    const clusters = centers.map((_, j) => docs.map((_, i) => i).filter((i) => cOf[i] === j)).filter((c) => c.length)
    clusters.forEach((cl, j) => cl.forEach((i) => (cOf[i] = j)))

    // 星座名：这一组里权重最高的几个词（英文优先保留原样，中文取 bigram）
    const groups = clusters.map((cl) => {
      const score = new Map<string, number>()
      for (const i of cl) for (const [t, w] of vecs[i]) score.set(t, (score.get(t) ?? 0) + w)
      // 在组内出现得多、在组外出现得少的词更能代表这一组
      for (const [t] of score) {
        const inside = cl.filter((i) => vecs[i].has(t)).length
        if (inside < Math.min(2, cl.length)) score.delete(t)
      }
      const terms = [...score.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t)
        .filter((t, i, arr) => !arr.slice(0, i).some((p) => p.includes(t) || t.includes(p)))
        .slice(0, 3)
      return { name: terms.join(' · '), terms }
    })

    // 连线：每篇连到最相近的 2 篇（相似度太低就不连）
    const links: StarData['links'] = []
    const seen = new Set<string>()
    const near = sim.map((row, i) =>
      row
        .map((s, j) => [s, j] as const)
        .filter(([, j]) => j !== i)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 3)
    )
    near.forEach((list, i) =>
      list.slice(0, 2).forEach(([s, j]) => {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`
        if (s > 0.06 && !seen.has(k)) seen.add(k), links.push([i, j, +s.toFixed(3)])
      })
    )

    const stars: Star[] = docs.map((d, i) => ({
      title: d.title,
      url: d.url,
      date: d.date,
      kind: d.kind,
      words: [...d.text.matchAll(/[一-鿿]|[a-z]+/gi)].length,
      x: +(0.08 + nx(xs[i]) * 0.84).toFixed(4),
      y: +(0.1 + ny(ys[i]) * 0.8).toFixed(4),
      c: cOf[i],
      near: near[i].map(([, j]) => j)
    }))
    return { stars, links, groups }
  }
}
