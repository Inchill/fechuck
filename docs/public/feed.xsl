<?xml version="1.0" encoding="UTF-8"?>
<!-- RSS 的浏览器展示样式：直接打开 /feed.xml 时渲染成订阅说明页；RSS 阅读器不受影响 -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/rss/channel">
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>订阅 · <xsl:value-of select="title"/></title>
        <link rel="icon" type="image/svg+xml" href="/logo.svg"/>
        <style>
          :root {
            --bg: #ffffff; --surface: #f1f5f6; --border: #dce4e8; --text: #101820; --text-2: #55666e; --text-3: #8a9aa2;
            --info: #1f6fb2; --stable: #147a5a; --info-soft: rgba(31,111,178,.08);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0b0f14; --surface: #121920; --border: #26323c; --text: #e7edf1; --text-2: #93a5b1; --text-3: #5d6e79;
              --info: #6cb6f5; --stable: #3ddc9a; --info-soft: rgba(108,182,245,.12);
            }
          }
          * { box-sizing: border-box; }
          body { margin: 0; background: var(--bg); color: var(--text);
            font: 16px/1.75 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; }
          .wrap { max-width: 720px; margin: 0 auto; padding: 56px 24px 80px; }
          .brand { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; font-size: 15px; }
          .brand img { width: 28px; height: 28px; }
          .hero { margin: 40px 0 36px; padding: 28px; border-radius: 20px; border: 1px solid var(--border);
            background: radial-gradient(120% 100% at 100% 0%, var(--info-soft), transparent 60%), var(--surface); }
          .tag { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--stable); }
          .tag i { width: 7px; height: 7px; border-radius: 50%; background: var(--stable); }
          h1 { margin: 10px 0 8px; font-size: 28px; letter-spacing: -.02em; line-height: 1.3; }
          .hero p { margin: 0; color: var(--text-2); font-size: 15px; }
          .url { display: flex; gap: 8px; margin-top: 18px; }
          .url code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg);
            font: 13.5px/1.5 "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace; color: var(--text); }
          .url button { flex: none; padding: 0 16px; border: 0; border-radius: 10px; cursor: pointer;
            background: var(--text); color: var(--bg); font: inherit; font-size: 14px; font-weight: 500; }
          .readers { margin-top: 12px; font-size: 13px; color: var(--text-3); }
          h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; letter-spacing: .06em; color: var(--text-3); }
          ol { list-style: none; margin: 0; padding: 0; }
          li { padding: 18px 0; border-top: 1px solid var(--border); }
          li a { color: var(--text); text-decoration: none; font-size: 17px; font-weight: 600; }
          li a:hover { color: var(--info); }
          li time { display: block; margin-top: 2px; font: 12.5px "JetBrains Mono", ui-monospace, Menlo, monospace; color: var(--text-3); }
          li p { margin: 6px 0 0; font-size: 14.5px; color: var(--text-2); }
          footer { margin-top: 40px; font-size: 13px; color: var(--text-3); }
          footer a { color: var(--text-2); }
        </style>
      </head>
      <body>
        <div class="wrap">
          <a class="brand" href="/"><img src="/logo.svg" alt=""/><xsl:value-of select="title"/></a>

          <section class="hero">
            <span class="tag"><i></i>RSS 订阅</span>
            <h1>在阅读器里订阅这个博客</h1>
            <p>这是本站的 RSS 地址。把它添加到 RSS 阅读器，新文章和随想发布后会自动推送给你，不用专门回来看。</p>
            <div class="url">
              <code id="feed-url"><xsl:value-of select="atom:link[@rel='self']/@href"/></code>
              <button type="button" id="copy-btn">复制地址</button>
            </div>
            <div class="readers">常见阅读器：Feedly、Inoreader、NetNewsWire、Reeder、Follow</div>
          </section>

          <h2>最近更新 · <xsl:value-of select="count(item)"/> 篇</h2>
          <ol>
            <xsl:for-each select="item">
              <li>
                <a href="{link}"><xsl:value-of select="title"/></a>
                <!-- pubDate 形如 Mon, 07 Sep 2026 00:00:00 GMT，只取日期部分 -->
                <time><xsl:value-of select="substring(pubDate, 6, 11)"/></time>
                <xsl:if test="string-length(normalize-space(description)) &gt; 0">
                  <p><xsl:value-of select="description"/></p>
                </xsl:if>
              </li>
            </xsl:for-each>
          </ol>

          <footer>回到 <a href="/">休言的博客</a></footer>
        </div>
        <!-- 注意：XSL 里属性值中的 { } 会被当成表达式，所以脚本不能写在 onclick 属性里 -->
        <script>
          document.getElementById('copy-btn').addEventListener('click', function () {
            var btn = this;
            var url = document.getElementById('feed-url').textContent.trim();
            navigator.clipboard.writeText(url).then(function () {
              btn.textContent = '已复制';
              setTimeout(function () { btn.textContent = '复制地址'; }, 1500);
            });
          });
        </script>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
