<script setup lang="ts">
// 左下角的黑胶小播放器
// - 默认播放实时生成的音乐（lofi.ts），种子是当前文章标题：每篇文章一段自己的旋律
// - 五种风格可切换；切页面不断；朗读文章时自动把音量压低
// - 光环跟着底鼓明暗（氛围风格没有鼓，改成慢慢呼吸）
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useData } from 'vitepress'
import { Lofi, STYLES, type Style } from '../lofi'
import { tracks } from '../music'

const { page, frontmatter } = useData()
const playing = ref(false)
const hover = ref(false)
const tapOpen = ref(false)
const menu = ref<'' | 'style' | 'vol'>('')
const open = computed(() => hover.value || tapOpen.value || !!menu.value)
const idx = ref(0) // 0 = 生成的音乐，1.. = tracks
const variant = ref(0) // 同一篇文章「换一段」的次数
const volume = ref(0.6)
const muted = ref(false)
const style = ref<Style>('lofi')
const root = ref<HTMLElement | null>(null)
const disc = ref<HTMLElement | null>(null)

let ctx: AudioContext | null = null
let master: GainNode
let analyser: AnalyserNode
let lofi: Lofi | null = null
let audio: HTMLAudioElement | null = null
let raf = 0
let ducked = false
let closeTimer = 0

const isArticle = computed(() => /^(20\d\d|notes)\/(?!index\.md$).+/.test(page.value.relativePath))
const baseTitle = computed(() => (isArticle.value ? page.value.title : frontmatter.value.layout === 'home' ? '休言的博客' : page.value.title || '休言的博客'))
const seed = computed(() => `${baseTitle.value}${variant.value ? '#' + variant.value : ''}`)
const styleInfo = computed(() => STYLES.find((x) => x.id === style.value) ?? STYLES[0])
const title = computed(() => (idx.value ? tracks[idx.value - 1].title : `「${baseTitle.value}」`))
const sub = computed(() => (idx.value ? tracks[idx.value - 1].artist ?? '' : `${styleInfo.value.name} · 实时生成${variant.value ? ' · 第 ' + (variant.value + 1) + ' 段' : ''}`))
const volLevel = computed(() => (muted.value || volume.value === 0 ? 0 : volume.value < 0.4 ? 1 : 2))

function ensureCtx() {
  if (ctx) return
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = 0
  analyser = ctx.createAnalyser()
  analyser.fftSize = 2048 // 频率分辨率约 23Hz，能分出底鼓
  analyser.smoothingTimeConstant = 0.7
  master.connect(analyser).connect(ctx.destination)
  lofi = new Lofi(ctx, master)
  lofi.setStyle(style.value, true)
}

function targetGain() {
  return muted.value ? 0 : volume.value * (ducked ? 0.18 : 1)
}
function ramp(to: number, sec = 0.6) {
  if (!ctx) return
  const g = master.gain
  g.cancelScheduledValues(ctx.currentTime)
  g.setValueAtTime(g.value, ctx.currentTime)
  g.linearRampToValueAtTime(to, ctx.currentTime + sec)
}

function startSource() {
  if (idx.value === 0) {
    lofi!.setSeed(seed.value, true)
    lofi!.start()
  } else {
    if (!audio) {
      audio = new Audio()
      audio.crossOrigin = 'anonymous'
      ctx!.createMediaElementSource(audio).connect(master)
      audio.onended = () => next()
    }
    audio.src = tracks[idx.value - 1].src
    audio.play().catch(() => {})
  }
}
function stopSource() {
  lofi?.stop()
  audio?.pause()
}

async function play() {
  ensureCtx()
  await ctx!.resume()
  startSource()
  ramp(targetGain(), 1.2)
  playing.value = true
  loop()
}
function pause() {
  ramp(0, 0.4)
  playing.value = false
  setTimeout(() => {
    if (!playing.value) {
      stopSource()
      ctx?.suspend()
    }
  }, 450)
}
const toggle = () => (playing.value ? pause() : play())

// 换一段：生成的音乐换一个种子；有歌单时轮到下一首
function next() {
  const wasGen = idx.value === 0
  if (tracks.length) {
    idx.value = (idx.value + 1) % (tracks.length + 1)
    if (idx.value === 0) variant.value++
  } else variant.value++
  if (!playing.value) return
  // 生成的音乐之间切换：等到下一小节开头无缝换；和歌单之间切换：直接换源
  if (wasGen && idx.value === 0) return lofi?.setSeed(seed.value)
  stopSource()
  startSource()
}

