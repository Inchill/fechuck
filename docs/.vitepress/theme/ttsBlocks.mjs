// 朗读用的「分段规则」：浏览器端（ReadAloud.vue）和生成音频的脚本（scripts/tts.mjs）共用同一份，
// 保证两边切出来的段落和文字完全一致，才能按内容哈希对上音频文件

// 不读的部分：代码、表格、脚注、标题旁的 # 锚点等
export const SKIP = 'div[class*="language-"], pre, table, .custom-block-title, .header-anchor, sup, .footnotes'

/** 从正文根节点（.vp-doc）按顺序取出要朗读的段落 */
export function collectBlocks(root) {
  const out = []
  if (!root) return out
  for (const el of root.querySelectorAll('h1, h2, h3, h4, p, li')) {
    if (el.closest(SKIP)) continue
    // 列表项里有 <p> 时，段落会单独读，这里跳过
    if (el.tagName === 'LI' && [...el.children].some((c) => c.tagName === 'P')) continue
    const c = el.cloneNode(true)
    c.querySelectorAll(`${SKIP}, ul, ol`).forEach((n) => n.remove())
    const text = normalize(c.textContent || '')
    if (text) out.push({ el, text })
  }
  return out
}

export function normalize(s) {
  return s.replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim()
}

/** cyrb53：53 位字符串哈希，够用且两端都能算 */
export function hash(str) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** 某个声音读某段文字对应的音频文件名 */
export const audioId = (voice, text) => hash(`${voice}|${text}`)
