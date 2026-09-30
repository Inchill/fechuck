// 实时生成的背景音乐：纯 Web Audio，不用任何音频文件，也就没有版权问题
// 同一个种子（比如文章标题）永远生成同一段旋律 —— 每篇文章都有自己的「主题曲」
// 十种风格：lo-fi / 氛围 / 爵士 / 8-bit / 雨天 / 摇滚 / 民谣 / Synthwave / 古风 / 八音盒

const Q = {
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dom9: [0, 4, 10, 14],
  m9: [0, 3, 10, 14],
  maj9: [0, 4, 11, 14],
  sus: [0, 5, 7, 10],
  m11: [0, 3, 10, 17],
  dom13: [0, 4, 10, 21],
  maj6: [0, 4, 9, 14]
}
// 常见的 lo-fi 和弦进行（[相对主音的半音数, 和弦结构]）
const PROGS: [number, number[]][][] = [
  [[2, Q.m9], [7, Q.dom9], [0, Q.maj9], [9, Q.m7]], // ii - V - I - vi
  [[0, Q.maj7], [9, Q.m7], [2, Q.m9], [7, Q.dom9]], // I - vi - ii - V
  [[9, Q.m9], [5, Q.maj7], [0, Q.maj9], [7, Q.sus]], // vi - IV - I - V
  [[5, Q.maj9], [4, Q.m7], [2, Q.m9], [0, Q.maj7]], // IV - iii - ii - I
  [[0, Q.m9], [5, Q.m7], [10, Q.dom9], [3, Q.maj7]] // i - iv - VII - III
]
// 爵士：更多延伸音的 ii-V-I
const JAZZ: [number, number[]][][] = [
  [[2, Q.m11], [7, Q.dom13], [0, Q.maj9], [9, Q.dom9]],
  [[0, Q.maj6], [9, Q.m9], [2, Q.m11], [7, Q.dom13]],
  [[5, Q.maj9], [4, Q.m11], [2, Q.m9], [7, Q.dom13]]
]
// 8-bit：简单明亮的三和弦
const CHIP: [number, number[]][][] = [
  [[0, [0, 4, 7]], [9, [0, 3, 7]], [5, [0, 4, 7]], [7, [0, 4, 7]]],
  [[0, [0, 4, 7]], [7, [0, 4, 7]], [9, [0, 3, 7]], [5, [0, 4, 7]]],
  [[9, [0, 3, 7]], [5, [0, 4, 7]], [0, [0, 4, 7]], [7, [0, 4, 7]]]
]
// 摇滚：强力和弦（根音 + 五度 + 八度）
const P5 = [0, 7, 12]
const ROCK: [number, number[]][][] = [
  [[0, P5], [7, P5], [9, P5], [5, P5]], // I - V - vi - IV
  [[9, P5], [5, P5], [0, P5], [7, P5]], // vi - IV - I - V
  [[0, P5], [10, P5], [5, P5], [0, P5]] // I - bVII - IV - I
]
// 民谣：木吉他的三和弦 / 加九和弦
const FOLK: [number, number[]][][] = [
  [[0, [0, 4, 7, 14]], [7, [0, 4, 7, 12]], [9, [0, 3, 7, 12]], [5, [0, 4, 7, 14]]],
  [[0, [0, 4, 7, 12]], [5, [0, 4, 7, 14]], [0, [0, 4, 7, 12]], [7, [0, 5, 7, 12]]],
  [[9, [0, 3, 7, 12]], [5, [0, 4, 7, 14]], [0, [0, 4, 7, 12]], [7, [0, 4, 7, 12]]]
]
// Synthwave：小调的 i - VI - III - VII，80 年代电影配乐的味道
const SYNTH: [number, number[]][][] = [
  [[0, [0, 3, 7, 10]], [8, [0, 4, 7, 11]], [3, [0, 4, 7, 11]], [10, [0, 4, 7, 9]]],
  [[0, [0, 3, 7, 10]], [5, [0, 3, 7, 10]], [8, [0, 4, 7, 11]], [10, [0, 4, 7, 9]]]
]
// 古风：空五度（没有三音），配五声音阶的旋律
const GUOFENG: [number, number[]][][] = [
  [[0, [0, 7, 12]], [9, [0, 7, 12]], [5, [0, 7, 12]], [7, [0, 7, 12]]],
  [[9, [0, 7, 12]], [7, [0, 7, 12]], [0, [0, 7, 12]], [2, [0, 7, 12]]]
]
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16]

