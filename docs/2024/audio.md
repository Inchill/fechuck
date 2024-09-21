# web 音频基础

[[toc]]

## 背景

在一次需求中，需要在 B 端对音频进行录制，然后再上传到 CDN，最后提供给 C 端用户。借这个机会梳理了一下我对于音频的理解和实践，在此记录一下。

## 基础知识

先来看看音频录制需要前置了解的知识点。

### sampleBits

![bit depth](/2024/audio/bit-depth.png){data-zoomable}

sampleBits 采样位数，也称为位深 bit depth ，可以理解数字音频设备处理声音的解析度，即对声音的辨析度。就像表示颜色的位数一样（8 位表示 256 种颜色，16位表示 65536 种颜色），有 8、16、24 位等。这个数值越大，解析度就越高，录制和回放的声音就越真实。对于专业录制音频的设备来说，还会使用 32 位，但是目前一般都使用 16 位。

### sampleRate

![sample rate](/2024/audio/sample-rate.webp){data-zoomable}

sampleRate 采样率，就是对声音信息 1 秒钟采样多少次，以记录成数字信息。如 CD 音频是 44.1KHz 采样率，它对声音以每秒 44100 次的频率来记录信息。原则上采样率越高，声音的质量越好。一般为 11025、16000、22050、24000、44100、48000，默认为浏览器自带的采样率。

### numChannels

numChannels 声道数，由于音频的采集和播放是可以叠加的，因此，可以同时从多个音频源采集声音，并分别输出到不同的扬声器，故声道数一般表示声音录制时的音源数量或回放时相应的扬声器数量。单声道（Mono）和双声道（Stereo）比较常见，顾名思义，前者的声道数为 1，后者为 2。

有关它们的详细信息可以查看下面汇总的表格：

| 名称 | 质量 | 体积 |
| ---- | --- | --- |
| 声道数 | 声道数量只影响方向感，而不影响质量。 | 根据内容和编码器设置的不同，每个通道可能会大幅增加编码音频的大小。 |
| 采样率 | 每秒可用的采样越多，编码后的音频保真度就可能越高。 | 提高采样率会增加编码音频文件的大小。 |
| 采样位数 | 采样位数越高，音频的动态范围越大。动态范围是音频信号从最安静到最响亮的部分的范围。较高的采样位数可以捕捉到更多的细节和更微妙的音量变化，从而提供更好的音质。例如，16 位音频的动态范围约为 96 分贝，而 24 位音频的动态范围约为 144 分贝。 | 采样位数越高，每个样本占用的字节数越多，音频文件的体积就越大。例如，8 位音频每个样本占 1 字节，16 位音频每个样本占 2 字节，24 位音频每个样本占 3 字节。 |

### 音频编码

我们常见的音频格式，其实指的是音频编码压缩格式，常见的有 MP3，AAC，OGG，WMA，Opus，FLAC，APE，m4a，AMR 等。音频编码就是指将获取到的音频数据按约定格式进行转换。编码时通常会对数据进行一定程度上的压缩，也因此分为 2 类：有损格式和无损格式。不同的格式有不同的采样率，采样位数，声道数，压缩率，编码格式等等，它们之间存在一定的差异，并且不同系统和平台的支持程度不同。

![audio format](/2024/audio/format.webp){data-zoomable}

我们重点关注下 html5 支持的音频格式：

1. 常见的有损格式：MP3，AAC，Ogg；
2. 常见的无损格式：WAV，FLAC，APE。

| 音频格式 | 特点 |
| ------- | --- |
| wav | 全称：Waveform Audio File Format，由微软和IBM开发的，在 windows 平台有着广泛的支持，编码时不会对原数据进行压缩，因此也就没有数据会丢失。缺点便是占用的存储空间较大。 |
| flac | 全称：Free Lossless Audio Codec，Codec 意思为编解码器，它对数据进行压缩后不会损失数据。特点是高压缩率解压慢，低压缩率解压快。对于需要原始质量和音调准确性的较小音频效果文件以及音乐存档来说，FLAC 是一个不错的选择。 |
| mp3 | 全称：MPEG-1 Audio Layer III，它在存储时舍弃了一部分对人类听觉不重要的音频数据，从而能将音频数据压缩存储成较小的文件。是一种有损格式。它的比特率通常位于 128kbps 和 320kbps 之间。优点是主流浏览器都支持，缺点是会损失高频音质。与 MPEG-2 文件中的 MP3 音频相比，MPEG-1 MP3 音频支持更高的比特率和采样率。MPEG-1 格式的 MP3 通常最适合用于音乐或其他复杂的音频，而 MPEG-2 模式的 MP3 音频则可用于语音和其他较简单的声音。 |
| aac | 全称：Advanced Audio Coding，与其相关的文件后缀名有：.aac，.mp4，.m4a。AAC 旨在提供比 MP3 更高的压缩率和更高的音频保真度，AAC 已成为一种流行的选择，并且是许多类型媒体（包括蓝光光盘和 HDTV）中的音频标准格式，也是所使用的格式适用于从 iTunes 等在线供应商购买的歌曲。 |

