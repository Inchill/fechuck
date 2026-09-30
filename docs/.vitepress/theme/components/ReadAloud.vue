<script setup lang="ts">
// 文章朗读
// - 优先用预先生成好的真人感语音（scripts/tts.mjs 用 edge-tts 生成，放在 /tts/ 下）
// - 没有生成过的文章 / 段落，退回浏览器自带的 Web Speech API
// 逐段朗读，高亮当前段并跟随滚动；底部浮出控制条（上一段 / 暂停 / 下一段 / 语速 / 停止）
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vitepress'
import { collectBlocks, audioId } from '../ttsBlocks.mjs'

const route = useRoute()
const hasSpeech = ref(false)
const manifest = ref<{ profile: string; ids: Set<string> } | null>(null)
const supported = computed(() => hasSpeech.value || !!manifest.value)
const active = ref(false)
const paused = ref(false)
const idx = ref(0)
const total = ref(0)
const RATES = [1, 1.25, 1.5, 0.8]
const rate = ref(1)

type Block = { el: HTMLElement; text: string; src?: string }
let blocks: Block[] = []
let chunks: string[] = []
let chunkIdx = 0
let gen = 0 // 每次切段 +1，旧的回调直接忽略
let voice: SpeechSynthesisVoice | null = null
let audio: HTMLAudioElement | null = null
let preload: HTMLAudioElement | null = null
let mode: 'audio' | 'speech' = 'speech' // 当前这一段用哪种方式在读
let nextTimer = 0

/* ---------- 预生成音频 ---------- */
const pageKey = () => decodeURIComponent(location.pathname).replace(/^\//, '').replace(/\.html$/, '').replace(/\/$/, '/index')

async function loadManifest() {
  manifest.value = null
  if (!/^(20\d\d|notes)\/(?!index$)/.test(pageKey())) return
  const key = pageKey()
  try {
    const r = await fetch(`/tts/${key}.json`)
    if (!r.ok || key !== pageKey()) return
    const m = await r.json()
    manifest.value = { profile: m.profile ?? m.voice, ids: new Set(m.blocks) }
  } catch {}
}

/* ---------- 浏览器语音（兜底） ---------- */
// 按音质排优先级：Edge 的神经网络语音 > Chrome 的 Google 普通话 > 系统增强语音 > 系统默认
const PREFER = [/Xiaoxiao.*Natural/i, /Natural/i, /Google/i, /Premium|Enhanced|高音质|优化/i, /Lili|Yu-shu/i, /Tingting/i]

function pickVoice() {
  const zh = speechSynthesis.getVoices().filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'zh')
  voice = null
  for (const re of PREFER) {
    const hit = zh.find((v) => re.test(v.name))
    if (hit) return (voice = hit)
  }
  voice = zh[0] ?? speechSynthesis.getVoices().find((v) => /^zh/i.test(v.lang)) ?? null
}

// Chrome 读太长的一句会中途断掉，按句切成不超过 ~120 字的小段
function split(t: string) {
  const parts = t.match(/[^。！？!?；;]+[。！？!?；;]*/g) ?? [t]
  const res: string[] = []
  let buf = ''
  for (const p of parts) {
    if ((buf + p).length > 120 && buf) {
      res.push(buf)
      buf = ''
    }
    buf += p
  }
  if (buf.trim()) res.push(buf)
  return res
}

function speakChunk(g: number) {
  if (g !== gen) return
  if (chunkIdx >= chunks.length) return playBlock(idx.value + 1)
  const u = new SpeechSynthesisUtterance(chunks[chunkIdx])
  u.lang = voice?.lang ?? 'zh-CN'
  if (voice) u.voice = voice
  u.rate = rate.value
  u.onend = () => {
    if (g !== gen) return
    chunkIdx++
    speakChunk(g)
  }
  u.onerror = (e) => {
    if (g !== gen || e.error === 'interrupted' || e.error === 'canceled') return
    chunkIdx++
    speakChunk(g)
  }
  speechSynthesis.speak(u)
}

