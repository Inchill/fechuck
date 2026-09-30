// 用 edge-tts 给文章预先生成朗读音频
// 部署时 GitHub Actions 会自动运行（见 .github/workflows/deploy.yml）；本地运行只是为了预览
//
// 用法（先 build，脚本读的是构建出来的 HTML，保证和网页上的段落一致）：
//   pnpm docs:build
//   pnpm tts                       # 全部文章和随想
//   pnpm tts 2025/claude-mcp       # 只生成路径里包含这些关键字的
//
// 声音、语速等在根目录 tts.config.mjs 里配置；单篇可在 frontmatter 写 ttsVoice / tts: false
// 临时试听别的声音：TTS_VOICE=zh-CN-YunxiNeural pnpm tts 2025/claude-mcp
//
// 产物：
//   docs/public/tts/a/<id>.m4a   每段一个音频（edge-tts 出 mp3，再用 ffmpeg 压成 AAC），文件名是「声音参数 + 文字」的哈希，改了哪段只重新生成哪段
//   docs/public/tts/<路径>.json  这篇文章用到的声音和段落列表
// 依赖：edge-tts 命令行（pipx install edge-tts），压缩需要 ffmpeg（brew install ffmpeg）
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, cpSync, mkdtempSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { collectBlocks, audioId } from '../docs/.vitepress/theme/ttsBlocks.mjs'

const run = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const DIST = join(DOCS, '.vitepress/dist')
const OUT = join(DOCS, 'public/tts')
const config = (await import('../tts.config.mjs').catch(() => ({ default: {} }))).default
const VOICE = process.env.TTS_VOICE || config.voice || 'zh-CN-XiaoxiaoNeural'
const RATE = process.env.TTS_RATE || config.rate || '+0%'
const PITCH = process.env.TTS_PITCH || config.pitch || '+0Hz'
const VOLUME = config.volume || '+0%'
const BIN = process.env.EDGE_TTS || 'edge-tts'
const CONCURRENCY = config.concurrency || 4
// 输出格式：'m4a'（AAC，体积更小，所有浏览器都能播）或 'mp3'（edge-tts 原始输出，不转码）
const FORMAT = config.format === 'm4a' ? 'm4a' : 'mp3'
const BITRATE = config.bitrate || '32k'
// 同一段文字，只要声音参数变了就是另一个音频
const profile = (voice) => [voice, RATE, PITCH, VOLUME].join('|')
const filters = process.argv.slice(2)

if (!existsSync(DIST)) {
  console.error('找不到构建产物，先运行 pnpm docs:build')
  process.exit(1)
}
try {
  await run(BIN, ['--version'])
} catch {
  console.error('找不到 edge-tts，先安装：pipx install edge-tts（或 pip3 install --user edge-tts）')
  process.exit(1)
}
if (FORMAT !== 'mp3') {
  try {
    await run('ffmpeg', ['-version'])
  } catch {
    console.error('找不到 ffmpeg，先安装：brew install ffmpeg（或在 tts.config.mjs 里把 format 设为 mp3）')
    process.exit(1)
  }
}

