# 小程序内嵌 h5 如何跳转其它小程序？

## 背景

为了给业务提供更加快速的运营体验，我们设计了这样一种方案：提供一个支持高度配置化的平台（动态表单或者低代码平台），生成一个独立的 h5，h5 既能被嵌入到宿主小程序中，
也能通过浏览器打开，以此来满足业务运营需要的多场景、快速迭代的诉求。

运营 h5 页面的顶部是一个 banner 广告轮播图，每一张轮播图对应一个链接，如果是配置的 https 协议的链接，需要打开新的页面；如果是配置的 wxapp 协议的链接，则需要支持跳转到其它小程序。

在原生小程序中，可以通过 `wx.navigateToMiniProgram` 方法来跳转到其它小程序。但是通过 web-view 嵌入的页面，是没有办法直接跳转到其它小程序的。

## 思路

核心思路是借助宿主小程序的 `wx.navigateToMiniProgram` 方法，通过 web-view 嵌入的页面，通过 `wx.miniProgram.postMessage` 通信方法来触发宿主小程序的跳转事件。

也就是当我们确定跳转的链接是 wxapp 协议的，则通过 `wx.miniProgram.postMessage` 通信方法来触发宿主小程序的跳转事件。查阅官方文档，发现小程序不会立即收到消息，只会在特定时机收到消息。

![Web View](/2024/web-view.png)

宿主小程序只会在小程序后退、组件销毁、分享、复制链接时，通过 `bindmessage` 收到消息，如果不满足这几个条件，你再怎么发送消息，宿主小程序都不会收到。而我们就是想让宿主小程序立即收到消息，
然后调用 `wx.navigateToMiniProgram` 方法去打开其它小程序。

### 方式一：回退

如果当前小程序页面栈数量大于 1，也就是可以回退，内嵌 h5 可以执行以下操作：

1. 调用 `wx.miniProgram.postMessage` 之后立马调用 `wx.miniProgram.navigateBack`;
2. 原生小程序页面通过 `bindmessage` 方式拿到数据后，执行想要的逻辑；
3. 原生小程序页面触发回退操作。

### 方式二：组件销毁

1. 调用 `wx.miniProgram.postMessage` 之后立马调用 `wx.miniProgram.navigateTo` 到一个小程序中间页；
2. 原生小程序页面通过 `bindmessage` 方式拿到数据后，执行想要的逻辑；
3. 小程序中间页在 `onShow` 的时候显示弹窗引导用户触发跳转其他小程序；
4. 当用户点击确认跳转到其他小程序后，我们需要关闭中间页，这里通过 `onHide` 来实现：

## 具体方案

因为中间页仅仅是打开其他小程序，不涉及数据通信，另外小程序默认首页就是内嵌 h5，跳转到其他小程序后再回来需要显示首页，所以我采用了方式二。中间页样式如下：

![middle-page](/2024/middle.png)

因为使用的是 taro 框架开发小程序，所以下面是 taro 语法，具体代码如下：

```ts
useDidShow(() => {
    showModal({
    title: '是否跳转其他小程序？',
    success(res) {
        if (res.confirm) {
            openMiniProgram()
        }
        if (res.cancel) {
            showToast({
                title: '已取消',
                icon: 'error'
            })
        }
    }
    })
})

// 跳转到其他小程序之后销毁中间页
useDidHide(() => {
    const pages = getCurrentPages()
    if (pages.length === 1) { // 如果页面栈只有一个，则跳转到首页（可以根据实际确定兜底页面）
        redirectTo({
            url: '/pages/index/index'
        })
        return
    }
    navigateBack()
})
```

## 注意点

内嵌 h5 如果要使用原生小程序能力，比如 `wx.miniProgram.navigateTo`，需要先接入微信 jssdk，详情参考[官方文档](https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html)。
