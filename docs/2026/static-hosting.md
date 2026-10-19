---
date: 2026-10-19
outline: deep
description: 这两天部署用到了 GitHub Pages、Cloudflare Pages、Workers 和 DNS 解析，记录各平台的经验、免费额度、踩过的坑，以及它们之间的对比。
---

# GitHub Pages、Cloudflare Pages 与 Workers：一次部署下来的经验与对比

这两天把几个小项目都部署上线，一口气用到了 GitHub Pages、Cloudflare Pages、Cloudflare Workers，外加域名解析。每个单独看都不难，但放在一起用，才真正搞清楚它们各自擅长什么、边界在哪。记录一下。

## 一句话定位

- **GitHub Pages**：代码在哪，站点就在哪。适合公开仓库的静态站、文档、博客，零配置。
- **Cloudflare Pages**：更强的静态托管，私有仓库、预览部署、自定义域名都更灵活。
- **Cloudflare Workers**：跑在边缘的小段代码。能做 API、重定向、定时任务，现在也能直接托管静态资源。
- **DNS**：把上面这些串到自己域名上的那根线。

![托管平台怎么串起来](/2026/static-hosting/architecture.svg){data-zoomable}

## GitHub Pages：最省心，但限制也最"GitHub"

优点很直接：推代码就上线，不用注册任何其他平台。

需要注意的几点：

- **私有仓库要付费**。免费账户只能用公开仓库开 Pages，GitHub Pro、Team 等付费方案才支持私有仓库。项目不想开源的话，这一条基本就把它排除了。
- **用量是软限制**：发布后的站点不超过 1 GB，每月带宽软上限 100 GB，每小时约 10 次构建（用自定义 Actions 工作流发布则不受这条限制），单次部署超过 10 分钟会超时。
- 每个账号只能有一个 `用户名.github.io` 的用户站点，其余都是项目站点（`用户名.github.io/仓库名`），用自定义域名可以绕开路径问题。

## Cloudflare Pages：私有仓库友好的升级版

从 GitHub 拉代码、自动构建、全球 CDN 分发，体验和 GitHub Pages 类似，但：

- **私有仓库免费可用**，这是我选它的主要原因。
- 每个分支、每个 PR 都有独立的预览地址，改东西前先看效果很方便。
- 免费额度：每月 500 次构建、同时只能跑 1 个构建，单次构建 20 分钟超时；站点最多 2 万个文件，单文件不超过 25 MiB。静态请求和带宽不限。
- 注意 500 次构建是**整个账号共享**的，不是每个项目各 500 次，项目多、推送频繁时要留意。

一个值得知道的趋势：Cloudflare 现在推荐新项目直接用 **Workers + 静态资源** 而不是 Pages。Pages 不会下线，已有项目照常跑，但新功能主要往 Workers 上加。迁移基本就是把 `wrangler pages deploy` 换成 `wrangler deploy`，再在配置里加一个 `assets` 目录。下一个新项目我会直接试试 Workers。

## Cloudflare Workers：拿来当"靠谱的定时器"

这次 Workers 对我最大的价值不是写 API，而是**定时任务**。

起因是 GitHub Actions 的 `schedule`。GitHub 官方文档就写明了：定时事件在高负载时会延迟，整点前后是高峰，负载足够高时排队中的任务甚至会被直接丢弃。我就遇到了定时任务漏跑一次的情况。

解决办法：

1. 在 GitHub Actions 工作流里保留 `workflow_dispatch` 触发器；
2. 写一个 Worker，用 Cron Trigger 定时执行；
3. Worker 里用 GitHub Token 调 `POST /repos/{owner}/{repo}/actions/workflows/{workflow}/dispatches` 手动触发工作流。

这样调度交给 Cloudflare，真正干活的还是 GitHub Actions，两边各做擅长的事。

![用 Worker Cron 触发 GitHub Actions](/2026/static-hosting/cron-dispatch.svg){data-zoomable}

### 给 Worker 配 GitHub Token

Worker 要调 GitHub API，就得带一个有权限的 Token。

**1. 创建 Token**

在 GitHub 的 Settings → Developer settings → Personal access tokens → **Fine-grained tokens** 里新建：

- Repository access 只勾选需要触发的那个仓库，不要给全部仓库；
- 权限只开 **Actions：Read and write**（触发工作流需要写权限），其余保持默认；
- 设一个过期时间，并记下来，到期前要换新的，不然定时任务会悄悄失败。

比起老式的 classic token（要勾 `repo` 或 `workflow` 这种大权限），fine-grained token 的权限小得多，泄露了影响也有限。

**2. 存成 Worker 的 Secret**

```bash
npx wrangler secret put GITHUB_TOKEN
```

