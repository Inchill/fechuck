// 文章朗读音频的 Service Worker（在 ReadAloud.vue 里注册）
//
// 只接管 /tts/a/ 下的音频，其余请求一律不碰，照常走网络。
// 这些文件名是「声音 + 文字」的内容哈希，文字或声音一变文件名就变，同名文件内容永远不变，所以可以一直缓存。
// GitHub Pages 只给 10 分钟的 HTTP 缓存，过期后每段都要回源问一遍；这里改成缓存优先：
// 读过（或预取过）的段落，下次直接从本地出声，离线也能读。
//
// 想整个撤掉：把这个文件改成只有 self.registration.unregister() 的版本再部署一次
const CACHE = 'tts-audio-v1'
const MAX = 600 // 最多缓存多少段（一段平均约 50KB，约 30MB），超出先删最早存的

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // 清掉旧版本的缓存
      for (const k of await caches.keys()) if (k.startsWith('tts-audio-') && k !== CACHE) await caches.delete(k)
      // 立刻接管已经打开的页面，第一次访问就生效
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || !url.pathname.startsWith('/tts/a/')) return
  e.respondWith(serve(req, url.origin + url.pathname))
})

const inflight = new Map() // 同一段正在下载时，后来的请求等它，不重复下载

async function serve(req, key) {
  const cache = await caches.open(CACHE)
  let res = await cache.match(key)
  if (!res) {
    let p = inflight.get(key)
    if (!p) {
      p = download(cache, key).finally(() => inflight.delete(key))
      inflight.set(key, p)
    }
    if (await p) res = await cache.match(key)
  }
  // 存不进缓存（无痕模式配额不够、网络出错等）：照常走网络
  if (!res) return fetch(req)
  const range = req.headers.get('range')
  return range ? slice(res, range) : res
}

// 下载完整文件（不带 Range），存进缓存
async function download(cache, key) {
  try {
    const r = await fetch(key)
    if (r.status !== 200) return false
    await cache.put(key, r)
    trim(cache)
    return true
  } catch {
    return false
  }
}

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX; i++) await cache.delete(keys[i])
}

// <audio> 会发 Range 请求，Safari 要求必须回 206 才肯播，这里从缓存的完整文件里切出对应的字节
async function slice(res, range) {
  const buf = await res.arrayBuffer()
  const size = buf.byteLength
  const m = /bytes=(\d*)-(\d*)/.exec(range)
  let start = 0
  let end = size - 1
  if (m && m[1]) {
    start = +m[1]
    if (m[2]) end = Math.min(+m[2], size - 1)
  } else if (m && m[2]) start = Math.max(0, size - +m[2]) // bytes=-500：最后 500 字节
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes'
    }
  })
}
