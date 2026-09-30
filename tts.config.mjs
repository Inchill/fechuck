// 文章朗读音频的配置（scripts/tts.mjs 读取）
// 改完重新运行 pnpm tts，只有受影响的段落会重新生成
//
// 常用中文声音（完整列表：edge-tts --list-voices | grep zh-）
//   zh-CN-XiaoxiaoNeural   晓晓，女声，温暖自然（默认）
//   zh-CN-XiaoyiNeural     晓伊，女声，活泼
//   zh-CN-YunxiNeural      云希，男声，年轻有朝气
//   zh-CN-YunjianNeural    云健，男声，沉稳
//   zh-CN-YunyangNeural    云扬，男声，播音腔
//
// 单篇文章想用别的声音，在它的 frontmatter 里写 ttsVoice: zh-CN-YunxiNeural
// 某篇不想生成音频，写 tts: false
export default {
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: '+0%', // 语速，例如 -10%、+15%
  pitch: '+0Hz', // 音调，例如 -5Hz、+10Hz
  volume: '+0%', // 音量
  concurrency: 4 // 同时生成几段
}
