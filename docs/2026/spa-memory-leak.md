---
outline: deep
---

# 你的 SPA 正在漏内存，用 Soak Test 把它揪出来

单页应用最大的特点是「永不重载」，而这恰好也是它最大的隐患：任何一个被遗忘的事件监听器、定时器或 DOM 引用，都会随着用户停留时间不断累积，直到标签页变卡甚至崩溃。

这类问题几乎不会在开发阶段暴露出来。我们本地调试时页面开着几分钟就刷新了，而真实用户可能开着同一个后台页面工作一整天。**Soak Test（浸泡测试）** 的思路很朴素：把同一段「回到起点」的操作重复运行上百次，观测内存指标是否只增不减 —— 泄漏会自己现形。

> [!NOTE] 两个值得记住的数字
> 对 500 个热门 React / Vue / Angular 项目的分析发现，**86%** 的项目存在「设置了监听器、定时器或订阅，却从未移除」的代码；其中占比最大的单一来源是未清理的 `setTimeout()`，占 **44%**。

## 为什么传统网页不会这样

区别不在代码质量，而在生命周期长度。

传统多页应用每次跳转都会整页重载，浏览器直接丢弃旧页面占用的全部内存。就算代码里真有泄漏，也撑不到被察觉的那一刻 —— 导航本身就是一次「自愈」。

单页应用没有这个机会。页面永不重载，JS 运行时持续存活，每一次未清理的订阅都会叠加到上一次之上。小泄漏之所以变成大问题，只是因为它有了足够长的时间去积累。

<div class="lifecycle-compare">
  <div class="card">
    <div class="card-title">传统多页应用<span class="tag stable">自愈</span></div>
    <div class="timeline">
      <div class="seg stable"></div>
      <div class="seg stable"></div>
      <div class="seg stable"></div>
    </div>
    <div class="axis">时间 →</div>
    <p>每次跳转都会整页重载，浏览器直接丢弃旧页面占用的全部内存，水位被一次次清零。泄漏永远撑不到被察觉的那一刻。</p>
  </div>
  <div class="card">
    <div class="card-title">单页应用<span class="tag leak">持续运行</span></div>
    <div class="timeline">
      <div class="seg warm"></div>
      <div class="seg hot"></div>
      <div class="seg burn"></div>
    </div>
    <div class="axis">时间 →</div>
    <p>页面永不重载，JS 运行时持续存活。每一次未清理的订阅都会叠加到上一次之上，直到标签页变卡甚至崩溃。</p>
  </div>
</div>

## Soak Test：让泄漏自己现形

做法是在**同一个浏览器上下文**中，把同一段「回到起点」的用户操作重复运行上百次：先预热几轮记录基线，再看循环结束时的堆内存、DOM 节点数与监听器数量是否只增不减。这不是什么新发明，Gmail 十年前就已经在预发布测试里这样做了。

<figure>
<figcaption>DOM 节点数 · 200 次循环（含 5 次预热）</figcaption>
<svg viewBox="0 0 720 260" width="100%" role="img" aria-label="DOM 节点数随循环次数变化的折线图：存在泄漏的组件持续上升并越过断言阈值，已修复的组件保持水平">
  <g stroke="var(--vp-c-divider)" stroke-width="1">
    <line x1="56" y1="20" x2="56" y2="206"></line>
    <line x1="56" y1="206" x2="700" y2="206"></line>
    <line x1="56" y1="93" x2="700" y2="93" stroke-dasharray="2 4"></line>
  </g>
  <g font-size="11" fill="var(--vp-c-text-3)">
    <text x="46" y="210" text-anchor="end">基线</text>
    <text x="46" y="154" text-anchor="end">+100</text>
    <text x="46" y="97" text-anchor="end">+250</text>
    <text x="56" y="228" text-anchor="start">warmup</text>
    <text x="270" y="228" text-anchor="middle">循环 50</text>
    <text x="480" y="228" text-anchor="middle">循环 125</text>
    <text x="700" y="228" text-anchor="end">循环 200</text>
  </g>
  <line x1="56" y1="150" x2="700" y2="150" stroke="var(--vp-c-danger-1)" stroke-opacity="0.5" stroke-width="1.4" stroke-dasharray="5 4"></line>
  <text x="700" y="145" text-anchor="end" font-size="10.5" fill="var(--vp-c-danger-1)">断言阈值 baseline+100</text>
  <polyline points="56,206 150,203 250,205 350,204 450,206 550,203 650,205 700,204" fill="none" stroke="var(--vp-c-success-1)" stroke-width="2.5" stroke-linecap="round"></polyline>
  <polyline points="56,206 150,188 250,164 350,140 450,112 550,84 650,55 700,40" fill="none" stroke="var(--vp-c-danger-1)" stroke-width="2.5" stroke-linecap="round"></polyline>
  <circle cx="700" cy="40" r="4" fill="var(--vp-c-danger-1)"></circle>
  <circle cx="700" cy="204" r="4" fill="var(--vp-c-success-1)"></circle>
  <text x="66" y="34" font-size="11.5" fill="var(--vp-c-danger-1)">存在泄漏的组件</text>
  <text x="66" y="52" font-size="11.5" fill="var(--vp-c-success-1)">已修复的组件</text>
</svg>
</figure>

需要注意的是，**堆内存大小不是一个可靠的信号**：它会因为垃圾回收的时机而剧烈波动，一次采样高一点未必意味着泄漏。更稳定的指标是 DOM 节点数和事件监听器数，并且要在强制 GC 之后再采样。

## 四类最常见的泄漏源头

