# 休言的博客

在 AI 时代，一个软件工程师的思考与实践，不局限于前端。

线上地址：[www.fechuck.com](https://www.fechuck.com) · [RSS](https://www.fechuck.com/feed.xml)

基于 [VitePress](https://vitepress.dev) 搭建，评论用 [giscus](https://giscus.app)，部署在 GitHub Pages。

## 栏目

| 栏目 | 路径 | 内容 |
| --- | --- | --- |
| 文章 | `docs/<年份>/` | 踩过的坑、做过的项目、弄明白的原理 |
| 随想 | `docs/notes/` | 还没长成文章的念头，想到就记 |
| 书签 | `docs/bookmarks/` | 值得常去的网站，每个都写了一句为什么 |
| 实验室 | `docs/lab/` | 能上手玩的互动小实验 |
| 关于 | `docs/about/` | 关于我和这个博客 |

实验室目前有：建造回放（把这个仓库按 git 提交回放成一座城）、文章星图、Token 显微镜、上下文窗口模拟器、Web Vitals 心电图、涂鸦白板（用的是我开源的 [react-whiteboard](https://github.com/Inchill/react-whiteboard)）。

## 站点功能

**阅读**

- 文章朗读：优先播放预先生成的语音（edge-tts），没生成过的段落退回浏览器自带的语音；逐段高亮并跟随滚动
- 背景音乐：纯 Web Audio 实时生成，以文章标题为种子，每篇文章有自己的旋律，朗读时自动压低音量
- 图片灯箱（PhotoSwipe）、长代码块折叠、数学公式、目录「展开全部 / 只看当前章节」切换
- 划词引用：选中一段文字可以复制引用、复制直达这段话的链接（Text Fragment），或生成一张分享卡片图片

**导航**

- `⌘K` / `Ctrl+K`（或 `/`）打开命令面板：搜索文章、随想、书签、实验室，也能切主题、放音乐
- 首页终端：可以用 `ls`、`open` 等命令逛博客
- 明暗主题切换时从按钮位置圆形扩散（View Transitions），默认暗色

**分发**

- RSS（`/feed.xml`，浏览器直接打开会显示订阅说明页）
- 每篇文章自动生成分享卡片图片（Open Graph / Twitter）
- 面向搜索引擎和大模型：sitemap、结构化数据、`llms.txt` / `llms-full.txt`，以及每篇文章的 Markdown 版本

## 本地开发

需要 Node.js 24（见 `.nvmrc`）和 pnpm。

```bash
pnpm install
pnpm docs:dev       # 本地预览
pnpm docs:build     # 构建到 docs/.vitepress/dist
pnpm docs:preview   # 预览构建结果
```

## 写作

**文章**放在 `docs/<年份>/` 下，标题取正文的第一个 `#` 一级标题：

```md
---
date: 2026-03-09
description: 一句话摘要，用于列表、RSS 和搜索结果；不写时取正文第一段
---

# 文章标题
```

**随想**放在 `docs/notes/`，文件名用 `YYYY-MM-DD-slug.md`，可以加 `tags`。

常用的 frontmatter：

| 字段 | 作用 |
| --- | --- |
| `date` | 发布日期，必填；没有日期的不会进 RSS 和分享卡片 |
| `description` | 摘要；不写时自动取正文第一段 |
| `tags` | 标签 |
| `draft: true` | 草稿：不出现在列表、RSS、sitemap 和 llms.txt 里 |
| `outline: deep` | 右侧目录显示更深的标题层级 |
| `aside: false` | 关掉右侧目录（正文没有二、三级标题时会自动关掉） |
| `comment: false` | 关掉评论 |
| `tts: false` | 不生成朗读音频 |
| `ttsVoice` | 这篇用别的朗读声音，例如 `zh-CN-YunxiNeural` |

**书签**在 `docs/bookmarks/links.mts` 里对应分类加一行即可：

```bash
pnpm favicons             # 抓取缺少的网站图标（部署时也会自动跑）
pnpm check-links          # 检查书签里的网站还能不能打开
pnpm check-links --fix    # 删掉确认失效的网站
```

## 朗读音频

`scripts/tts.mjs` 用 edge-tts 给文章逐段生成语音，声音、语速等在 `tts.config.mjs` 里配置。部署时会自动生成，本地运行只是为了预览：

```bash
pipx install edge-tts       # 还需要 ffmpeg
pnpm docs:build             # 脚本读的是构建出来的 HTML
pnpm tts                    # 全部文章和随想
pnpm tts 2025/claude-mcp    # 只生成路径里包含关键字的
```

音频按「声音参数 + 文字」哈希命名，改了哪段只重新生成哪段。

## 部署

推送到 `master` 后，GitHub Actions（`.github/workflows/deploy.yml`）会：

1. 抓取书签图标，构建站点（分享卡片图片需要中文字体，CI 里会安装 Noto CJK）
2. 从 `tts-audio` 分支取回已生成的朗读音频，只补新增或改动的段落，再存回该分支
3. 发布到 GitHub Pages，自定义域名见 `CNAME`

语音接口出问题时照常部署，页面会退回浏览器自带的声音。

## 目录结构

```text
docs/
├── 2024/ 2025/ 2026/    文章
├── notes/               随想
├── bookmarks/           书签（数据在 links.mts）
├── lab/                 实验室页面
├── about/               关于
├── public/              静态资源
└── .vitepress/
    ├── config.mts       站点配置、RSS、分享卡片和 llms.txt 的生成
    ├── og.mts           分享卡片图片
    ├── geo.mts          结构化数据、llms.txt
    └── theme/           自定义主题和组件（实验室的源码也在这里）
scripts/                 朗读音频、书签图标、链接检查
tts.config.mjs           朗读声音配置
```
