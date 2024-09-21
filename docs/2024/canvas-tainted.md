# rrweb 录制 canvas 被污染

[[toc]]

## 背景

团队内部自研的前端监控 `sdk` 有对错误进行录屏，这个录屏采用的是 `rrweb`，并且开启了对 `canvas` 的录屏。最近接到 `2` 个反馈说，由于监控 `sdk` 的原因导致应用本身的某个按钮不可点击。经过排查，这些项目的共性都是使用了 `canvas`。由此便第一时间便怀疑 `rrweb` 录屏导致的。

## 具体报错信息

测试环境报错信息如下：

![error](/2024/canvas-tainted/error.png){data-zoomable}

这个错误会不停地报，导致页面里的按钮被点击后没有响应。

浏览器里定位到的代码位置如下：

![browser-source](/2024/canvas-tainted/browser-source.png){data-zoomable}

## 源码定位

rrweb 对应的源码如下：

![rrweb-source](/2024/canvas-tainted/rrweb-source.png){data-zoomable}

因为 rrweb 会一直录屏，它会不停地调用 is2DCanvasBlank 方法去判断 2d canvas 是否空白，结果就是因为源 canvas 图像被污染了，导致一直报错。

## 原因分析

当使用 `drawImage` 方法绘制一个不同源的图像时，此时并不会报错，但是 `canvas` 会变成 `tainted`（被污染），之后如果在当前被污染的 `canvas` 上调用以下方法时就会抛出 `SecurityError` 的错误。

> [!TIP] API
> - HTMLCanvasElement.toDataURL()
> - HTMLCanvasElement.toBlob()
> - CanvasRenderingContext2D.getImageData()

> [!CAUTION]
> - Uncaught SecurityError: Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.
> - Uncaught SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The canvas has been tainted by cross-origin data.

在源码里能看到 `rrweb` 有通过对 `canvas` 内容进行提取，最后导致了这个错误。
那么问题的根源在于加载图片的时候没有设置跨域，图片本身的响应头如下：

```text
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-origin: *
```

即图片资源本身来源于 `CDN`，默认都是支持了 `CORS` 的，那么这个问题就在于渲染的时候缺乏对应设置了。

## 解决方案

### 方案一：设置图片 crossOrigin

使用 `fabric` 加载图片的时候，设置图片 `crossOrigin` 属性：

```js{3,6}
fabric.Image.fromURL('https://example.com/image.png', function(img) {
    img.set({
        crossOrigin: 'anonymous',
    });
    canvas.add(img);
}, { crossOrigin: 'anonymous' })
```

刚开始没有设置第三个配置项，结果发现并没有生效。后来查看了 `fabric` `源码，fromURL` 方法定义如下：

![fromURL](/2024/canvas-tainted/fromURL.png){data-zoomable}

然而官方文档里并没有说明这第三个参数:

![fromURL-usage](/2024/canvas-tainted/fromURL-usage.png){data-zoomable}

我们在回调函数里去设置图片的 `crossOrigin`，已经没有意义了，需要在加载图片之前进行设置，否则就会被污染。继续查看 `loadImage` 源码就可以看到：

![loadImage](/2024/canvas-tainted/loadImage.png){data-zoomable}

### 方案二：将图片转为 base64

`loadImage` 源码里有这么一段判断：

```js
      // data-urls appear to be buggy with crossOrigin
      // https://github.com/kangax/fabric.js/commit/d0abb90f1cd5c5ef9d2a94d3fb21a22330da3e0a#commitcomment-4513767
      // see https://code.google.com/p/chromium/issues/detail?id=315152
      //     https://bugzilla.mozilla.org/show_bug.cgi?id=935069
      // crossOrigin null is the same as not set.
      if (url.indexOf('data') !== 0 &&
        crossOrigin !== undefined &&
        crossOrigin !== null) {
        img.crossOrigin = crossOrigin;
      }
```

只有 `url` 不是 `data-url` 格式的才会给加上 `crossOrigin` 属性，因为 `data-url` 格式的图像同源不需要跨域，此时就不会出现图像被污染这种情况。