export type Style = 'lofi' | 'ambient' | 'jazz' | 'chip' | 'rainy' | 'rock' | 'folk' | 'synth' | 'guofeng' | 'musicbox'
export const STYLES: { id: Style; name: string; desc: string }[] = [
  { id: 'lofi', name: 'lo-fi', desc: '电钢琴、慵懒的鼓点和黑胶底噪' },
  { id: 'ambient', name: '氛围', desc: '没有鼓，长音慢慢铺开，适合阅读' },
  { id: 'jazz', name: '爵士', desc: '行走贝斯、刷子鼓，咖啡馆的午后' },
  { id: 'chip', name: '8-bit', desc: '方波和琶音，复古游戏机的声音' },
  { id: 'rainy', name: '雨天', desc: '放慢的 lo-fi，窗外下着雨' },
  { id: 'rock', name: '摇滚', desc: '失真吉他的强力和弦、硬朗的鼓' },
  { id: 'folk', name: '民谣', desc: '木吉他分解和弦，口哨哼着旋律' },
  { id: 'synth', name: 'Synthwave', desc: '80 年代霓虹，锯齿波琶音' },
  { id: 'guofeng', name: '古风', desc: '古筝拨弦、笛声悠长，五声音阶' },
  { id: 'musicbox', name: '八音盒', desc: '清脆、微微走调，适合夜里' }
]
// 每种风格的速度范围、摇摆程度、整体亮度、鼓的音量，以及把各风格响度拉平的总增益
const CONF: Record<Style, { bpm: [number, number]; swing: number; bright: number; drums: number; level: number }> = {
  lofi: { bpm: [70, 84], swing: 0.2, bright: 3400, drums: 0.7, level: 1 },
  ambient: { bpm: [54, 64], swing: 0, bright: 3000, drums: 0, level: 1.6 },
  jazz: { bpm: [88, 104], swing: 0.33, bright: 4200, drums: 0.55, level: 1.7 },
  chip: { bpm: [112, 132], swing: 0, bright: 9000, drums: 0.5, level: 1.2 },
  rainy: { bpm: [64, 72], swing: 0.2, bright: 2600, drums: 0.42, level: 1.1 },
  rock: { bpm: [118, 138], swing: 0, bright: 6500, drums: 0.8, level: 0.5 },
  folk: { bpm: [88, 104], swing: 0.1, bright: 5200, drums: 0.35, level: 1.1 },
  synth: { bpm: [96, 112], swing: 0, bright: 7000, drums: 0.7, level: 0.9 },
  guofeng: { bpm: [66, 78], swing: 0, bright: 6000, drums: 0.35, level: 1.7 },
  musicbox: { bpm: [76, 90], swing: 0, bright: 9000, drums: 0, level: 2.4 }
}

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Lofi {
  private ctx: AudioContext
  private out: GainNode
  private warm: BiquadFilterNode
  private keys: GainNode
  private bass: GainNode
  private drums: GainNode
  private lead: GainNode
  private pad: GainNode
  private bright: GainNode
  private verb: GainNode
  private noise: AudioBuffer
  private dist: GainNode
  private plucks = new Map<string, AudioBuffer>()
  private bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  private thunderTimer = 0
  private timer = 0
  private step = 0
  private nextTime = 0
  private rng = Math.random
  private seedStr = ''
  private key = 50
  private progIdx = 0
  private melody: (number | null)[] = []
  private pendingSeed: string | null = null
  private pendingStyle: Style | null = null
  private tempoRand = 0.5
  style: Style = 'lofi'

  get bpm() {
    const [a, b] = CONF[this.style].bpm
    return a + Math.floor(this.tempoRand * (b - a))
  }
  private get prog() {
    const list = { jazz: JAZZ, chip: CHIP, rock: ROCK, folk: FOLK, synth: SYNTH, guofeng: GUOFENG }[this.style as string] ?? PROGS
    return list[this.progIdx % list.length]
  }
  private get minor() {
    if (this.style === 'rock' || this.style === 'synth') return true // 摇滚、Synthwave 的旋律用小调五声
    return !['jazz', 'chip', 'folk', 'guofeng', 'musicbox'].includes(this.style) && this.progIdx % PROGS.length === 4
  }

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    // 整体亮度：lo-fi 压暗一点更「旧」，8-bit 放开
    this.warm = ctx.createBiquadFilter()
    this.warm.type = 'lowpass'
    this.warm.frequency.value = 3400
    this.warm.Q.value = 0.4
    this.out.connect(this.warm).connect(dest)

    this.keys = this.bus(0.9, 1700)
    this.bass = this.bus(0.55)
    this.drums = this.bus(0.7)
    this.lead = this.bus(0.35, 2600)
    this.pad = this.bus(0.9, 1100)
    this.bright = this.bus(0.8, 7000)
    // 摇滚吉他：失真 + 箱体（高通去掉低频浑浊，低通模拟音箱）
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1
      curve[i] = Math.tanh(x * 12) * 0.8
    }
    shaper.curve = curve
    shaper.oversample = '4x'
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 110
    const cab = ctx.createBiquadFilter()
    cab.type = 'lowpass'
    cab.frequency.value = 3200
    this.dist = ctx.createGain()
    this.dist.gain.value = 0.9
    const post = ctx.createGain()
    post.gain.value = 0.18
    this.dist.connect(shaper).connect(hp).connect(cab).connect(post).connect(this.out)

    // 旋律加一点延迟回声
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.36
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    this.lead.connect(delay).connect(fb).connect(delay)
    delay.connect(wet).connect(this.out)

    // 混响：用衰减的噪声做一个 3.5 秒的脉冲响应
    const conv = ctx.createConvolver()
    const irLen = Math.floor(ctx.sampleRate * 3.5)
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / irLen) ** 2.6
    }
    conv.buffer = ir
    this.verb = ctx.createGain()
    this.verb.gain.value = 0.55
    this.verb.connect(conv).connect(this.out)

    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }

  private bus(gain: number, lowpass?: number) {
    const g = this.ctx.createGain()
    g.gain.value = gain
    if (lowpass) {
      const f = this.ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = lowpass
      g.connect(f).connect(this.out)
    } else g.connect(this.out)
    return g
  }

  /** 换一首：种子决定调、和弦进行、速度和旋律 */
  setSeed(seed: string, immediate = false) {
    if (!immediate && this.timer) {
      this.pendingSeed = seed // 播放中换歌，等到下一小节开头再换，不突兀
      return
    }
    this.seedStr = seed
    this.rng = mulberry32(hashStr(seed + '|' + this.style))
    this.key = 48 + Math.floor(this.rng() * 10)
    this.progIdx = Math.floor(this.rng() * 60)
    this.tempoRand = this.rng()
    this.makeMelody()
  }

  /** 换风格：播放中等到下一小节开头再换 */
  setStyle(style: Style, immediate = false) {
    if (!immediate && this.timer) {
      this.pendingStyle = style
      return
    }
    this.style = style
    const c = CONF[style]
    const now = this.ctx.currentTime
    this.warm.frequency.setTargetAtTime(c.bright, now, 0.3)
    this.drums.gain.setTargetAtTime(c.drums, now, 0.3)
    this.out.gain.setTargetAtTime(c.level, now, 0.3)
    if (this.seedStr) this.setSeed(this.seedStr, true) // 同一篇文章，换风格后旋律也跟着换
    if (this.timer) this.startBed()
  }

  private makeMelody() {
    // 两小节一句，32 个十六分音符，大部分是休止
    const dense = this.style === 'chip' || this.style === 'musicbox'
    this.melody = Array.from({ length: 32 }, (_, i) => {
      if (dense ? i % 2 || this.rng() > 0.6 : i % 2 || this.rng() > 0.36) return null
      const scale = this.minor ? [0, 3, 5, 7, 10, 12, 15, 17] : this.style === 'jazz' ? [0, 2, 4, 7, 9, 10, 12, 14] : PENTA
      if (this.style === 'folk' && this.rng() < 0.3) return null // 口哨更疏朗
      return this.key + 12 + scale[Math.floor(this.rng() * scale.length)]
    })
  }

  start() {
    if (this.timer) return
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.08
    this.timer = window.setInterval(() => this.schedule(), 25)
    this.startBed()
  }

  stop() {
    clearInterval(this.timer)
    this.timer = 0
    this.stopBed()
  }

  private schedule() {
    const sixteenth = 60 / this.bpm / 4
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const s = this.step % 16
      if (s === 0 && this.pendingStyle) {
        this.setStyle(this.pendingStyle, true)
        this.pendingStyle = null
        this.step = 0 // 从新风格的第一小节开始
      }
      if (s === 0 && this.pendingSeed) {
        this.setSeed(this.pendingSeed, true)
        this.pendingSeed = null
      }
      const sw = CONF[this.style].swing
      // 摇摆感：反拍往后拖一点（爵士拖得更多，接近三连音）
      const t = this.nextTime + (s % 2 ? sixteenth * sw : 0)
      const play = {
        lofi: this.playLofi,
        rainy: this.playLofi,
        ambient: this.playAmbient,
        jazz: this.playJazz,
        chip: this.playChip,
        rock: this.playRock,
        folk: this.playFolk,
        synth: this.playSynth,
        guofeng: this.playGuofeng,
        musicbox: this.playMusicBox
      }[this.style]
      play.call(this, this.step, t, sixteenth)
      this.nextTime += 60 / this.bpm / 4
      this.step++
    }
  }

  private melodyAt(bar: number, s: number) {
    if (bar % 8 === 7 && s === 0) this.makeMelody() // 旋律慢慢变化，不会一直重复
    return this.melody[(bar % 2) * 16 + s]
  }

  /* ---------- lo-fi / 雨天 ---------- */
  private playLofi(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg, shape] = this.prog[bar % 4]
    const root = this.key + deg
    const r = this.rng
    const rainy = this.style === 'rainy'

    // 鼓：kick 在 1 和 3 拍附近，snare 在 2、4 拍，hi-hat 八分音符（雨天更稀疏）
    if (s === 0 || s === 10 || (s === 7 && r() < 0.25)) this.kick(t)
    if (s === 4 || s === 12) this.snare(t)
    if (s % 2 === 0 && (!rainy || s % 4 === 0 || r() < 0.4)) this.hat(t, s % 4 === 0 ? 0.55 : 0.32)
    else if (!rainy && r() < 0.12) this.hat(t, 0.18)

    // 和弦：每小节开头弹一次，偶尔在后半拍再轻轻补一下
    if (s === 0) this.chord(root, shape, t, sixteenth * 16, 1)
    if (s === 10 && r() < 0.3) this.chord(root, shape, t, sixteenth * 6, 0.45)

    // 贝斯
    if (s === 0) this.bassNote(root - 12, t, sixteenth * 7)
    if (s === 8) this.bassNote(root - 12 + (r() < 0.4 ? 7 : 0), t, sixteenth * 5)
    if (s === 14 && r() < 0.35) this.bassNote(root - 10, t, sixteenth * 2)

    // 旋律：前 8 小节先铺垫，之后每 4 小节里唱 2 小节
    if (bar >= 8 && bar % 4 < 2) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.leadNote(n, t, sixteenth * 3)
    }
  }

  /* ---------- 氛围 ---------- */
  // 没有鼓，两小节一个长和弦慢慢铺开，偶尔几声铃音落在混响里
  private playAmbient(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    if (s === 0 && bar % 2 === 0) {
      const [deg, shape] = this.prog[(bar / 2) % 4]
      const root = this.key + deg
      const dur = sixteenth * 32 + 2
      this.padChord(root, shape, t, dur)
      this.bassNote(root - 12, t, dur, 0.22, 0.8)
    }
    if (s % 4 === 0 && this.rng() < 0.2) {
      const scale = this.minor ? [0, 3, 7, 10, 12, 15, 19] : [0, 4, 7, 9, 12, 16, 19]
      this.bell(this.key + 12 + scale[Math.floor(this.rng() * scale.length)], t)
    }
  }

  /* ---------- 爵士 ---------- */
  // 行走贝斯每拍一个音；刷子鼓：ride「叮 叮-嗒 叮」+ 2、4 拍的刷子
  private playJazz(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg, shape] = this.prog[bar % 4]
    const root = this.key + deg
    const r = this.rng

    if (s === 0 || s === 4 || s === 8 || s === 12 || s === 7 || s === 15) this.ride(t, s % 4 === 0 ? 0.6 : 0.4)
    if (s === 4 || s === 12) this.brush(t)
    if (s === 0 && r() < 0.5) this.kick(t, 0.45)

    // 和弦在反拍「推」一下，比 lo-fi 更随性
    if (s === 0 && r() < 0.6) this.chord(root, shape, t, sixteenth * 7, 0.8)
    if (s === 6 && r() < 0.5) this.chord(root, shape, t, sixteenth * 6, 0.6)
    if (s === 11 && r() < 0.35) this.chord(root, shape, t, sixteenth * 4, 0.5)

    if (s % 4 === 0) {
      const beat = s / 4
      const [nextDeg] = this.prog[(bar + 1) % 4]
      let m: number
      if (beat === 0) m = root
      else if (beat === 3) m = this.key + nextDeg + (r() < 0.5 ? -1 : 1) // 半音接近下一个和弦的根音
      else m = root + shape[Math.floor(r() * 3)]
      while (m > this.key + 4) m -= 12
      this.bassNote(m - 12, t, sixteenth * 3.6, 0.5)
    }

    if (bar >= 4 && bar % 4 >= 2) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.leadNote(n, t, sixteenth * 2.5)
    }
  }

  /* ---------- 8-bit ---------- */
  // 方波琶音 + 三角波贝斯 + 噪声鼓
  private playChip(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg, shape] = this.prog[bar % 4]
    const root = this.key + 12 + deg
    const r = this.rng

    const arp = [0, 1, 2, 1]
    this.chip('square', root + shape[arp[s % 4]] + (s >= 8 && s % 8 >= 4 ? 12 : 0), t, sixteenth * 0.9, 0.022, this.bright)
    if (s % 2 === 0) this.chip('triangle', this.key - 12 + deg + (s % 4 === 2 ? 12 : 0), t, sixteenth * 1.8, 0.2, this.bass)

    if (s === 0 || s === 8 || (s === 10 && r() < 0.4)) this.kick(t, 0.6)
    if (s === 4 || s === 12) this.noiseHit(t, 'highpass', 1200, 0.25, 0.09)
    if (s % 2 === 0) this.noiseHit(t, 'highpass', 8000, 0.05, 0.02)

    if (bar >= 4) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.chip('square', n + 12, t, sixteenth * 1.8, 0.03, this.bright, true)
    }
  }

  /* ---------- 摇滚 ---------- */
  // 八分音符的闷音强力和弦，每两拍一次重音；贝斯跟着根音走；鼓更重，四小节一次镲
  private playRock(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg] = this.prog[bar % 4]
    let root = this.key + deg // 吉他的强力和弦放在低把位（约 A#2 ~ A3）
    if (root > 57) root -= 12
    const r = this.rng

    if (s % 2 === 0) {
      const accent = s === 0 || s === 6 || s === 8 || s === 14
      for (const iv of P5) this.pluck(root + iv, t, accent ? sixteenth * 3.5 : sixteenth * 1.3, accent ? 0.5 : 0.28, this.dist, 0.994)
    }
    if (s % 2 === 0) this.chip('sawtooth', root - 12, t, sixteenth * 1.8, 0.09, this.bass)

    if (s === 0 || s === 8 || (s === 6 && r() < 0.5) || (s === 11 && r() < 0.3)) this.kick(t, 1)
    if (s === 4 || s === 12) {
      this.noiseHit(t, 'bandpass', 1900, 0.5, 0.22)
      this.snare(t)
    }
    if (s % 2 === 0) this.hat(t, 0.6)
    if (s === 0 && bar % 4 === 0) this.noiseHit(t, 'highpass', 5000, 0.16, 1.4, 0.5)

    // 第 8 小节后，偶尔来一句失真的主音
    if (bar >= 8 && bar % 4 >= 2) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.pluck(n + 12, t, sixteenth * 3, 0.35, this.dist, 0.997)
    }
  }

  /* ---------- 民谣 ---------- */
  // 木吉他指弹：拇指交替弹根音和五度，其他手指在反拍拨高音；口哨哼旋律
  private playFolk(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg, shape] = this.prog[bar % 4]
    const root = this.key + deg
    const r = this.rng
    let low = root - 12
    while (low < 40) low += 12

    if (s % 4 === 0) this.pluck(s % 8 === 0 ? low : low + 7, t, 1.6, 0.42, this.bright, 0.996)
    if (s % 4 === 2) {
      const pick = [1, 2, 3, 2][(s / 2 - 1) / 2]
      let m = root + shape[Math.min(pick, shape.length - 1)]
      while (m < 59) m += 12
      this.pluck(m, t, 1.4, 0.3, this.bright, 0.995)
    }
    if (s === 0 && r() < 0.5) this.pluck(root + shape[shape.length - 1] + 12, t + 0.02, 1.8, 0.2, this.bright, 0.996)

    if (s === 0 || s === 8) this.kick(t, 0.4)
    if (s % 2 === 0) this.noiseHit(t, 'bandpass', 5200, s % 4 === 2 ? 0.07 : 0.04, 0.06, 1.2) // 沙锤

    if (bar >= 8 && bar % 4 < 2) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.whistle(n + 12, t, sixteenth * 3)
    }
  }

  /* ---------- Synthwave ---------- */
  // 八分音符的锯齿波贝斯（八度跳动）、十六分音符琶音带回声、长音铺底、大混响的军鼓
  private playSynth(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg, shape] = this.prog[bar % 4]
    const root = this.key + deg
    const r = this.rng

    if (s === 0) this.padChord(root, shape, t, sixteenth * 16 + 0.4)
    if (s % 2 === 0) this.chip('sawtooth', root - 24 + (s % 4 === 2 ? 12 : 0), t, sixteenth * 1.7, 0.1, this.bass)
    // 琶音：上行再下行
    const arp = [0, 1, 2, 3, 2, 1, 0, 1]
    if (bar >= 2) this.chip('sawtooth', root + 12 + shape[arp[s % 8]], t, sixteenth * 0.8, 0.018, this.lead)

    if (s === 0 || s === 8) this.kick(t, 0.9)
    if (s === 4 || s === 12) {
      this.noiseHit(t, 'bandpass', 1800, 0.35, 0.3, 0.7)
      this.noiseHit(t, 'bandpass', 1800, 0.25, 0.3, 0.7, 0.002, this.verb) // 门控混响的大军鼓
    }
    if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.7 : 0.4)
    if (s === 14 && r() < 0.5) this.noiseHit(t, 'highpass', 7000, 0.06, 0.18)

    if (bar >= 8 && bar % 4 >= 2) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.chip('square', n + 12, t, sixteenth * 3, 0.025, this.lead, true)
    }
  }

  /* ---------- 古风 ---------- */
  // 古筝：拨弦 + 揉弦，偶尔来一串五声音阶的刮奏；笛子吹旋律；木鱼和低沉的鼓点缀
  private playGuofeng(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg] = this.prog[bar % 4]
    const root = this.key + deg
    const r = this.rng
    const scale = [0, 2, 4, 7, 9]
    const note = (i: number) => this.key + scale[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5)

    // 低音：根音 + 五度的空五度
    if (s === 0) {
      this.pluck(root - 12, t, 3, 0.4, this.bright, 0.998, true)
      this.pluck(root - 5, t + 0.03, 3, 0.25, this.bright, 0.998, true)
    }
    // 刮奏：每四小节开头，一串快速上行的五声音阶
    if (s === 0 && bar % 4 === 0) {
      const start = Math.floor(r() * 3) + 5
      for (let i = 0; i < 7; i++) this.pluck(note(start + i), t + 0.1 + i * 0.05, 1.2, 0.16, this.bright, 0.996)
    }
    // 八分音符的点缀，带揉弦
    if (s % 4 === 2 && r() < 0.55) this.pluck(note(5 + Math.floor(r() * 6)), t, 1.8, 0.24, this.bright, 0.997, true)

    if (s === 0 || (s === 10 && r() < 0.4)) this.kick(t, 0.35)
    if ((s === 6 || s === 14) && r() < 0.45) this.woodblock(t)

    if (bar >= 4 && bar % 4 < 3) {
      const n = this.melodyAt(bar, s)
      if (n != null) this.flute(n + 12, t, sixteenth * 4)
    }
  }

  /* ---------- 八音盒 ---------- */
  // 高音区的金属簧片：旋律 + 四分音符的分解和弦，每个音都有一点随机走调
  private playMusicBox(step: number, t: number, sixteenth: number) {
    const s = step % 16
    const bar = Math.floor(step / 16)
    const [deg, shape] = this.prog[bar % 4]
    const root = this.key + deg

    if (s % 4 === 0) this.tine(root + 12 + shape[(s / 4) % shape.length], t, 0.6)
    const n = this.melodyAt(bar, s)
    if (n != null) this.tine(n + 12, t, 1)
    // 发条的「咔哒」声，很轻
    if (s === 0 && this.rng() < 0.3) this.noiseHit(t, 'highpass', 6000, 0.015, 0.01, 0.8, 0.001, this.out)
  }

  /* ---------- 音色 ---------- */
  // 拨弦：Karplus-Strong 算法离线算出一段真实的「弦」振动，按音高缓存复用
  private pluckBuffer(m: number, decay: number) {
    const k = `${m}|${decay}`
    const cached = this.plucks.get(k)
    if (cached) return cached
    const sr = this.ctx.sampleRate
    const f = mtof(m)
    const n = Math.max(2, Math.round(sr / f))
    const len = Math.floor(sr * 2.4)
    const buf = this.ctx.createBuffer(1, len, sr)
    const out = buf.getChannelData(0)
    const ring = new Float32Array(n)
    let prev = 0
    for (let i = 0; i < n; i++) {
      // 初始激励：稍微平滑过的噪声，音色更圆润
      prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5
      ring[i] = prev
    }
    let p = 0
    for (let i = 0; i < len; i++) {
      const a = ring[p]
      const b = ring[(p + 1) % n]
      out[i] = a
      ring[p] = decay * 0.5 * (a + b)
      p = (p + 1) % n
    }
    this.plucks.set(k, buf)
    return buf
  }

  private pluck(m: number, t: number, dur: number, peak: number, bus: GainNode, decay = 0.996, vibrato = false) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.pluckBuffer(m, decay)
    // 周期取整带来的音高误差，用播放速率补回来
    const sr = this.ctx.sampleRate
    const rate = mtof(m) / (sr / Math.max(2, Math.round(sr / mtof(m))))
    src.playbackRate.value = rate
    if (vibrato) {
      // 揉弦：弹下去之后，音高轻轻上下晃
      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 5
      const depth = this.ctx.createGain()
      depth.gain.setValueAtTime(0, t)
      depth.gain.linearRampToValueAtTime(rate * 0.007, t + 0.5)
      lfo.connect(depth).connect(src.playbackRate)
      lfo.start(t)
      lfo.stop(t + dur + 0.05)
    }
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.setValueAtTime(peak, t + Math.max(0.01, dur - 0.08))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(g).connect(bus)
    if (vibrato) g.connect(this.verb) // 揉弦的音送一点混响，更有空间感
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  // 笛子：正弦 + 一点三角波泛音，偶尔从下方装饰音滑上来，带气声和混响
  private flute(m: number, t: number, dur: number) {
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    const f = mtof(m)
    if (this.rng() < 0.35) {
      o.frequency.setValueAtTime(f * 2 ** (-2 / 12), t)
      o.frequency.exponentialRampToValueAtTime(f, t + 0.09)
    } else o.frequency.setValueAtTime(f, t)
    const o2 = this.ctx.createOscillator()
    o2.type = 'triangle'
    o2.frequency.value = f * 2
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 4.5
    const depth = this.ctx.createGain()
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(12, t + 0.35)
    lfo.connect(depth).connect(o.detune)
    const g = this.ctx.createGain()
    this.env(g, t, 0.08, 0.07, dur + 0.35)
    const g2 = this.ctx.createGain()
    this.env(g2, t, 0.012, 0.07, dur + 0.2)
    o.connect(g)
    o2.connect(g2)
    for (const n of [g, g2]) {
      n.connect(this.lead)
      n.connect(this.verb)
    }
    this.noiseHit(t, 'bandpass', f * 2, 0.02, dur * 0.6, 1.5, 0.06, this.lead) // 气声
    for (const n of [o, o2, lfo]) {
      n.start(t)
      n.stop(t + dur + 0.4)
    }
  }

  // 木鱼：短促的中高频「笃」
  private woodblock(t: number) {
    const o = this.ctx.createOscillator()
    o.frequency.setValueAtTime(820, t)
    o.frequency.exponentialRampToValueAtTime(760, t + 0.05)
    const g = this.ctx.createGain()
    this.env(g, t, 0.12, 0.001, 0.07)
    o.connect(g).connect(this.drums)
    o.start(t)
    o.stop(t + 0.1)
  }

  // 八音盒簧片：高音正弦 + 不谐和的泛音，快起长衰减，每次随机走调几个音分
  private tine(m: number, t: number, vel: number) {
    let mm = m
    while (mm < 72) mm += 12
    while (mm > 91) mm -= 12
    const detune = (Math.random() * 2 - 1) * 9
    for (const [mult, amp, dur] of [
      [1, 1, 1.6],
      [4.2, 0.12, 0.4]
    ]) {
      const o = this.ctx.createOscillator()
      o.frequency.value = mtof(mm) * mult
      o.detune.value = detune
      const g = this.ctx.createGain()
      this.env(g, t, 0.07 * vel * amp, 0.002, dur)
      o.connect(g)
      g.connect(this.bright)
      g.connect(this.verb)
      o.start(t)
      o.stop(t + dur + 0.05)
    }
  }

  // 口哨：纯正弦 + 慢颤音 + 一点气声
  private whistle(m: number, t: number, dur: number) {
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(mtof(m) * 0.97, t)
    o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.06) // 起音时从下往上滑一点
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 5.5
    const depth = this.ctx.createGain()
    depth.gain.value = 9
    lfo.connect(depth).connect(o.detune)
    const g = this.ctx.createGain()
    this.env(g, t, 0.07, 0.05, dur + 0.25)
    o.connect(g).connect(this.lead)
    o.start(t)
    lfo.start(t)
    o.stop(t + dur + 0.3)
    lfo.stop(t + dur + 0.3)
  }

  private env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  }

  // 电钢琴：正弦 + 轻微失谐的三角波，音符之间有一点「扫弦」时差
  private chord(root: number, shape: number[], t: number, dur: number, vel: number) {
    shape.forEach((iv, i) => {
      let m = root + iv
      while (m > 72) m -= 12
      while (m < 55) m += 12
      const at = t + i * 0.014
      for (const [type, detune, amp] of [
        ['sine', 0, 1],
        ['triangle', 6, 0.3]
      ] as const) {
        const o = this.ctx.createOscillator()
        o.type = type
        o.frequency.value = mtof(m)
        o.detune.value = detune
        const g = this.ctx.createGain()
        this.env(g, at, 0.07 * vel * amp, 0.02, dur)
        o.connect(g).connect(this.keys)
        o.start(at)
        o.stop(at + dur + 0.05)
      }
    })
  }

  // 长音铺底：慢起慢收，两个略微失谐的振荡器形成缓慢的「呼吸」
  private padChord(root: number, shape: number[], t: number, dur: number) {
    shape.forEach((iv) => {
      let m = root + iv
      while (m > 71) m -= 12
      while (m < 52) m += 12
      for (const [type, detune] of [
        ['sine', -7],
        ['triangle', 7]
      ] as const) {
        const o = this.ctx.createOscillator()
        o.type = type
        o.frequency.value = mtof(m)
        o.detune.value = detune
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.045, t + 1.8)
        g.gain.setValueAtTime(0.045, t + dur - 2.2)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(g)
        g.connect(this.pad)
        g.connect(this.verb)
        o.start(t)
        o.stop(t + dur + 0.1)
      }
    })
  }

  // 铃音：快起、长长的衰减，泛音让它有点像钟琴
  private bell(m: number, t: number) {
    for (const [mult, amp] of [
      [1, 1],
      [2.76, 0.18]
    ]) {
      const o = this.ctx.createOscillator()
      o.frequency.value = mtof(m) * mult
      const g = this.ctx.createGain()
      this.env(g, t, 0.05 * amp, 0.006, mult === 1 ? 3 : 1.2)
      o.connect(g)
      g.connect(this.lead)
      g.connect(this.verb)
      o.start(t)
      o.stop(t + 3.1)
    }
  }

  // 8-bit 音色：方波 / 三角波，几乎没有起音，可选一点颤音
  private chip(type: OscillatorType, m: number, t: number, dur: number, peak: number, bus: GainNode, vibrato = false) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = mtof(m)
    if (vibrato) {
      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 6
      const depth = this.ctx.createGain()
      depth.gain.value = 10
      lfo.connect(depth).connect(o.detune)
      lfo.start(t + 0.08)
      lfo.stop(t + dur + 0.05)
    }
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(peak, t)
    g.gain.setValueAtTime(peak, t + dur * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(bus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private bassNote(m: number, t: number, dur: number, peak = 0.45, attack = 0.012) {
    const o = this.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = mtof(m)
    const g = this.ctx.createGain()
    this.env(g, t, peak, attack, dur)
    o.connect(g).connect(this.bass)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private leadNote(m: number, t: number, dur: number) {
    const o = this.ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = mtof(m)
    // 一点点颤音
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 5
    const depth = this.ctx.createGain()
    depth.gain.value = 4
    lfo.connect(depth).connect(o.detune)
    const g = this.ctx.createGain()
    this.env(g, t, 0.12, 0.03, dur + 0.4)
    o.connect(g).connect(this.lead)
    o.start(t)
    lfo.start(t)
    o.stop(t + dur + 0.5)
    lfo.stop(t + dur + 0.5)
  }

  private kick(t: number, vel = 0.9) {
    const o = this.ctx.createOscillator()
    o.frequency.setValueAtTime(115, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
    const g = this.ctx.createGain()
    this.env(g, t, vel, 0.004, 0.38)
    o.connect(g).connect(this.drums)
    o.start(t)
    o.stop(t + 0.42)
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, peak: number, dur: number, q = 0.8, attack = 0.002, dest?: AudioNode) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = this.ctx.createGain()
    this.env(g, t, peak, attack, dur)
    src.connect(f).connect(g).connect(dest ?? this.drums)
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.02)
  }

  private snare(t: number) {
    this.noiseHit(t, 'bandpass', 1700, 0.32, 0.2)
    const o = this.ctx.createOscillator()
    o.frequency.value = 185
    const g = this.ctx.createGain()
    this.env(g, t, 0.12, 0.002, 0.09)
    o.connect(g).connect(this.drums)
    o.start(t)
    o.stop(t + 0.12)
  }

  private hat(t: number, vel: number) {
    this.noiseHit(t, 'highpass', 7500, 0.09 * vel, 0.045)
  }
  // 爵士的 ride 镲：比 hi-hat 更亮、余音更长
  private ride(t: number, vel: number) {
    this.noiseHit(t, 'bandpass', 6200, 0.1 * vel, 0.22, 2.5)
  }
  // 刷子：慢起的「唰」
  private brush(t: number) {
    this.noiseHit(t, 'bandpass', 2600, 0.12, 0.2, 0.6, 0.04)
  }

  /* ---------- 底噪：黑胶沙沙声 / 雨声 ---------- */
  private startBed() {
    this.stopBed()
    clearInterval(this.thunderTimer)
    const kind = { lofi: 'vinyl', jazz: 'vinyl', rainy: 'rain', ambient: 'vinyl', chip: '', rock: '', folk: '', synth: '', guofeng: '', musicbox: 'vinyl' }[this.style]
    if (!kind) return
    const sr = this.ctx.sampleRate
    const len = sr * 4
    const buf = this.ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      if (kind === 'rain') {
        // 雨：宽频的沙沙 + 密集的小水滴
        last = last * 0.6 + (Math.random() * 2 - 1) * 0.4
        d[i] = last * 0.35
        if (Math.random() < 0.004) {
          const amp = Math.random() * 0.25
          for (let k = 0; k < 60 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 10) * (Math.random() * 2 - 1)
        }
      } else {
        last = last * 0.96 + (Math.random() * 2 - 1) * 0.04
        d[i] = last * 0.5
        if (Math.random() < 0.00025) {
          const amp = (Math.random() * 2 - 1) * 0.5
          for (let k = 0; k < 40 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 6)
        }
      }
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = this.ctx.createGain()
    const level = { lofi: 0.22, jazz: 0.12, ambient: 0.05, rainy: 0.5, chip: 0, rock: 0, folk: 0, synth: 0, guofeng: 0, musicbox: 0.04 }[this.style]
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(level, this.ctx.currentTime + 1.5)
    if (kind === 'rain') {
      const f = this.ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 2200
      f.Q.value = 0.3
      src.connect(f).connect(g).connect(this.out)
      // 远处的雷声：平均半分钟左右一次
      const thunder = () => this.thunder()
      this.thunderTimer = window.setInterval(() => Math.random() < 0.35 && thunder(), 10000)
    } else src.connect(g).connect(this.out)
    src.start()
    this.bed = { src, gain: g }
  }

  private stopBed() {
    clearInterval(this.thunderTimer)
    const b = this.bed
    this.bed = null
    if (!b) return
    const now = this.ctx.currentTime
    b.gain.gain.cancelScheduledValues(now)
    b.gain.gain.setValueAtTime(b.gain.gain.value, now)
    b.gain.gain.linearRampToValueAtTime(0, now + 0.8)
    try {
      b.src.stop(now + 0.85)
    } catch {}
  }

  private thunder() {
    const t = this.ctx.currentTime + 0.1
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 140
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.9)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5)
    src.connect(f).connect(g).connect(this.out)
    src.start(t)
    src.stop(t + 5.2)
  }
}