function setStyle(v: Style) {
  style.value = v
  menu.value = ''
  try {
    localStorage.setItem('fechuck:music-style', v)
  } catch {}
  lofi?.setStyle(v) // 播放中会在下一小节开头切过去
  if (idx.value !== 0 && playing.value) {
    // 正在放歌单里的曲子时，切风格就回到生成的音乐
    idx.value = 0
    stopSource()
    startSource()
  }
}

// 切换文章：生成的音乐在下一小节开头换成新文章的旋律
watch(
  () => page.value.relativePath,
  () => {
    variant.value = 0
    menu.value = ''
    if (playing.value && idx.value === 0) lofi?.setSeed(seed.value)
  }
)
watch([volume, muted], ([v]) => {
  try {
    localStorage.setItem('fechuck:music-volume', String(v))
  } catch {}
  if (playing.value) ramp(targetGain(), 0.15)
})
function onVolInput() {
  if (muted.value) muted.value = false // 拖音量时自动取消静音
}

// 光环：底鼓比平均值「突然高出多少」写进 --beat（0~1）
function loop() {
  cancelAnimationFrame(raf)
  const buf = new Uint8Array(analyser.frequencyBinCount)
  let smooth = 0
  let avg = 0
  const tick = () => {
    if (!playing.value) {
      disc.value?.style.setProperty('--beat', '0')
      return
    }
    analyser.getByteFrequencyData(buf)
    let e = 0
    for (let i = 2; i < 7; i++) e += buf[i]
    e /= 5
    avg = avg * 0.94 + e * 0.06
    let v = Math.min(1, Math.max(0, (e - avg) / 28))
    // 氛围、八音盒没有鼓点，光环改成慢慢「呼吸」
    if (idx.value === 0 && (style.value === 'ambient' || style.value === 'musicbox')) v = 0.2 + 0.3 * (1 + Math.sin(performance.now() / 1300)) * 0.5
    smooth = Math.max(v, smooth * 0.9)
    disc.value?.style.setProperty('--beat', smooth.toFixed(3))
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

// 朗读开始 / 结束（ReadAloud.vue 派发）
function onReading(e: Event) {
  ducked = !!(e as CustomEvent).detail
  if (playing.value) ramp(targetGain(), 0.5)
}
// 终端里的 music 命令：music 播放 / 暂停；music <风格> 切风格并播放
function onCommand(e: Event) {
  const want = (e as CustomEvent).detail as Style | undefined
  if (want && STYLES.some((x) => x.id === want)) {
    setStyle(want)
    if (!playing.value) play()
  } else toggle()
}

// 触屏没有悬停：点唱片时顺便展开几秒
function tapDisc() {
  toggle()
  if (window.matchMedia('(hover: none)').matches) {
    tapOpen.value = true
    clearTimeout(closeTimer)
    closeTimer = window.setTimeout(() => {
      if (!menu.value) tapOpen.value = false
    }, 4000)
  }
}
function toggleMenu(m: 'style' | 'vol') {
  menu.value = menu.value === m ? '' : m
  if (menu.value === 'style') nextTick(() => root.value?.querySelector('.menu button.on')?.scrollIntoView({ block: 'nearest' }))
}
function onDocDown(e: Event) {
  if (menu.value && !root.value?.contains(e.target as Node)) {
    menu.value = ''
    tapOpen.value = false
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') menu.value = ''
}

onMounted(() => {
  try {
    const v = parseFloat(localStorage.getItem('fechuck:music-volume') ?? '')
    if (v >= 0 && v <= 1) volume.value = v
    const st = localStorage.getItem('fechuck:music-style') as Style | null
    if (st && STYLES.some((x) => x.id === st)) style.value = st
  } catch {}
  window.addEventListener('fechuck:reading', onReading)
  window.addEventListener('fechuck:music', onCommand)
  document.addEventListener('pointerdown', onDocDown)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('fechuck:reading', onReading)
  window.removeEventListener('fechuck:music', onCommand)
  document.removeEventListener('pointerdown', onDocDown)
  document.removeEventListener('keydown', onKey)
  cancelAnimationFrame(raf)
  stopSource()
  ctx?.close()
})
</script>

<template>
  <div ref="root" class="mp" :class="{ playing, open }" @mouseenter="hover = true" @mouseleave="hover = false">
    <button ref="disc" type="button" class="disc" :aria-label="playing ? '暂停音乐' : '播放音乐'" :title="playing ? '暂停' : '来点音乐'" @click="tapDisc">
      <span class="glow" aria-hidden="true"></span>
      <span class="vinyl" aria-hidden="true">
        <span class="label"><i></i></span>
      </span>
      <span class="state" aria-hidden="true">
        <svg v-if="playing" viewBox="0 0 16 16" width="12" height="12"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
        <svg v-else viewBox="0 0 16 16" width="12" height="12"><path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
      </span>
    </button>

    <div class="panel">
      <div class="meta">
        <div class="t">{{ title }}</div>
        <div class="s">
          <span class="eq" :class="{ on: playing }" aria-hidden="true"><i></i><i></i><i></i></span>
          {{ sub }}
        </div>
      </div>

      <!-- 风格 -->
      <div class="pop-wrap">
        <button type="button" class="chip" :class="{ on: menu === 'style' }" aria-haspopup="menu" :aria-expanded="menu === 'style'" title="换风格" @click="toggleMenu('style')">
          {{ styleInfo.name }}
          <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path d="m4 10 4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <Transition name="pop">
          <div v-if="menu === 'style'" class="pop menu" role="menu" aria-label="风格">
            <div class="pop-h">风格</div>
            <button v-for="st in STYLES" :key="st.id" type="button" role="menuitemradio" :aria-checked="style === st.id" :class="{ on: style === st.id }" @click="setStyle(st.id)">
              <span class="mi-name">{{ st.name }}</span>
              <span class="mi-desc">{{ st.desc }}</span>
              <svg v-if="style === st.id" class="tick" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </div>
        </Transition>
      </div>

      <button type="button" class="ctl" title="换一段" aria-label="换一段" @click="next">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 3.5 10 8l-6 4.5zM12 3.5v9" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
      </button>

      <!-- 音量：图标 + 弹出的竖向滑条，不会被当成进度条 -->
      <div class="pop-wrap">
        <button type="button" class="ctl" :class="{ on: menu === 'vol' }" :title="`音量 ${muted ? '静音' : Math.round(volume * 100) + '%'}`" aria-label="音量" @click="toggleMenu('vol')">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path d="M2.5 6v4h2.5l3.5 3V3L5 6z" fill="currentColor" />
            <template v-if="volLevel === 0"><path d="m11 6 3.5 4M14.5 6 11 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></template>
            <template v-else>
              <path d="M10.8 6a2.6 2.6 0 0 1 0 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              <path v-if="volLevel === 2" d="M12.6 4.3a5 5 0 0 1 0 7.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </template>
          </svg>
        </button>
        <Transition name="pop">
          <div v-if="menu === 'vol'" class="pop vol-pop">
            <span class="vol-num">{{ muted ? '静音' : Math.round(volume * 100) }}</span>
            <input v-model.number="volume" class="vol" type="range" min="0" max="1" step="0.05" aria-label="音量" @input="onVolInput" />
            <button type="button" class="mute" :class="{ on: muted }" @click="muted = !muted">{{ muted ? '取消静音' : '静音' }}</button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mp {
  --size: 46px;
  position: fixed;
  left: max(24px, calc((100vw - var(--vp-layout-max-width, 1440px)) / 2 + 24px));
  bottom: 28px;
  z-index: 55;
  display: flex;
  align-items: center;
  height: var(--size);
  border-radius: 999px;
  transition:
    background-color 300ms var(--ease-out),
    box-shadow 300ms var(--ease-out),
    padding 300ms var(--ease-out);
}
.mp.open {
  padding-right: 8px;
  background: color-mix(in srgb, var(--vp-c-bg) 86%, transparent);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 14px 36px -16px rgba(16, 24, 32, 0.3);
}

/* ---------- 唱片 ---------- */
.disc {
  --beat: 0;
  position: relative;
  flex: none;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
}
/* 跟着节拍明暗的品牌色光环 */
.glow {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--info), var(--stable), var(--info));
  opacity: calc(0.35 + var(--beat) * 0.65);
  filter: blur(calc(2px + var(--beat) * 6px));
  transform: scale(calc(1 + var(--beat) * 0.08));
  transition: opacity 120ms linear;
}
.mp:not(.playing) .glow {
  opacity: 0.25;
  filter: blur(1px);
}
.vinyl {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  /* 唱片纹路 + 两道反光 */
  background:
    conic-gradient(from 30deg, transparent 0 20deg, rgba(255, 255, 255, 0.14) 35deg, transparent 50deg 200deg, rgba(255, 255, 255, 0.09) 215deg, transparent 230deg),
    repeating-radial-gradient(circle, #121417 0 1.4px, #1d2025 1.4px 2.8px);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 6px 16px -6px rgba(0, 0, 0, 0.45);
  animation: spin 3.6s linear infinite;
  animation-play-state: paused;
}
.mp.playing .vinyl {
  animation-play-state: running;
}
.label {
  display: grid;
  place-items: center;
  width: 38%;
  height: 38%;
  border-radius: 50%;
  background: linear-gradient(135deg, #6cb6f5, #3ddc9a);
}
.label i {
  width: 22%;
  height: 22%;
  border-radius: 50%;
  background: #0b0f14;
}
@keyframes spin {
  to {
    rotate: 360deg;
  }
}
/* 悬停时在唱片上显示播放 / 暂停 */
.state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.disc:hover .state,
.disc:focus-visible .state {
  opacity: 1;
}

/* ---------- 展开的面板 ---------- */
.panel {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    max-width 360ms var(--ease-out),
    opacity 200ms var(--ease-out),
    margin 360ms var(--ease-out);
}
.mp.open .panel {
  max-width: 420px;
  margin-left: 12px;
  opacity: 1;
  overflow: visible; /* 让弹出层能超出胶囊 */
}
.meta {
  min-width: 0;
  max-width: 170px;
  margin-right: 6px;
}
.t {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.s {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
/* 小均衡器：表示「正在实时演奏」，不是一首有进度的歌 */
.eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 8px;
}
.eq i {
  width: 2px;
  height: 30%;
  border-radius: 1px;
  background: var(--vp-c-brand-1);
}
.eq.on i {
  animation: eq 900ms ease-in-out infinite;
}
.eq.on i:nth-child(2) {
  animation-delay: -300ms;
}
.eq.on i:nth-child(3) {
  animation-delay: -600ms;
}
@keyframes eq {
  0%,
  100% {
    height: 30%;
  }
  50% {
    height: 100%;
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: background-color var(--dur-fast) var(--ease-out);
}
.chip svg {
  color: var(--vp-c-text-3);
}
.chip:hover,
.chip.on {
  background: var(--vp-c-brand-soft);
}
.ctl {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: var(--vp-c-text-2);
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}
.ctl:hover,
.ctl.on {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

/* ---------- 弹出层（向上弹） ---------- */
.pop-wrap {
  position: relative;
  flex: none;
}
.pop {
  --pop-bg: var(--vp-c-bg);
  position: absolute;
  bottom: calc(100% + 14px);
  z-index: 2;
  border-radius: 14px;
  background: var(--pop-bg);
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 18px 40px -16px rgba(16, 24, 32, 0.35);
}
.dark .pop {
  --pop-bg: var(--vp-c-bg-soft);
}
.menu {
  left: 50%;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  gap: 4px; /* 选项之间留一点缝，悬停 / 选中的底色不会贴在一起 */
  width: 244px;
  max-height: min(340px, calc(100vh - 140px)); /* 大约露出 5 项，其余滚动查看 */
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.pop-h {
  position: sticky;
  top: -6px;
  z-index: 1;
  margin: -6px -6px 0;
  padding: 12px 16px 6px;
  background: inherit;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}
/* 标题下方一小段渐隐，滚上去的选项不会被生硬地切开 */
.pop-h::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 10px;
  background: linear-gradient(var(--pop-bg), transparent);
  pointer-events: none;
}
.menu button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 6px 28px 6px 10px;
  border-radius: 8px;
  text-align: left;
  transition: background-color var(--dur-fast) var(--ease-out);
}
.menu button:hover {
  background: var(--vp-c-default-soft);
}
.menu button.on {
  background: var(--vp-c-brand-soft);
}
.mi-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.menu button.on .mi-name {
  color: var(--vp-c-brand-1);
}
.mi-desc {
  margin-top: 1px;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}
.tick {
  position: absolute;
  right: 10px;
  top: 50%;
  translate: 0 -50%;
  color: var(--vp-c-brand-1);
}
.vol-pop {
  left: 50%;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 64px;
  padding: 12px 6px 8px;
}
.vol-num {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-2);
}
/* 竖向滑条：从下往上 */
.vol {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 20px;
  height: 96px;
  accent-color: var(--vp-c-brand-1);
}
.mute {
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
.mute:hover,
.mute.on {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 220ms var(--ease-out);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .vinyl,
  .eq.on i {
    animation: none;
  }
}
@media (max-width: 640px) {
  .mp {
    --size: 40px;
    left: 16px;
    bottom: 20px;
  }
  .meta {
    max-width: 110px;
  }
  .menu {
    left: 0;
    translate: -40% 0;
  }
}
</style>