## 录制

### getUserMedia

这个方法用于在浏览器里录制音频，接收一个 object 参数，用于指定我们想要录制的媒体类型。使用这个方法有隐私和安全性要求：

1. 用户隐私：在使用之前会先询问用户是否同意录制；
2. 安全性：
    - 权限策略：适用于 getUserMedia() 的两个权限策略指令是摄像头和麦克风。
    - 加密安全：getUserMedia() 方法仅在安全上下文中可用。安全上下文是指当前文档是通过 HTTPS/TLS 安全加密的。如果使用的 http 协议，navigator.mediaDevices 会显示 undefined，从而无法访问 getUserMedia()。
3. 文档来源安全：
    - 除非 `iframe` 的沙盒属性设置为 allow-same-origin，否则加载到沙盒 `iframe` 元素中的文档无法调用 getUserMedia()。
    - 使用 data:// 或 blob:// URL 加载的文档如果没有来源（例如用户在地址栏中输入了这些 URL），则不能调用 getUserMedia()。从 JavaScript 代码加载的这类 URL 会继承脚本的权限。
    - 任何其他没有原点的情况，例如使用 srcdoc 属性指定帧的内容。

该方法最终的返回值是 `MediaStream`，一个流由多个轨道（如视频或音频轨道）组成。每个音轨都被指定为 MediaStreamTrack 的一个实例。

具体使用：

```js
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const audioPlayback = document.getElementById('audioPlayback');
    const downloadLink = document.getElementById('downloadLink');

    let mediaRecorder;
    let audioChunks = [];

    startBtn.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            console.log('audioBlob', audioBlob)

            const formData = new FormData()
            formData.append('file', new File([audioBlob], 'audio.wav', { type: 'audio/wav' }));

            fetch(API_URL, {
                method: 'POST',
                body: formData,
            }).then(res => res.json()).then((res) => {
                const audioUrl = res.data || URL.createObjectURL(audioBlob);
                audioPlayback.src = audioUrl;
                downloadLink.href = audioUrl;
            })

            audioChunks = [];
        };

        mediaRecorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
    });

    stopBtn.addEventListener('click', () => {
        mediaRecorder.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });
});
```

这里采集的是 wav 格式的音频，上传的时候也是采用的 wav 格式。

### `js-audio-recorder` 库

也可以使用 `js-audio-recorder` 这个库，主要用于 Web 端录制短音频，它支持的功能主要有：

- 支持录音，暂停，恢复，和录音播放。
- 支持音频数据的压缩，支持单双通道录音。
- 支持录音时长、录音大小的显示。
- 支持导出录音文件，格式为pcm或wav。
- 支持录音波形显示，可自己定制。
- 录音数据支持第三方平台的语音识别。
- 支持MP3（借助[lamejs](https://github.com/zhuker/lamejs)）。

我使用的版本是 `1.0.7`，已经不支持边录边转了。

## 将音频数据编码为 mp3 格式

在停止录音时，会调用 `mp3Encoder` 对拿到的 blob 数据进行编码。之所以有这一步处理，是因为在之前录制的音频只是简单地将后缀改为 `.mp3`，然后再上传至 CDN，后面发现 iOS 设备加载的时候就报错了，所以需要对音频数据严格编码为 `mp3` 格式。

`mp3Encoder` 函数定义如下，这里采用了 `lamejs` 这个库进行处理。

```js
function mp3Encoder (arrayBuffer) {
    return new Promise((resolve) => {
        const channels = 1; // 1 for mono or 2 for stereo
        const sampleRate = 48000; // 44.1khz (normal mp3 samplerate)
        const kbps = 128; // encode 128kbps mp3
        let mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
        let mp3Data = [];

        let samples = new Int16Array(arrayBuffer); // one second of silence (get your data from the source you have)
        const sampleBlockSize = 1152; // can be anything but make it a multiple of 576 to make encoders life easier

        for (let i = 0; i < samples.length; i += sampleBlockSize) {
            let sampleChunk = samples.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        let mp3buf = mp3encoder.flush(); // finish writing mp3

        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }

        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
        resolve(blob);
    });
}
```

这段代码会对采集的音频 blob 数据进行转换，将音频数据编码为 mp3 格式的 blob 格式数据，统一的音频格式能够消除平台的差异，保证音频的播放一致性。

## 后记

了解常见的音频格式和基本概念，能够辅助我们处理一些日常简单的音频需求。这篇文章对于音频的讨论也只是一点皮毛，如果需要更加系统地学习 web 音频，这里推荐一个 GitHub 仓库：[音视频流媒体权威资料整理](https://github.com/0voice/audio_video_streaming)。

## 参考文档

- [Web音视频入门系列——音视频基础知识](https://www.rtcdeveloper.cn/cn/community/blog/20421)
- [Web audio codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Audio_codecs)