回车后粘贴 Token。也可以在 Cloudflare 控制台的 Worker → Settings → Variables and Secrets 里添加，类型选 Secret。Secret 加密存储，部署后在代码里通过 `env.GITHUB_TOKEN` 读取，不会出现在代码和仓库里。

**3. Worker 代码**

```js
export default {
  async scheduled(event, env, ctx) {
    const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "cron-dispatcher", // GitHub API 必须带，不带会 403
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (res.status !== 204) {
      throw new Error(`dispatch failed: ${res.status} ${await res.text()}`);
    }
  },
};
```

`wrangler.jsonc` 里配置定时和普通变量：

```jsonc
{
  "name": "cron-dispatcher",
  "main": "src/index.js",
  "compatibility_date": "2026-10-19",
  "triggers": { "crons": ["0 1 * * 1-5"] }, // UTC 01:00 = 北京时间 09:00，工作日
  "vars": { "OWNER": "你的用户名", "REPO": "仓库名", "WORKFLOW": "daily.yml" }
}
```

成功时 GitHub 返回 `204 No Content`，几秒后就能在 Actions 页面看到一条 `workflow_dispatch` 触发的运行。本地调试可以用 `npx wrangler dev --test-scheduled`，再访问 `/__scheduled` 手动触发一次。

几个坑：

- **Cron Trigger 只认 UTC**，北京时间要减 8 小时。
- 免费版整个账号只有 **5 个** Cron Trigger，不是每个 Worker 5 个。
- 免费版每次执行只有 10 ms CPU 时间。发一个 HTTP 请求等待响应不算 CPU 时间，触发工作流绰绰有余；但别在 Worker 里做重计算。
- 免费版每天 10 万次请求、单次执行最多 50 个子请求，个人项目基本碰不到。
- 遇到 403，先检查有没有带 `User-Agent` 请求头，再检查 Token 权限和所选仓库；遇到 404，多半是 owner、仓库名或工作流文件名写错了，或者 Token 没有访问这个仓库的权限。
- 工作流里必须声明 `on: workflow_dispatch`，否则接口会返回 422。

## DNS：域名在阿里云，站点在 Cloudflare 也没问题

我的域名解析在阿里云，并没有把 nameserver 迁到 Cloudflare。实际体验：

- **子域名接 Cloudflare Pages**：先在 Pages 项目里添加自定义域名，再去阿里云加一条 CNAME，指向 `项目名.pages.dev`，等验证通过、证书自动签发就好了。
- **子域名接 GitHub Pages**：CNAME 指向 `用户名.github.io`，并在仓库 Settings → Pages 里填上域名、勾选 Enforce HTTPS。
- **根域名（apex）**：GitHub Pages 用 A 记录指向它的几个 IP 即可；而 Cloudflare Pages 的根域名需要把域名的 DNS 托管到 Cloudflare。所以如果根域名想放 Cloudflare，就得考虑迁 nameserver。
- Worker 的定时任务完全不需要域名，用默认的 `workers.dev` 甚至不用暴露任何地址。
- 改完解析别急，生效需要时间；先用 `dig 子域名 CNAME` 确认记录对了，再排查平台侧的问题。

## 横向对比

| | GitHub Pages | Cloudflare Pages | Cloudflare Workers |
|---|---|---|---|
| 定位 | 静态站托管 | 静态站 / 轻全栈托管 | 边缘代码 + 静态资源 |
| 私有仓库（免费） | ❌ | ✅ | ✅ |
| 构建限制 | 约 10 次/小时（软） | 500 次/月，账号共享 | 无构建概念，按请求计 |
| 带宽 | 100 GB/月（软） | 静态请求不限 | 静态资源请求不限 |
| 预览部署 | 需自己搭 | 每个分支自动 | 支持版本预览 |
| 定时任务 | Actions schedule，不保证准时 | ❌ | Cron Trigger，账号共 5 个（免费） |
| 根域名接入 | A 记录即可 | 需 DNS 托管到 Cloudflare | 自定义域名需 DNS 在 Cloudflare |
| 上手成本 | 最低 | 低 | 中，需要写点代码 |

## 我的选择

- 公开的、纯展示的静态站：**GitHub Pages**，省一个平台。
- 私有仓库、想要预览部署：**Cloudflare Pages**（新项目考虑直接用 Workers 静态资源）。
- 需要准时跑的定时任务：**Workers Cron 触发 GitHub Actions**，别把关键任务押在 Actions 自带的 schedule 上。
- DNS 放哪都行，但想用 Cloudflare 的全套能力（根域名、Workers 自定义域名），早晚得把解析迁过去。

都是免费额度，对个人项目来说完全够用。真正花时间的不是部署本身，而是弄清楚每个平台的边界。
