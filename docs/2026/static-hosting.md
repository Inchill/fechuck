---
date: 2026-10-19
outline: deep
description: 博客在 GitHub Pages，新项目因为是私有仓库放到了 Cloudflare Pages，定时任务又用上了 Workers。记录这几个平台的免费额度、限制和踩过的坑。
---

# GitHub Pages、Cloudflare Pages 和 Workers 怎么选

这个博客一直部署在 GitHub Pages 上，推代码就更新，没操过什么心。

最近做了个新项目，仓库是私有的，而 GitHub Pages 免费账号只支持公开仓库，于是把它放到了 Cloudflare Pages。项目里有个每天要跑的任务，一开始用 GitHub Actions 自带的 `schedule`，结果漏跑了一次，后来改成用 Cloudflare Workers 的定时器去触发。域名解析一直在阿里云，两个平台都要接过去。

前后折腾了两天，把这几样东西的区别和坑记一下。整体关系大概是这样：

![几个平台之间的关系](/2026/static-hosting/architecture.svg){data-zoomable}

## GitHub Pages

适合公开仓库的静态站，比如博客、文档、项目主页。代码和站点在一个地方，不用再注册别的平台。

几个限制：

- 免费账号只能用公开仓库，私有仓库要 GitHub Pro、Team 等付费方案。
- 发布后的站点最大 1 GB，带宽每月 100 GB，每小时大约 10 次构建，单次部署超过 10 分钟会超时。都是软限制，个人博客基本碰不到。用自定义 Actions 工作流发布的话，不受每小时构建次数的限制。
- 每个账号只有一个 `用户名.github.io` 用户站点，其他仓库都是 `用户名.github.io/仓库名` 这种带路径的项目站点。绑上自定义域名就没有路径的问题了。

## Cloudflare Pages

用法和 GitHub Pages 差不多：关联 GitHub 仓库，推代码自动构建、部署。区别主要在这几点：

- 私有仓库也能免费用。
- 每个分支、每个 PR 都会生成一个预览地址，合并前能先看效果。
- 免费版每月 500 次构建，同时只能跑 1 个，单次构建 20 分钟超时；站点最多 2 万个文件，单文件不超过 25 MiB。静态请求和带宽不限。

要注意的是，500 次构建是整个账号共享的，不是每个项目 500 次。项目多、推得勤的话要留意一下。

另外，Cloudflare 现在推荐新项目直接用 Workers 托管静态资源，而不是 Pages。Pages 不会下线，已有项目照常用，只是新功能主要加在 Workers 上。迁移也不复杂：把 `wrangler pages deploy` 换成 `wrangler deploy`，配置里加一个 `assets` 目录就行。

## Workers：替 GitHub Actions 定时

Workers 本来是在 Cloudflare 边缘节点上跑代码的，能写接口、做重定向。我这次只用了它的定时功能（Cron Trigger）。

起因是 GitHub Actions 的 `schedule` 不准。GitHub 的文档里写得很清楚：Actions 负载高的时候定时任务会延迟，整点前后是高峰；负载再高一点，排队中的任务可能直接被丢掉。我就碰上了一次漏跑。

改法是让 Worker 按时调用 GitHub API，手动触发工作流：

1. 工作流里加上 `workflow_dispatch` 触发器；
2. 写一个 Worker，配置 Cron Trigger；
3. Worker 到点调用 `POST /repos/{owner}/{repo}/actions/workflows/{workflow}/dispatches`。

定时交给 Cloudflare，任务本身还是在 GitHub Actions 里跑，原来的工作流不用改。

![用 Worker Cron 触发 GitHub Actions](/2026/static-hosting/cron-dispatch.svg){data-zoomable}

### 准备 GitHub Token

调这个接口需要一个有权限的 Token。

在 GitHub 的 Settings → Developer settings → Personal access tokens → Fine-grained tokens 里新建：

- Repository access 只选要触发的那个仓库；
- 权限只开 Actions 的 Read and write，触发工作流需要写权限；
- 设一个过期时间，记下来，过期了定时任务会默默失败。

不建议用 classic token，它得勾 `repo` 或 `workflow` 这种范围很大的权限，泄露了麻烦。

### 把 Token 存成 Secret

```bash
npx wrangler secret put GITHUB_TOKEN
```

