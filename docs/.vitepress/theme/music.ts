// 播放器的歌单。默认只有「实时生成的 lo-fi」；
// 想加自己的曲子（要有公开使用的授权），把 mp3 放进 docs/public/music/，在这里加一行：
//   { title: '曲名', artist: '作者', src: '/music/xxx.mp3' }
export interface Track {
  title: string
  artist?: string
  src: string
}

export const tracks: Track[] = []
