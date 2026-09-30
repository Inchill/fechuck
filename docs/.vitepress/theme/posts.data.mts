import { createContentLoader } from 'vitepress'

export interface Post {
  title: string
  url: string
  date: string // YYYY-MM-DD
  year: string
  excerpt: string
  tags: string[]
  words: number // 正文字数（中文按字、英文按词，不含代码块），首页统计用
}

// 从正文首个 H1 提取标题（避免在 frontmatter 里重复写 title）
function extractTitle(src?: string): string {
  if (!src) return ''
  // 去掉开头的 frontmatter 块
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const m = body.match(/^#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : ''
}

// 兜底摘要：正文首个「正常段落」压成一句话
// 跳过 H1 标题、其余标题、代码块、引用、HTML/组件、图片、列表等非叙述内容
function extractExcerpt(src?: string): string {
  if (!src) return ''
  let body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  // 去掉围栏代码块，避免把代码当摘要
  body = body.replace(/```[\s\S]*?```/g, '')
  const lines = body.split(/\r?\n/)
  const buf: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      if (buf.length) break // 段落结束
      continue
    }
    // 跳过标题 / 引用 / 列表 / 表格 / HTML 或 Vue 组件 / 图片 / 分隔线
    if (/^(#|>|[-*+]\s|\d+\.\s|\||<|!\[|---|===)/.test(line)) {
      if (buf.length) break
      continue
    }
    buf.push(line)
  }
  let text = buf.join(' ')
  // 去掉 markdown 行内标记：链接、强调、行内代码
  text = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // 截到第一个句末标点，最长约 80 字
  const stop = text.search(/[。！？]/)
  if (stop >= 0 && stop < 80) return text.slice(0, stop + 1)
  return text.length > 80 ? text.slice(0, 80) + '…' : text
}

// 粗略字数：去掉 frontmatter / 代码块 / 链接地址 / HTML 后，中文按字、英文按词计
function countWords(src?: string): number {
  if (!src) return 0
  const body = src
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\]\([^)]*\)/g, ']')
  const cjk = body.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const latin = body.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0
  return cjk + latin
}

declare const data: Post[]
export { data }

// 匹配所有年份目录下的文章（20xx/xxx.md），新增年份目录自动纳入
export default createContentLoader('20*/*.md', {
  includeSrc: true,
  transform(raw): Post[] {
    return raw
      .filter(({ frontmatter }) => !frontmatter.draft)
      .map(({ url, frontmatter, src }) => {
        // YAML 会把 `date: 2024-11-20` 解析成 Date，这里统一成 YYYY-MM-DD
        const date = frontmatter.date
          ? new Date(frontmatter.date).toISOString().slice(0, 10)
          : ''
        return {
          title: extractTitle(src),
          url,
          date,
          year: date.slice(0, 4),
          // 优先手写 description，没有则自动抽正文首段兜底
          excerpt: frontmatter.description ?? extractExcerpt(src),
          tags: frontmatter.tags ?? [],
          words: countWords(src)
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }
})
