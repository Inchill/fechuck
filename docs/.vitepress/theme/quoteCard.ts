// 划词引用卡片：把选中的一句话画成一张可分享的图片（纯 Canvas，不依赖任何库）
// 跟随当前明暗主题，用站点配色和 logo

export interface QuoteCardInput {
  quote: string
  title: string // 文章标题
  date: string // YYYY.MM.DD
  dark: boolean
}

const W = 1080
const PAD = 96
const SANS = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
const MONO = `"JetBrains Mono", "SF Mono", Menlo, monospace`

const PALETTE = {
  light: { bg: '#ffffff', text: '#101820', text2: '#55666e', text3: '#8a9aa2', info: '#1f6fb2', stable: '#147a5a', line: '#e3eaed' },
  dark: { bg: '#0b0f14', text: '#e7edf1', text2: '#93a5b1', text3: '#5d6e79', info: '#6cb6f5', stable: '#3ddc9a', line: '#1c2530' }
}

const CJK = /[⺀-鿿＀-￯　-〿]/
// 不能出现在行首的标点（避头尾），换行时和前一个字一起走
const NO_LINE_START = /^[，。、；：！？）》」』”’,.;:!?)\]]/

/** 按宽度换行：中文逐字、英文按整词，处理行首标点 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const tokens = text.match(/[⺀-鿿＀-￯　-〿]|[^\s⺀-鿿＀-￯　-〿]+|\s+/g) ?? []
  const lines: string[] = []
  let line = ''
  for (const tk of tokens) {
    const next = line + tk
    if (ctx.measureText(next).width <= maxW || !line.trim()) {
      line = next
      continue
    }
    if (NO_LINE_START.test(tk)) {
      // 标点挤进当前行末尾，把当前行最后一个字挪到下一行
      const chars = [...line]
      const last = chars.pop() ?? ''
      lines.push(chars.join('').trimEnd())
      line = last + tk
    } else {
      lines.push(line.trimEnd())
      line = /^\s+$/.test(tk) ? '' : tk
    }
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 站点 logo：渐变圆角方块 + 终端提示符 >_（与 public/logo.svg 同一图形） */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c: typeof PALETTE.light) {
  const s = size / 56
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0.15, '#6cb6f5')
  g.addColorStop(1, '#3ddc9a')
  ctx.fillStyle = g
  roundRect(ctx, x, y, size, size, 16 * s)
  ctx.fill()
  ctx.save()
  ctx.translate(x - 4 * s, y - 4 * s)
  ctx.scale(s, s)
  ctx.strokeStyle = '#0b0f14'
  ctx.lineWidth = 5.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(21, 23.5)
  ctx.lineTo(30.5, 32)
  ctx.lineTo(21, 40.5)
  ctx.moveTo(34.5, 41)
  ctx.lineTo(44, 41)
  ctx.stroke()
  ctx.restore()
  void c
}

export async function renderQuoteCard(input: QuoteCardInput): Promise<string> {
  const c = input.dark ? PALETTE.dark : PALETTE.light
  // 等网页字体就绪，避免画出来是回退字体
  try {
    await document.fonts?.ready
  } catch {}

  const scratch = document.createElement('canvas').getContext('2d')!
  const quote = input.quote.replace(/\s+/g, ' ').trim()
  const len = [...quote].length
  const qSize = len > 120 ? 36 : len > 60 ? 42 : 50
  const qLH = Math.round(qSize * 1.7)
  scratch.font = `500 ${qSize}px ${SANS}`
  let lines = wrap(scratch, quote, W - PAD * 2)
  const MAX = 12
  if (lines.length > MAX) {
    lines = lines.slice(0, MAX)
    lines[MAX - 1] = lines[MAX - 1].replace(/.{1}$/u, '') + '…'
  }
  scratch.font = `400 28px ${SANS}`
  const titleLines = wrap(scratch, `《${input.title}》`, W - PAD * 2).slice(0, 2)

  // 纵向排版
  const top = PAD + 20
  const quoteMarkH = 110
  const quoteTop = top + quoteMarkH
  const quoteH = lines.length * qLH
  const barY = quoteTop + quoteH + 44
  const titleTop = barY + 52
  const titleH = titleLines.length * 44
  const footTop = titleTop + titleH + 72
  const H = Math.max(900, footTop + 56 + PAD)

  const canvas = document.createElement('canvas')
  const scale = 2 // 输出 2 倍图，发到手机上也清晰
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  // 背景：底色 + 两团品牌色柔光 + 点阵
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, W, H)
  const g1 = ctx.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W * 0.8)
  g1.addColorStop(0, input.dark ? 'rgba(108,182,245,0.22)' : 'rgba(31,111,178,0.10)')
  g1.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)
  const g2 = ctx.createRadialGradient(0, H, 0, 0, H, W * 0.8)
  g2.addColorStop(0, input.dark ? 'rgba(61,220,154,0.16)' : 'rgba(20,122,90,0.08)')
  g2.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = c.line
  for (let x = 28; x < W; x += 28) for (let y = 28; y < H; y += 28) ctx.fillRect(x, y, 1.6, 1.6)

  // 大引号（品牌渐变）
  const qg = ctx.createLinearGradient(PAD, top, PAD + 120, top + 120)
  qg.addColorStop(0, c.info)
  qg.addColorStop(1, c.stable)
  ctx.fillStyle = qg
  ctx.font = `700 180px Georgia, "Times New Roman", serif`
  ctx.fillText('“', PAD - 8, top + 150)

  // 引文
  ctx.fillStyle = c.text
  ctx.font = `500 ${qSize}px ${SANS}`
  lines.forEach((l, i) => ctx.fillText(l, PAD, quoteTop + qSize + i * qLH))

  // 渐变短横线
  const bg2 = ctx.createLinearGradient(PAD, 0, PAD + 72, 0)
  bg2.addColorStop(0, c.info)
  bg2.addColorStop(1, c.stable)
  ctx.fillStyle = bg2
  roundRect(ctx, PAD, barY, 72, 5, 2.5)
  ctx.fill()

  // 出处
  ctx.fillStyle = c.text2
  ctx.font = `400 28px ${SANS}`
  titleLines.forEach((l, i) => ctx.fillText(l, PAD, titleTop + 28 + i * 44))
  ctx.fillStyle = c.text3
  ctx.font = `400 24px ${MONO}`
  ctx.fillText(`休言 · ${input.date}`, PAD, titleTop + titleH + 26)

  // 底部：logo + 站名，右侧域名
  const fy = H - PAD - 44
  ctx.fillStyle = c.line
  ctx.fillRect(PAD, fy - 36, W - PAD * 2, 1)
  drawLogo(ctx, PAD, fy, 44, c)
  ctx.fillStyle = c.text
  ctx.font = `600 26px ${SANS}`
  ctx.fillText('休言的博客', PAD + 60, fy + 31)
  ctx.fillStyle = c.text3
  ctx.font = `400 24px ${MONO}`
  ctx.textAlign = 'right'
  ctx.fillText('fechuck.com', W - PAD, fy + 30)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}
