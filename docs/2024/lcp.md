# 前端性能监控指标之 LCP

## 什么是 LCP？

LCP 是 Largest Contentful Paint 的缩写，即最大内容绘制。当页面加载的时候，LCP 会记录可视区域中最大的图片、文字区块或者视频等元素的显示时间。

LCP 的得分标准如下：

![good-values](/2024/performance/good-lcp-values.svg){data-zoomable}

这个我觉得可以把它当做建议值，不一定非要当做硬性指标。比如说有的项目受限于业务非常复杂，其前置依赖导致加载链路长的话，前端项目本身的 LCP 值可能再怎么优化也无法达到这个标准，这个就超出前端所能优化的范畴了，需要其他团队一块优化整个链路。

## LCP 算法

LCP 的算法规则是，它会一直追踪可视区域内的元素。一旦找到一个新的最大内容区，就会创建一个新的 entry 条目。即使这个最大内容区块后面又被移除了，LCP 也不会更新。只有出现了一个更大的内容区块时，才会创建一个新的 entry 条目来记录更新后的 LCP。

当发生滚动或输入事件时，该算法就会终止，因为这些事件可能会将新内容引入页面，一直追踪计算最大的 LCP 没有意义，可以理解为只计算首屏的 LCP。

例如，在包含文本和主推图片的页面上，浏览器可能最初只会渲染文本，此时浏览器会分派一个 largest-contentful-paint 条目，其 element 属性可能会引用 `<p>` 或 `<h1>`。稍后，当主推图片完成加载后，系统会分派第二个 largest-contentful-paint 条目，并且其 element 属性将引用 `<img>`。

## LCP 计算的元素

- `<img>` 元素
- `<svg>` 元素
- `<video>` 元素
- 使用 `url()` 函数加载背景图片的元素
- 包含文本节点或其它包含文本元素的块级元素

LCP 的计算还会尽量排除用户可能认为“无内容”的元素，对于基于 Chromium 的浏览器，会忽略以下元素：

- 透明度为 0 的元素
- 覆盖了整个视口的元素，这种会可能被当作背景元素而不是内容元素
- 图片占位符或者其它低熵图像，这些也不能真实反映页面内容

## 如何采集

LCP 的采集是通过 PerformanceObserver API 来实现的。

```js
const observer = new PerformanceObserver((list) => {
  let perfEntries = list.getEntries();
  let lastEntry = perfEntries[perfEntries.length - 1];
});
observer.observe({entryTypes: ['largest-contentful-paint']});
```

但是 `largest-contentful-paint` 性能条目有兼容性问题，下面是兼容性情况，主要是 Safari 不支持。

![compatibility](/2024/performance/compatibility.png){data-zoomable}

所以在 Safari 浏览器中，需要另外的方式采集 LCP。根据前面提到的 LCP 算法，我们可以按照这样的思路采集。

1. 使用 MutationObserver 自动检测 DOM 的新增元素。
2. 为新增的可视元素绑定加载完成或显示事件，例如：
    - 图片的 onload 事件；
    - 视频的 loadeddata 事件；
    - 元素进入视口的 IntersectionObserver。
3. 记录每个事件的时间戳，动态维护 LCP 候选项。

实现代码如下：

```js
const lcpCandidates = [];
const now = () => performance.now();
let mutationObserver = null;
let intersectionObserver = null;

// 追加新的条目
const updateLCP = (element, time) => {
    lcpCandidates.push({ element, time });
};

// 1. 监听 DOM 变化
const observeDOMChanges = () => {
    mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    monitorElement(node);
                }
            });
        });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
};

// 2. 监听元素可见性和加载完成事件
const monitorElement = (element) => {
    // 元素可见性
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
        if (entry.isIntersecting) {
            const visibilityTime = now();
            updateLCP(entry.target, visibilityTime);
            io.unobserve(entry.target);
        }
        });
    });
    intersectionObserver.observe(element);

    // 监听图片
    if (element.tagName === 'IMG' && !element.complete) {
        element.addEventListener('load', () => {
            const loadTime = now();
            updateLCP(element, loadTime);
        });
    }

    // 监听视频
    if (element.tagName === 'VIDEO') {
        element.addEventListener('loadeddata', () => {
            const videoLoadTime = now();
            updateLCP(element, videoLoadTime);
        });
    }
};

// 3. 初始化监听页面中所有图片、视频和文本
document.querySelectorAll('img, video, h1, p').forEach(monitorElement);

// 4. 监听 DOM 变化
observeDOMChanges();

// 5. 计算最终的 LCP
window.addEventListener('load', () => {
    setTimeout(() => {
        const finalLCP = lcpCandidates.reduce((max, candidate) =>
            candidate.time > max.time ? candidate : max, { time: 0 });
        console.log('Final LCP Element:', finalLCP.element);
        console.log('LCP Time:', finalLCP.time, 'ms');
        mutationObserver.disconnect();
        intersectionObserver.disconnect();
    }, 1000);
});
```

在第三步中，默认监听的元素是 img、video、h1 和 p，可以根据实际业务需求调整，比如通过提前标记元素的方式，在页面渲染之前就监听这些元素。

## 不准确的场景

LCP 并不是一定准确的，比如说下面的情况：

- 当检测到滚动或者用户输入时，算法就停止采集了。如果用户输入发生在主要内容显示之前，算法此时采集的并不是最大的 LCP 值。在这种情况下，LCP 的值比实际值要小。
- 考虑到图像轮播，即使内容被删除，原来的内容仍然被视为最大的，后面不会创建新的 entry 条目。这种情况下，当你的页面使用了大的占位符，因为采集的最大 LCP 值就是占位符，等到后面的元素加载完成时，LCP 的值会比实际值要大。
- 出于安全考虑，对于缺少 `Timing-Allow-Origin` 标头的跨源图片，系统不会公开图片的呈现时间戳。这个可能会导致 LCP 时间比 FCP 还要早，所以对于图片尽量添加 `Timing-Allow-Origin` 响应头。

![timing-allow-origin](/2024/performance/timing-allow-origin.png){data-zoomable}

## LCP 包含的信息

通过 PerformanceObserver API 获取到的 largest-contentful-paint 条目包含以下信息：

```js
interface LargestContentfulPaint : PerformanceEntry {
    readonly attribute DOMHighResTimeStamp renderTime;
    readonly attribute DOMHighResTimeStamp loadTime;
    readonly attribute unsigned long size;
    readonly attribute DOMString id;
    readonly attribute DOMString url;
    readonly attribute Element? element;
    [Default] object toJSON();
};
```

## 参考链接

- [Largest Contentful Paint(web dev)](https://web.dev/articles/lcp?hl=zh-cn)
- [Largest Contentful Paint](https://w3c.github.io/largest-contentful-paint/)
