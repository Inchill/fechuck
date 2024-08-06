# 学习记录

## yarn link 和 npm link

`npm link` 和 `yarn link` 是两个不同的命令，它们都可以创建一个指向本地包的链接，但是它们并不互通。也就是说，如果你在包 `A` 中使用了 `npm link`，那么在包B中就需要使用 `npm link A` 来创建链接，而不能使用 `yarn link A`。

在 `monorepo` 项目中，使用如下命令来将包链接到本地 `node_modules` 中：

```shell
lerna exec --scope @scope/eslint-config-xxx yarn link
```

## iframe 白屏问题

- `iframe` 内嵌了一个需要登录态的页面，在 useEffect 里会请求接口获取登录态信息，登录信息是通过接口获取的，再通过 `postMessage` 传递给 `iframe` 中的页面。有时候会出现 `iframe` 白屏的问题，此时控制台并没有输出双方通信的打印信息。

- 问题原因：`iframe` 页面先加载了，但是该页面缺乏登录态，即使请求接口也拿不到数据，所以不会渲染任何内容，导致 `iframe` 白屏。当后面父级页面通过接口拿到登录信息后，再透传给 `iframe` 页面，时间上就晚了，此时子页面仍然处于白屏状态，也没有请求接口数据。问题点在于子页面没有及时收到父页面传递的消息，所以没有触发接口请求，值得注意的是子页面是 Vue 项目，事件监听放在了 created 钩子函数里。

- 解决方法：先调用接口获取登录信息，再渲染 `iframe`，在 `onload` 后发送消息。
