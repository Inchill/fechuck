---
date: 2026-10-27
tags: [nginx, 随想]
description: 上传稍大的文件就 500，请求没到服务。原因是 nginx 默认先把请求体缓存到磁盘，临时目录写不进去就直接失败；proxy_request_buffering off 能绕过去，但不是根治。
---

# nginx 配置之 proxy_request_buffering

我们内部维护了一个 skill 平台，所有 skill 的上传、存储和管理都在这里。前阵子发现一个奇怪的现象：上传小文件一切正常，文件稍微大一点，就直接返回 500。

看服务日志，什么都没有，说明请求根本没有到达服务。问题出在 nginx 这一层。

## 为什么文件大一点就挂

nginx 做反向代理时，默认会先把整个请求体收下来，再转发给后端。这个行为由 `proxy_request_buffering` 控制，默认是 `on`。

收请求体时，nginx 先放在内存里，大小由 `client_body_buffer_size` 决定，默认只有 8k 或 16k（和平台有关）。超过这个大小，nginx 会把请求体写到磁盘上的临时文件，目录由 `client_body_temp_path` 指定。

所以小文件走内存，没问题；大一点的文件要落盘。只要临时目录写不进去，比如磁盘满了、inode 用完了、目录权限不对，nginx 就会直接报 500。这时候请求还没转发，后端当然什么都看不到。error log 里一般能看到类似 `pwrite() failed (28: No space left on device)` 这样的报错。

这也解释了「小文件正常，大文件失败」这个看起来很玄学的现象。

## 先让请求过去

我的第一反应是磁盘满了，就让运维去排查。同时，在上传接口上加了一行配置：

```nginx
location /api/skill/upload {
    proxy_request_buffering off;
    proxy_http_version 1.1;
    proxy_pass http://skill_backend;
}
```

关掉之后，nginx 不再先把请求体存下来，而是边收边转发给后端。请求体不再落盘，上传也就正常了。（如果客户端用 chunked 方式上传，需要配合 `proxy_http_version 1.1`。）

## 这不是根治

需要说清楚的是，`proxy_request_buffering off` 只是绕开了磁盘，并没有解决磁盘的问题。真正的问题还是要靠运维去查：磁盘为什么满了，是日志没轮转，还是临时文件残留。

而且关掉缓冲也有代价：

- **后端连接占用更久。** 开启缓冲时，nginx 替后端承接慢客户端，收完再一次性发过去。关掉之后，客户端传多慢，后端连接就要等多久。
- **无法自动重试。** 请求体已经开始发给某个上游后，`proxy_next_upstream` 就没法把它重发到另一台机器。
- **大小限制仍然生效。** `client_max_body_size` 照样起作用，超过会返回 413，这和本文的 500 是两回事。

所以我的建议是，只在大文件上传这类接口上关掉缓冲，其他接口保持默认。
