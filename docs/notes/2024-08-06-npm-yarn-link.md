---
date: 2024-08-06
tags: [npm, yarn, monorepo]
description: npm link 和 yarn link 各管各的，建链接和用链接必须是同一个工具。
---

# npm link 和 yarn link 不互通

`npm link` 和 `yarn link` 是两个不同的命令，它们都可以创建一个指向本地包的链接，但是它们并不互通。也就是说，如果你在包 `A` 中使用了 `npm link`，那么在包B中就需要使用 `npm link A` 来创建链接，而不能使用 `yarn link A`。

在 `monorepo` 项目中，使用如下命令来将包链接到本地 `node_modules` 中：

```shell
lerna exec --scope @scope/eslint-config-xxx yarn link
```
