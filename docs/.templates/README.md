# 如何发布

> 本目录（`.templates/`）以 `.` 开头，VitePress 不会把它构建成页面。

## 发一篇长文（重文章）

1. 复制 [`article.md`](./article.md) 到对应年份目录，例如 `docs/2026/my-post.md`。
2. 填 frontmatter：`date` 必填（`YYYY-MM-DD`），`tags` / `description` 可选。
3. 正文第一行写 `# 标题`——它会被**自动**用作文章列表页和 RSS 里的标题，不用再单独配。
4. 保存即可：文章自动出现在 [文章 `/posts/`](/posts/) 和 RSS，**按 `date` 倒序**。阅读时右侧「本页目录」由正文 `##`/`###` 自动生成，无需配置。

## 发一条碎片（随想）

1. 复制 [`note.md`](./note.md) 到 `docs/notes/`，文件名建议 `YYYY-MM-DD-slug.md`。
2. 填 `date` + 一句 `description`，写一两段。
3. 保存即可：自动出现在 [随想 `/notes/`](/notes/) 和 RSS。碎片**不需要**改任何配置。

## 约定速查

| 字段 | 说明 |
| --- | --- |
| `date` | 必填，发布日，决定排序与所属年份 |
| `description` | 摘要，用于随想列表 / RSS / SEO |
| `tags` | 可选，字符串数组 |
| `draft: true` | 草稿，**不进**文章列表与 RSS |
| 标题 | 取正文首个 `# H1`，不要写进 frontmatter |

## 本地预览与构建

```bash
pnpm docs:dev      # 本地预览
pnpm docs:build    # 构建；同时在 dist/feed.xml 生成 RSS
```
