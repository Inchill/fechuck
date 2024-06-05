# 小程序内嵌 h5 如何跳转其它小程序？

![landscape](/landscape.jpg)

## 背景

为了给业务提供更加快速的运营体验，我们设计了这样一种方案：提供一个支持高度配置化的平台（动态表单或者低代码平台），生成一个独立的 h5，h5 既能被嵌入到宿主小程序中，
也能通过浏览器打开，以此来满足业务运营需要的多场景、快速迭代的诉求。

运营 h5 页面的顶部是一个 banner 广告轮播图，每一张轮播图对应一个链接，如果是配置的 https 协议的链接，需要打开新的页面；如果是配置的 wxapp 协议的链接，则需要支持跳转到其它小程序。

在原生小程序中，可以通过 `wx.navigateToMiniProgram` 方法来跳转到其它小程序。但是通过 web-view 嵌入的页面，是没有办法直接跳转到其它小程序的。

## 思路

核心思路是借助宿主小程序的 `wx.navigateToMiniProgram` 方法，如果需要消息通信，再通过 `wx.miniProgram.postMessage` 方法传递数据。

也就是当我们确定跳转的链接是 wxapp 协议的，则通过 `wx.miniProgram.postMessage` 通信方法来触发宿主小程序的跳转事件。查阅官方文档，发现小程序不会立即收到消息，只会在特定时机收到消息。

![Web View](/2024/web-view.png)

宿主小程序只会在小程序后退、组件销毁、分享、复制链接时，通过 `bindmessage` 收到消息，如果不满足这几个条件，你再怎么发送消息，宿主小程序都不会收到。而我们就是想让宿主小程序立即收到消息，
然后调用 `wx.navigateToMiniProgram` 方法去打开其它小程序。

要让宿主小程序收到消息，有以下 2 种方式：

### 方式一：回退

如果当前小程序页面栈数量大于 1，也就是可以回退，内嵌 h5 可以执行以下操作：

1. 调用 `wx.miniProgram.postMessage` 之后立马调用 `wx.miniProgram.navigateBack`;
2. 原生小程序页面通过 `bindmessage` 方式拿到数据后，执行想要的逻辑；
3. 原生小程序页面触发回退操作。

### 方式二：组件销毁

因为 web-view 会自动铺满整个小程序页面，所以这里的组件销毁实际上就是指的页面销毁。要实现页面销毁，可以使用 `redirectTo`、`reLaunch` 等方法，`navigateTo` 方法就不行，只要能够改变页面栈的操作，都可以触发页面销毁。

1. 调用 `wx.miniProgram.postMessage` 之后立马调用 `wx.miniProgram.redirectTo` 到一个小程序中间页；
2. 原生小程序页面通过 `bindmessage` 方式拿到数据后，执行想要的逻辑；
3. 小程序中间页在 `onHide` 的时候再次调用 `wx.redirectTo` 方法复原页面。

> [!NOTE]
> 上述方式都能触发数据通信，但是对于需要保留状态的页面而言，数据还原就比较麻烦。

## 具体方案

### 方案一：`wx-open-launch-weapp` 开放标签

这种方式是官方提供的，用于页面中提供一个可跳转指定小程序的按钮。使用此标签后，用户需在网页内点击标签按钮方可跳转小程序。H5通过开放标签打开小程序的场景值为1167。

开放的对象：

1. 已认证的服务号，服务号绑定“JS接口安全域名”下的网页可使用此标签跳转任意合法合规的小程序。
2. 已认证的非个人主体的小程序，使用小程序云开发的静态网站托管绑定的域名下的网页，可以使用此标签跳转任意合法合规的小程序。

### 方案二：跳转中间页

这种方式就是新增页面栈，实现跳转其它小程序的同时，还能保留原有页面栈，保留跳转之前的状态。

1. h5 通过 `wx.miniProgram.navigateTo` 方法跳转到小程序中间页；
2. 小程序中间页提供能够跳转其他小程序的按钮；
3. 用户点击按钮触发跳转其它小程序；
4. 当中间页 `onHide` 时销毁中间页。

我采用了方案二，理由和实际业务相关：

1. h5 跳转链接是在一个 banner 轮播图上配置的，而开放标签只是一个按钮，不符合业务诉求；
2. h5 跳转后仍然需要保留状态，如果改变原有页面栈再复原，数据复原会很麻烦。

方案二的中间页样式如下，这里我直接加了一个弹窗，点击确认后会再弹出另一个弹窗，用于确认是否跳转其它小程序。

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

对应的 h5 页面需要做两件事情：

1. 引入微信 jssdk；
2. 解析跳转链接，决定是否打开小程序中间页。

> [!TIP]
> 内嵌 h5 用到的是 `wx.miniProgram.navigateTo` 方法，不需要我们在公众号后台绑定域名，因此也不需要我们去调用 config 方法注入权限验证配置。

对应的 h5 页面代码如下：

```js
if (item?.bannerRedirectUrl && isWx) {
    wx.miniProgram.navigateTo({
        url: '/pages/middle/index'
    });
    return;
}
```

## 其它

内嵌 h5 如果要使用原生小程序更丰富的能力，比如定位、分享等 API，需要先接入微信 jssdk，详情参考[官方文档](https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html)，再通过调用 config 方法注入权限验证配置。