<div class="leak-grid">
  <div class="card">
    <div class="head">
      <span class="icon"><svg viewBox="0 0 24 24"><path d="M12 3a5 5 0 0 0-5 5v4l-2 4h14l-2-4V8a5 5 0 0 0-5-5z"/><path d="M9.5 20a2.5 2.5 0 0 0 5 0"/></svg></span>
      <div class="title">事件监听器</div>
    </div>
    <p>DOM 元素被移除后，绑定其上的 <code>addEventListener</code> 依然存活 —— 组件卸载时忘记调用 <code>removeEventListener()</code>。</p>
  </div>
  <div class="card">
    <div class="head">
      <span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 3h6"/></svg></span>
      <div class="title">定时器</div>
      <span class="pct">44%</span>
    </div>
    <p>未清理的 <code>setTimeout()</code> / <code>setInterval()</code>，是本次分析中占比最大的单一泄漏来源。</p>
  </div>
  <div class="card">
    <div class="head">
      <span class="icon"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><path d="M11 7.5h6M7.5 11v6"/></svg></span>
      <div class="title">游离 DOM 引用</div>
    </div>
    <p>已从页面移除的节点仍被 JS 变量、闭包或全局对象持有 —— 在 DevTools 中表现为 <code>Detached</code> 节点。</p>
  </div>
  <div class="card">
    <div class="head">
      <span class="icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12v6c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-6"/></svg></span>
      <div class="title">无限增长的缓存</div>
    </div>
    <p>没有上限的内存缓存，以及路由懒加载后未释放的残留模块代码。</p>
  </div>
</div>

这四类里，前两类靠 code review 就能发现一部分，后两类几乎只能靠观测。

## Soak Test 是怎么跑起来的

1. **预热** —— 先执行 5 次完整流程，避开首次加载、字体加载、懒加载 chunk 带来的噪音，然后记录基线指标。
2. **循环 200 次** —— 在单一浏览器上下文中反复执行同一段往返操作，例如开关抽屉。
3. **两次 GC 后采样** —— 通过 CDP 的 `HeapProfiler.collectGarbage` 强制回收两次，再读取 Performance 指标。两次是为了让第一次回收释放出的对象所持有的引用也能被回收。
4. **断言** —— 监听器数应 ≤ 基线；节点数增长应小于一个**固定阈值**（如 +100），而不是按百分比放宽。

> [!TIP] 为什么阈值要用固定值而不是百分比
> 百分比阈值会随基线一起变大：一个初始节点数很多的页面，允许的增长空间也更大，反而更容易漏掉真实泄漏。固定阈值对所有页面一视同仁。

## 断言长什么样

```ts
// dashboard.spec.ts
test('the dashboard drawer does not leak', async ({ page }) => {
  await page.goto('/dashboard');

  // 200 次循环，其中前 5 次为预热
  const { baseline, after } = await soak(page, () =>
    openAndCloseDrawer(page)
  );

  // 监听器不应比基线更多
  expect(after.listeners).toBeLessThanOrEqual(baseline.listeners);

  // 节点增长用固定阈值，而不是百分比
  expect(after.nodes).toBeLessThan(baseline.nodes + 100);
});
```

采样部分需要走 CDP，大致是这个形状：

```ts
const cdp = await page.context().newCDPSession(page);

async function sample() {
  // 连续两次强制 GC，再读取指标
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  return { nodes: get('Nodes'), listeners: get('JSEventListeners') };
}
```

## 让 200 次循环等于真实的 100 分钟

这里有个容易被忽略的陷阱：200 次循环两分钟内就能跑完，但一个 30 秒轮询一次的定时器，在这两分钟里只会触发 4 次 —— 远低于用户真实使用 1 小时里的 120 次。也就是说，**跑得快本身会掩盖泄漏**。

解决办法是把时间「拨快」：

- **虚拟时钟**：`page.clock.install()` 接管时间，每次循环后用 `runFor(18_000)` 手动推进 18 秒，让轮询定时器如期触发。200 次 × 18 秒 ≈ 覆盖真实使用 **约 100 分钟**。
- **网络模拟**：用 `page.route()` + `route.fulfill()` 返回与真实接口体量相当的响应，避免真实网络延迟拖慢循环，同时保留泄漏真正的触发条件（响应体大小、字段结构都要接近真实，否则测不出与数据量相关的泄漏）。

## 什么值得测，什么不用测

判断标准很简单：这段操作结束后，状态**是否应当**回到原点。应当回到原点却没回去，就是泄漏；本来就该留下东西，那测了也只是白报警。

<div class="fit-grid">
  <div class="card yes">
    <div class="title">适合 Soak Test 的流程</div>
    <ul>
      <li>打开又关闭一个抽屉 / 弹窗</li>
      <li>设置又清除表格筛选条件</li>
      <li>进入某个路由再退回上一级</li>
      <li>任何应当「回到初始状态」的往返操作</li>
    </ul>
  </div>
  <div class="card no">
    <div class="title">不适合的场景</div>
    <ul>
      <li>无限滚动列表 —— 内存本就该增长</li>
      <li>聊天界面 —— 消息本应被保留</li>
      <li>AI 流式响应 —— <code>route.fulfill</code> 无法模拟</li>
    </ul>
  </div>
</div>

## 落地建议

Soak Test 单次耗时以分钟计，放进每个 PR 的流水线并不划算，**更合适的位置是夜间定时任务**：跑核心页面的几条往返流程，发现指标越线再回溯到具体提交。

工具方面可以参考 [playwright-soak-test](https://github.com/denodell/playwright-soak-test)。

---

本文整理自 Den Odell 的 [Your SPA Is Leaking Memory. Soak Test It](https://denodell.com/blog)（2026-07-29），并补充了部分个人理解。