// 文章（20xx/*.html）和随想详情（notes/*.html），跳过草稿
function pages() {
  const list = []
  for (const dir of readdirSync(DIST)) {
    if (!/^(20\d\d|notes)$/.test(dir)) continue
    for (const f of readdirSync(join(DIST, dir))) {
      if (!f.endsWith('.html') || f === 'index.html') continue
      const key = `${dir}/${f.replace(/\.html$/, '')}`
      const md = join(DOCS, key + '.md')
      const fm = existsSync(md) ? (readFileSync(md, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '') : ''
      if (/^draft:\s*true\s*$/m.test(fm) || /^tts:\s*false\s*$/m.test(fm)) continue
      if (filters.length && !filters.some((k) => key.includes(k))) continue
      const voice = process.env.TTS_VOICE || fm.match(/^ttsVoice:\s*['"]?([\w-]+)/m)?.[1] || VOICE
      list.push({ key, voice })
    }
  }
  return list.sort((a, b) => a.key.localeCompare(b.key))
}

const tmp = mkdtempSync(join(tmpdir(), 'tts-'))
// mp3 → AAC（单声道，保留 24kHz；faststart 让浏览器边下边播）
async function transcode(mp3, out) {
  const tmpOut = out + '.part.m4a'
  await run('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-c:a', 'aac', '-b:a', BITRATE, '-ac', '1', '-movflags', '+faststart', tmpOut], { timeout: 60_000 })
  cpSync(tmpOut, out)
  rmSync(tmpOut, { force: true })
  rmSync(mp3, { force: true })
}

async function synth(text, file, voice) {
  const txt = join(tmp, Math.random().toString(36).slice(2) + '.txt')
  writeFileSync(txt, text)
  for (let attempt = 1; ; attempt++) {
    try {
      await run(BIN, ['--voice', voice, `--rate=${RATE}`, `--pitch=${PITCH}`, `--volume=${VOLUME}`, '--file', txt, '--write-media', file], { timeout: 60_000 })
      if (readFileSync(file).length > 0) break
      throw new Error('空文件')
    } catch (e) {
      rmSync(file, { force: true })
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  rmSync(txt, { force: true })
}

async function pool(items, fn) {
  let i = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

mkdirSync(join(OUT, 'a'), { recursive: true })
const items = pages()
if (!items.length) {
  console.error('没有匹配的文章')
  process.exit(1)
}
console.log(`默认声音 ${VOICE}（语速 ${RATE}，音调 ${PITCH}），共 ${items.length} 篇`)

let made = 0
const failed = []
for (const { key, voice } of items) {
  const prof = profile(voice)
  const { document } = parseHTML(readFileSync(join(DIST, key + '.html'), 'utf8'))
  const blocks = collectBlocks(document.querySelector('.vp-doc'))
  const ids = blocks.map((b) => audioId(prof, b.text))
  const todo = blocks
    .map((b, i) => ({ text: b.text, id: ids[i], file: join(OUT, 'a', `${ids[i]}.${FORMAT}`) }))
    .filter((t, i, arr) => !existsSync(t.file) && arr.findIndex((x) => x.file === t.file) === i)
  let done = 0
  try {
    await pool(todo, async (t) => {
      const mp3 = join(OUT, 'a', t.id + '.mp3')
      // 以前生成过 mp3 的段落直接转码，不用再请求语音接口
      if (!existsSync(mp3)) {
        await synth(t.text, mp3, voice)
        made++
      }
      if (FORMAT !== 'mp3') await transcode(mp3, t.file)
      done++
      if (process.stdout.isTTY) process.stdout.write(`\r${key}  ${done}/${todo.length}   `)
    })
  } catch (e) {
    // 某篇失败不影响其他文章；这篇保留旧的段落清单（没改过的段落照样有音频），下次再补
    failed.push(key)
    console.log(`\r${key}  生成失败（已完成 ${done}/${todo.length}）：${String(e.message || e).split('\n')[0]}`)
    continue
  }
  const manifest = join(OUT, key + '.json')
  mkdirSync(dirname(manifest), { recursive: true })
  writeFileSync(manifest, JSON.stringify({ profile: prof, ext: FORMAT, blocks: ids }))
  console.log(`\r${key}  ${blocks.length} 段，新生成 ${todo.length} 段${voice !== VOICE ? `（${voice}）` : ''}`)
}

// 全量生成时，清理不再被任何文章用到的旧音频（比如改过的段落、换掉的声音）
if (!filters.length) {
  const used = new Set()
  const walk = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name)
      if (f.isDirectory() && f.name !== 'a') walk(p)
      else if (f.name.endsWith('.json')) JSON.parse(readFileSync(p, 'utf8')).blocks.forEach((id) => used.add(id))
    }
  }
  walk(OUT)
  let pruned = 0
  for (const f of readdirSync(join(OUT, 'a'))) {
    const [id, ext] = f.split('.')
    if (!used.has(id) || ext !== FORMAT) rmSync(join(OUT, 'a', f)), pruned++
  }
  if (pruned) console.log(`清理旧音频 ${pruned} 个`)
}

// 同步到已构建的 dist，pnpm docs:preview 立刻能听到
cpSync(OUT, join(DIST, 'tts'), { recursive: true })
rmSync(tmp, { recursive: true, force: true })
console.log(`完成，本次新生成 ${made} 段 → ${relative(ROOT, OUT)}`)
if (failed.length) {
  console.log(`有 ${failed.length} 篇没生成完，重新运行即可续上：${failed.join('、')}`)
  process.exitCode = 1
}