回车后粘贴 Token。也可以在 Cloudflare 控制台的 Worker → Settings → Variables and Secrets 里加，类型选 Secret。代码里用 `env.GITHUB_TOKEN` 读取，Token 不会出现在代码和仓库里。

### Worker 代码

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
        "User-Agent": "cron-dispatcher", // GitHub API 要求必须带，不带会 403
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (res.status !== 204) {
      throw new Error(`dispatch failed: ${res.status} ${await res.text()}`);
    }
  },
};
```

`wrangler.jsonc`：

```jsonc
{
  "name": "cron-dispatcher",
  "main": "src/index.js",
  "compatibility_date": "2026-10-19",
  "triggers": { "crons": ["0 1 * * 1-5"] }, // UTC 01:00，也就是北京时间工作日 09:00
  "vars": { "OWNER": "你的用户名", "REPO": "仓库名", "WORKFLOW": "daily.yml" }
}
```

调用成功时 GitHub 返回 `204 No Content`，过几秒 Actions 页面就会出现一条 `workflow_dispatch` 触发的运行。本地调试可以 `npx wrangler dev --test-scheduled`，然后访问 `/__scheduled` 手动触发一次。

### 踩过的坑

- Cron Trigger 按 UTC 计时，北京时间要减 8 小时。
- 免费版一个账号总共只有 5 个 Cron Trigger，不是每个 Worker 5 个。
- 免费版每次执行只有 10 ms CPU 时间。等网络响应不算 CPU 时间，发个请求够用，但别在 Worker 里做计算。
- 免费版每天 10 万次请求、单次执行最多 50 个子请求，这个场景用不完。
- 返回 403：先看有没有带 `User-Agent`，再看 Token 的权限和仓库范围。返回 404：多半是用户名、仓库名或工作流文件名写错了，或者 Token 没授权这个仓库。
- 返回 422：工作流里没有声明 `on: workflow_dispatch`。

## 域名解析

域名在阿里云，没有把 nameserver 迁到 Cloudflare，子域名两边都能接：

- **接 Cloudflare Pages**：先在 Pages 项目里添加自定义域名，再去阿里云加一条 CNAME，指向 `项目名.pages.dev`。验证通过后证书会自动签发。
- **接 GitHub Pages**：CNAME 指向 `用户名.github.io`，然后在仓库 Settings → Pages 里填上域名，勾选 Enforce HTTPS。

根域名不一样。GitHub Pages 用 A 记录指向它给的几个 IP 就行；Cloudflare Pages 的根域名则要求域名的 DNS 托管在 Cloudflare。所以根域名想放 Cloudflare，就得迁 nameserver。

Worker 只做定时任务的话不需要绑域名，默认的 `workers.dev` 地址都用不上。

改完解析如果没生效，先用 `dig 子域名 CNAME` 确认记录本身对不对，再去查平台那边。

## 对比

| | GitHub Pages | Cloudflare Pages | Cloudflare Workers |
|---|---|---|---|
| 主要用途 | 静态站 | 静态站、轻量全栈 | 边缘代码、静态资源 |
| 免费用私有仓库 | 不支持 | 支持 | 支持 |
| 构建限制 | 约 10 次/小时（软限制） | 500 次/月，账号共享 | 不需要构建 |
| 带宽 | 100 GB/月（软限制） | 不限 | 静态资源请求不限 |
| 预览部署 | 没有 | 每个分支自动生成 | 有版本预览 |
| 定时任务 | Actions schedule，不保证准时 | 没有 | Cron Trigger，免费版账号共 5 个 |
| 根域名 | A 记录即可 | DNS 需托管在 Cloudflare | 自定义域名需 DNS 在 Cloudflare |

## 怎么选

- 公开仓库的静态站，用 GitHub Pages 就够了，少一个平台要管。
- 私有仓库，或者想要分支预览，用 Cloudflare Pages；新建的项目可以直接上 Workers 静态资源。
- 要按时执行的任务，不要只靠 Actions 的 `schedule`，用 Worker 定时触发更稳。
- DNS 放阿里云也能用，但要用根域名接 Cloudflare，或者给 Worker 绑自定义域名，就得把解析迁到 Cloudflare。

这些都在免费额度内，个人项目够用。
