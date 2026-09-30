import { createContentLoader } from 'vitepress'

export interface Note {
  title: string
  url: string
  date: string // YYYY-MM-DD
  excerpt: string
  tags: string[]
  words: number // 正文字数，随想页顶部的阅读时长用
}

function extractTitle(src?: string): string {
  if (!src) return ''
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const m = body.match(/^#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : ''
}

// 粗略字数：与 posts.data.mts 保持一致（去掉 frontmatter / 代码块 / 链接地址 / HTML，中文按字、英文按词）
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

declare const data: Note[]
export { data }

// 碎片：docs/notes/ 下每条一个 md（index.md 是列表页，排除）
export default createContentLoader('notes/*.md', {
  includeSrc: true,
  transform(raw): Note[] {
    return raw
      .filter(({ url, frontmatter }) => url !== '/notes/' && !frontmatter.draft)
      .map(({ url, frontmatter, src }) => ({
        title: extractTitle(src),
        url,
        date: frontmatter.date
          ? new Date(frontmatter.date).toISOString().slice(0, 10)
          : '',
        excerpt: frontmatter.description ?? '',
        tags: frontmatter.tags ?? [],
        words: countWords(src)
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }
})
