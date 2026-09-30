// 检查书签里的网站还能不能打开
//   pnpm check-links          只检查，列出结果
//   pnpm check-links --fix    把确认打不开的网站从 docs/bookmarks/links.mts 删掉（连同图标）
//
// 判定规则：
//   ✗ 失效（--fix 会删）：域名解析不到、连接被拒、证书无效、404/410、页面是「域名出售」停放页
//   ? 存疑（只列出，不删）：超时、连接被重置、5xx —— 可能是网络环境（比如被墙）或临时故障，请手动确认
//   ✓ 正常：能打开；403/429 这类反爬拦截也算正常（浏览器里是能打开的）
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LINKS = process.env.LINKS_FILE || join(ROOT, 'docs/bookmarks/links.mts')
const ICONS = join(ROOT, 'docs/public/bookmarks/icons')
const FIX = process.argv.includes('--fix')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const PARKED = /domain (is )?for sale|buy this domain|this domain (name )?(has expired|is parked|may be for sale)|域名(正在)?出售|该域名已过期|parkingcrew|sedoparking|dan\.com|hugedomains/i
const DEAD_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'])

const { default: groups } = await import(LINKS)
const sites = [...new Map(groups.flatMap((g) => g.sites.map((s) => [s.url, { ...s, group: g.name }]))).values()]

async function probe(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
    const status = res.status
    let body = ''
    if (res.ok && (res.headers.get('content-type') ?? '').includes('html')) body = (await res.text()).slice(0, 60000)
    else res.body?.cancel().catch(() => {})
    if (status === 404 || status === 410) return { state: 'dead', why: `HTTP ${status}` }
    if (res.ok && PARKED.test(body)) return { state: 'dead', why: '域名停放 / 出售页' }
    if (status >= 500) return { state: 'doubt', why: `HTTP ${status}` }
    return { state: 'ok', why: `HTTP ${status}${res.redirected ? ' → ' + new URL(res.url).host : ''}` }
  } catch (e) {
    if (e.name === 'TimeoutError') return { state: 'doubt', why: '超时' }
    const c = e.cause
    const code = c?.code ?? c?.errors?.[0]?.code ?? e.code ?? c?.message ?? e.message
    if (DEAD_CODES.has(code)) return { state: 'dead', why: code }
    return { state: 'doubt', why: String(code) }
  }
}

// 失败的再试一次，避免偶发抖动误判
async function check(site) {
  let r = await probe(site.url)
  if (r.state !== 'ok') {
    await new Promise((x) => setTimeout(x, 1500))
    const again = await probe(site.url)
    if (again.state === 'ok' || (r.state === 'dead' && again.state === 'doubt')) r = again
  }
  return { ...site, ...r }
}

console.log(`检查 ${sites.length} 个网站…`)
const results = []
let i = 0
let done = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < sites.length) {
    const r = await check(sites[i++])
    results.push(r)
    if (process.stdout.isTTY) process.stdout.write(`\r${++done}/${sites.length}`)
  }
}))
if (process.stdout.isTTY) process.stdout.write('\r')

const dead = results.filter((r) => r.state === 'dead')
const doubt = results.filter((r) => r.state === 'doubt')
const line = (r) => `  [${r.group}] ${r.title}  ${r.url}  —— ${r.why}`
console.log(`\n✓ 正常 ${results.length - dead.length - doubt.length} 个`)
if (doubt.length) console.log(`\n? 存疑 ${doubt.length} 个（可能是网络问题，请在浏览器里手动确认）：\n${doubt.map(line).join('\n')}`)
if (dead.length) console.log(`\n✗ 失效 ${dead.length} 个：\n${dead.map(line).join('\n')}`)

if (FIX && dead.length) {
  let src = readFileSync(LINKS, 'utf8')
  const featuredBlock = src.slice(src.indexOf('export const featured'))
  const featuredGone = dead.filter((r) => featuredBlock.includes(`'${r.url}'`))
  for (const r of dead) {
    const esc = r.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    src = src.replace(new RegExp(`^.*url: '${esc}'.*\\n`, 'gm'), '')
    const host = new URL(r.url).hostname.replace(/^www\./, '')
    // 同一域名没有别的书签了，图标也删掉
    if (!src.includes(`//${host}`) && !src.includes(`//www.${host}`) && existsSync(ICONS)) {
      for (const f of readdirSync(ICONS)) if (f.replace(/\.[^.]+$/, '') === host) rmSync(join(ICONS, f))
    }
  }
  src = src.replace(/\},\n(\s*)\]/g, '}\n$1]') // 删掉最后一项后，去掉多余的逗号
  writeFileSync(LINKS, src)
  console.log(`\n已从 links.mts 删除 ${dead.length} 个失效网站`)
  if (featuredGone.length) console.log(`注意：精选里的 ${featuredGone.map((r) => r.title).join('、')} 也一起删了，记得补一个`)
} else if (dead.length) {
  console.log('\n确认无误后运行 pnpm check-links --fix 删除')
}