/* ---------- 播放控制 ---------- */
function mark(i: number) {
  document.querySelectorAll('.tts-reading').forEach((n) => n.classList.remove('tts-reading'))
  const b = blocks[i]
  if (!b) return
  b.el.classList.add('tts-reading')
  const r = b.el.getBoundingClientRect()
  if (r.top < 100 || r.bottom > innerHeight - 120) b.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function silence() {
  clearTimeout(nextTimer)
  audio?.pause()
  if (hasSpeech.value) speechSynthesis.cancel()
}

function playBlock(i: number) {
  if (i >= blocks.length) return stop()
  if (i < 0) i = 0
  const g = ++gen
  silence()
  idx.value = i
  paused.value = false
  mark(i)
  const b = blocks[i]
  if (b.src) {
    mode = 'audio'
    audio ??= new Audio()
    audio.src = b.src
    audio.playbackRate = rate.value
    audio.onended = () => {
      if (g !== gen) return
      nextTimer = window.setTimeout(() => g === gen && playBlock(i + 1), 220) // 段与段之间留一点呼吸
    }
    audio.onerror = () => g === gen && playBlock(i + 1)
    audio.play().catch(() => {})
    // 预取下一段，切段时几乎没有停顿
    const next = blocks[i + 1]?.src
    if (next) {
      preload ??= new Audio()
      preload.preload = 'auto'
      preload.src = next
    }
  } else if (hasSpeech.value) {
    mode = 'speech'
    chunks = split(b.text)
    chunkIdx = 0
    speakChunk(g)
  } else {
    playBlock(i + 1)
  }
}

function start() {
  blocks = collectBlocks(document.querySelector('.vp-doc')) as Block[]
  const m = manifest.value
  if (m) for (const b of blocks) {
    const id = audioId(m.profile, b.text)
    if (m.ids.has(id)) b.src = `/tts/a/${id}.mp3`
  }
  total.value = blocks.length
  if (!blocks.length) return
  if (hasSpeech.value) pickVoice()
  // 从当前屏幕上第一段开始读；在页面顶部就是从标题开始
  let from = blocks.findIndex((b) => b.el.getBoundingClientRect().bottom > 80)
  if (from < 0) from = 0
  active.value = true
  playBlock(from)
}

function toggle() {
  if (!active.value) return start()
  if (paused.value) {
    if (mode === 'audio') audio?.play().catch(() => {})
    else speechSynthesis.resume()
    paused.value = false
  } else {
    if (mode === 'audio') audio?.pause()
    else speechSynthesis.pause()
    paused.value = true
  }
}

function cycleRate() {
  rate.value = RATES[(RATES.indexOf(rate.value) + 1) % RATES.length]
  if (!active.value) return
  if (mode === 'audio') {
    if (audio) audio.playbackRate = rate.value // 音频直接变速，不打断
  } else {
    // 浏览器语音改语速对正在读的句子不生效，从当前句重新读
    const g = ++gen
    speechSynthesis.cancel()
    paused.value = false
    speakChunk(g)
  }
}

function stop() {
  gen++
  silence()
  active.value = false
  paused.value = false
  document.querySelectorAll('.tts-reading').forEach((n) => n.classList.remove('tts-reading'))
}

const progress = computed(() => (total.value ? (idx.value + 1) / total.value : 0))

function onKey(e: KeyboardEvent) {
  if (!active.value) return
  if (e.key === 'Escape') stop()
}

watch(
  () => route.path,
  () => {
    stop()
    loadManifest()
  }
)
onMounted(() => {
  hasSpeech.value = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  loadManifest()
  if (hasSpeech.value) {
    pickVoice()
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
  }
  document.addEventListener('keydown', onKey)
  window.addEventListener('pagehide', stop)
})
onBeforeUnmount(() => {
  stop()
  if (hasSpeech.value) speechSynthesis.removeEventListener?.('voiceschanged', pickVoice)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('pagehide', stop)
})
</script>

<template>
  <button v-if="supported" type="button" class="ra-btn" :class="{ on: active }" @click="active ? stop() : start()">
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M2.5 6v4h2.5l3.5 3V3L5 6z" fill="currentColor" />
      <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    {{ active ? '停止朗读' : '朗读' }}
  </button>

  <Teleport to="body">
    <Transition name="ra">
      <div v-if="active" class="ra-bar" role="toolbar" aria-label="朗读控制">
        <span class="ra-prog" :style="{ transform: `scaleX(${progress})` }" aria-hidden="true"></span>
        <span class="ra-wave" :class="{ paused }" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="ra-count">{{ idx + 1 }} / {{ total }}</span>
        <button type="button" title="上一段" aria-label="上一段" @click="playBlock(idx - 1)">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 3.5v9M12 3.5 6 8l6 4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
        </button>
        <button type="button" class="main" :title="paused ? '继续' : '暂停'" :aria-label="paused ? '继续' : '暂停'" @click="toggle">
          <svg v-if="paused" viewBox="0 0 16 16" width="14" height="14"><path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
          <svg v-else viewBox="0 0 16 16" width="14" height="14"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
        </button>
        <button type="button" title="下一段" aria-label="下一段" @click="playBlock(idx + 1)">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M12 3.5v9M4 3.5 10 8l-6 4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
        </button>
        <button type="button" class="rate" title="语速" @click="cycleRate">{{ rate }}×</button>
        <span class="ra-sep" aria-hidden="true"></span>
        <button type="button" title="停止" aria-label="停止" @click="stop">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ra-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 3px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 12px;
  font-family: inherit;
  color: var(--vp-c-text-2);
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}
.ra-btn svg {
  color: var(--vp-c-brand-1);
}
.ra-btn:hover,
.ra-btn.on {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.ra-bar {
  position: fixed;
  left: 50%;
  bottom: 28px;
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 6px 5px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  overflow: hidden;
  background:
    linear-gradient(var(--vp-c-bg), var(--vp-c-bg)) padding-box,
    linear-gradient(100deg, var(--info), var(--stable)) border-box;
  box-shadow:
    0 16px 40px -14px color-mix(in srgb, var(--info) 45%, transparent),
    0 4px 12px -4px rgba(16, 24, 32, 0.14);
  translate: -50% 0;
  color: var(--vp-c-text-1);
  font-size: 12.5px;
  white-space: nowrap;
}
:global(.dark) .ra-bar {
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)) padding-box,
    linear-gradient(100deg, var(--info), var(--stable)) border-box;
  box-shadow:
    0 16px 40px -14px color-mix(in srgb, var(--info) 35%, transparent),
    0 4px 12px -4px rgba(0, 0, 0, 0.5);
}
.ra-prog {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--info), var(--stable));
  transform-origin: 0 50%;
  transition: transform 300ms var(--ease-out);
}
.ra-count {
  min-width: 52px;
  margin: 0 6px 0 8px;
  font-family: var(--vp-font-family-mono);
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
}
.ra-bar button {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: var(--vp-c-text-2);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.ra-bar button:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.ra-bar button.main {
  color: var(--vp-c-brand-1);
}
.ra-bar button.rate {
  width: auto;
  min-width: 40px;
  padding: 0 8px;
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}
.ra-sep {
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: var(--vp-c-divider);
}

/* 声波：朗读时跳动，暂停时静止 */
.ra-wave {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 14px;
}
.ra-wave i {
  width: 2.5px;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(var(--info), var(--stable));
  animation: ra-wave 900ms ease-in-out infinite;
}
.ra-wave i:nth-child(2) {
  animation-delay: -300ms;
}
.ra-wave i:nth-child(3) {
  animation-delay: -600ms;
}
.ra-wave.paused i {
  animation-play-state: paused;
  scale: 1 0.35;
}
@keyframes ra-wave {
  0%,
  100% {
    scale: 1 0.35;
  }
  50% {
    scale: 1 1;
  }
}

.ra-enter-active {
  transition:
    opacity 220ms var(--ease-out),
    translate 280ms var(--ease-out);
}
.ra-leave-active {
  transition:
    opacity 160ms ease-in,
    translate 160ms ease-in;
}
.ra-enter-from,
.ra-leave-to {
  opacity: 0;
  translate: -50% 12px;
}

@media (max-width: 640px) {
  .ra-bar {
    bottom: 16px;
  }
}
</style>
