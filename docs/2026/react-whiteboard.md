---
date: 2026-10-09
outline: deep
description: 把两年前写的涂鸦画板重写成一个 23 kB、零依赖的 React 白板组件，聊聊从位图换成矢量图形列表的思路，以及压感笔迹、局部橡皮擦是怎么实现的。
---

# 23 kB 的 React 白板组件：压感笔迹和局部橡皮擦是怎么做出来的

> 一个零依赖、MIT 协议、可以直接塞进任何 React 项目的白板 / 涂鸦板组件。本文讲讲它是怎么从一个“能画线的 canvas”重写成矢量白板的，以及压感笔迹、局部擦除这两个功能背后的实现。

![react-whiteboard 官网](/2026/react-whiteboard/homepage.png){data-zoomable}

- 在线体验：<https://inchill.github.io/react-whiteboard/>（首页那块白板就是组件本身，可以直接画）
- 全屏白板：<https://inchill.github.io/react-whiteboard/board/>
- GitHub：<https://github.com/Inchill/react-whiteboard>
- npm：`pnpm add @inchill/react-whiteboard`

## 为什么要做

两年前我想做一个涂鸦画板，用的是最常见的做法：一个 `<canvas>`，鼠标按下开始画，每画完一笔就把整张画布 `toDataURL()` 存一份，撤销就把上一张图贴回去。

能用，但问题很快就来了：

- **一调整窗口大小，画布就被清空**。canvas 尺寸一变，像素全没了。
- **撤销很脆弱**。每一步都存整张图片，内存涨得飞快，撤销和恢复的逻辑稍不注意就会错乱。
- **画上去的东西改不了**。想把一个矩形挪个位置、换个颜色？做不到，它已经是一堆像素了。
- **橡皮擦其实是“涂白色”**。换个背景色就露馅了。

想要的功能其实很朴素：能画、能改、能撤销、能导出，还能方便地嵌进别的项目。现成的方案里，Excalidraw 和 tldraw 都很强，但对“只想加一块白板”的场景来说有点重：Excalidraw 首次加载的 JS 在 390 kB 左右（gzip），tldraw 生产环境需要购买许可证。

所以这次干脆重写，目标是：**功能够用、体积小、零依赖、MIT**。

## 先看怎么用

```bash
pnpm add @inchill/react-whiteboard
```

```tsx
import '@inchill/react-whiteboard/style.css';
import { Whiteboard } from '@inchill/react-whiteboard';

export default function App() {
  return (
    <div style={{ height: '100vh' }}>
      <Whiteboard />
    </div>
  );
}
```

只想要一个简单的涂鸦板，可以只保留需要的工具：

```tsx
<Whiteboard tools={['pen', 'highlighter', 'eraser']} />
```

现在的功能大概是这些：

- 11 种工具：选择、抓手、画笔、荧光笔、橡皮擦、直线、箭头、矩形、椭圆、三角形、文字
- 每一笔都是独立的图形，可以选中、移动、改颜色和粗细、调层级、复制、删除
- 无限画布：平移、缩放，触屏双指缩放
- 200 步撤销 / 重做，清空画布也能撤销
- 导出 PNG、SVG，保存和打开 JSON
- **压感笔迹**：线条粗细跟随手写笔压力，用鼠标时随速度变化
- **局部擦除**：只擦掉划过的那一段
- 深色模式、中英文界面、自动保存、完整的 TypeScript 类型

打包后 gzip 约 23 kB，除了 React 没有其他依赖。

## 核心思路：从像素换成“图形列表”

重写最关键的一步，是不再保存像素，而是保存**一份图形列表**。每一笔、每个矩形都是一个普通对象：

```ts
type Shape =
  | { type: 'pen'; points: [number, number, number?][]; pressure?: boolean; /* 颜色、粗细… */ }
  | { type: 'rect' | 'ellipse' | 'triangle'; x: number; y: number; w: number; h: number; fill: 'none' | 'semi' | 'solid' }
  | { type: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'text'; x: number; y: number; text: string; fontSize: number };
```

canvas 只负责“把这份列表画出来”。这样一来，前面那几个问题都不存在了：

- **窗口变化**：重新按列表画一遍即可，什么都不会丢。
- **撤销**：历史记录就是“列表的快照”。因为每次修改都返回新数组，没改动的图形对象是共享的，200 步历史也不会占太多内存。
- **编辑**：选中、移动、改样式，都只是修改列表里的对象。
- **导出**：同一份数据，既能画到 canvas 导出 PNG，也能直接拼成 SVG 字符串，矢量图天然清晰。
- **保存**：JSON 序列化一下就行，坐标保留两位小数，文件很小。

无限画布靠一个“相机”实现：`{ x, y, zoom }`。画图前设置一次变换矩阵，屏幕坐标和画布坐标就能互相换算：

```ts
// 世界坐标 → 屏幕坐标
const toScreen = (p, cam) => ({ x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y });
// 以鼠标位置为中心缩放：保证鼠标下面那个点不动
function zoomAt(cam, zoom, anchor) {
  const k = zoom / cam.zoom;
  return { zoom, x: anchor.x - (anchor.x - cam.x) * k, y: anchor.y - (anchor.y - cam.y) * k };
}
```

## 压感笔迹：让线条有粗细变化

普通的画线是 `ctx.stroke()`，整条线一样粗，看起来像圆珠笔。想要有“笔锋”，就不能再用描边，而要**把一笔画成一个宽窄变化的填充形状**。

### 第一步：给每个点记一个压力值

浏览器的 Pointer Events 会告诉你每个点的压力。Apple Pencil、数位板会给出 0~1 之间的真实值；鼠标和手指没有压力，就用**速度**来模拟：画得越快线越细，像毛笔一样。

```ts
function samplePressure({ pointerType, pressure, prev, distance, dt }) {
  let target;
  if (pointerType === 'pen' && pressure > 0) {
    target = pressure;                       // 手写笔：真实压力
  } else {
    const speed = distance / Math.max(dt, 1); // 鼠标/手指：px/ms
    target = 1 - Math.min(1, speed / 2.2) * 0.75;
  }
  // 和上一个值做插值，去掉抖动
  return prev === undefined ? target : lerp(prev, target, pointerType === 'pen' ? 0.6 : 0.25);
}
```

另外有个容易忽略的细节：浏览器为了省性能，会把一帧内的多次 `pointermove` 合并成一次。用 `event.getCoalescedEvents()` 把这些被合并掉的点取回来，快速画圈时线条会明显更圆滑。

### 第二步：沿着笔迹算出左右两条边

对每个点，算出前进方向的法线，再按这个点的压力向两侧各偏移一个半径，就得到了左边界和右边界：

```ts
for (let i = 0; i < pts.length; i++) {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len; // 前进方向
  const r = radii[i];                                    // 由压力决定的半径
  left.push({ x: pts[i].x - dy * r, y: pts[i].y + dx * r });
  right.push({ x: pts[i].x + dy * r, y: pts[i].y - dx * r });
}
// 轮廓 = 左边界 + 尾部半圆 + 反向的右边界 + 头部半圆
```

把轮廓点用二次贝塞尔曲线连起来（每段的终点取相邻两点的中点），填充之后就是一条平滑、有粗细变化的笔画。导出 SVG 时也是同一个轮廓，生成一个 `<path>` 即可。

### 第三步：起笔和收笔变尖

真实的笔迹在开头和结尾都会自然变细。按“当前点离起点 / 终点的距离”给半径乘一个缓动系数就能实现：

```ts
r *= 0.25 + 0.75 * ease(distFromStart / taperLen);
if (strokeFinished) r *= 0.25 + 0.75 * ease(distToEnd / taperLen);
```

注意第二行的条件：**正在画的那一笔不收尾**。否则笔尖下面那一截会一直是尖的，看起来像线条在“追”着光标跑。抬笔之后再收尖，观感就自然了。

## 局部橡皮擦：把一笔“剪”成几段

整笔删除很好做：橡皮碰到哪个图形，就把它从列表里删掉。局部擦除要难一点：橡皮划过的那一段要消失，其余部分保留。

我的做法是把橡皮看成一个圆，把笔画看成一串折线段：

1. **找出被擦掉的点**：到圆心的距离小于“橡皮半径 + 笔画半宽”的点，就算被擦到了。加上笔画半宽，是为了让“擦掉的范围”和肉眼看到的笔画粗细一致。
2. **在边界处补点**：一段线一头在圆外、一头在圆内时，解一个“线段和圆的交点”方程，在交点处补一个点，这样切口刚好落在橡皮边缘，不会出现锯齿。
3. **处理“穿过去”的情况**：两个点都在圆外，但它们之间的线段可能从圆里穿过（点很稀疏、橡皮很大时常见），这种也要从中间切开。
4. **切成几段**：剩下的点按连续性分组，每组成为一条新笔画。原来的 id 留给第一段，其余段生成新 id。

```ts
// 线段 a→b 与圆 (c, r) 的交点参数 t ∈ [0, 1]
function crossing(a, b, c, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const fx = a[0] - c.x, fy = a[1] - c.y;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (A === 0 || disc < 0) return null;
  const t1 = (-B - Math.sqrt(disc)) / (2 * A), t2 = (-B + Math.sqrt(disc)) / (2 * A);
  return t1 >= 0 && t1 <= 1 ? t1 : t2 >= 0 && t2 <= 1 ? t2 : null;
}
```

两个工程上的小细节：

- **快速拖动不能漏擦**。两次 `pointermove` 之间可能隔了几十像素，所以要沿着拖动路径每隔“半个橡皮半径”采样一次。
- **一次擦除只算一步撤销**。拖动过程中只更新预览，抬手时才提交一次历史记录。压感笔画被剪开后，每段保留各自的压力值，切口处同样会自然收尖。

矩形、文字这类图形没法“擦掉一部分”，局部擦除模式下碰到它们就整个删除，和整笔删除的行为一致。

## 一些踩过的坑

- **连续提交互相覆盖**。最开始抬笔时是这样提交的：`commit([...currentShapes, newShape])`。用自动化测试快速连画几笔时，第二笔提交的 `currentShapes` 还是第一笔提交前的旧值，结果把第一笔覆盖掉了。改成函数式更新 `commit(prev => [...prev, newShape])` 就好了，和 `setState(prev => …)` 是同一个道理。
- **点击画布时，文字被提交了两次**。正在编辑文字时点击画布：`pointerdown` 里先让容器获得焦点，结果触发了文本框的 `blur` 而提交了一次，后面的逻辑又提交了一次。解决办法是在移动焦点之前，先记下“当前是否在编辑”。
- **嵌入页面时的滚动冲突**。白板放在长页面里时，滚轮不能被白板拦截，否则页面就滚不动了。所以组件提供了 `captureWheel={false}` 和 `globalShortcuts={false}`，嵌入模式下滚轮留给页面，快捷键只在白板获得焦点时生效。
- **布局要看容器宽度，而不是窗口宽度**。组件可能被放在一个很窄的侧栏里，所以工具栏和面板的响应式布局用的是 CSS 容器查询（`@container`），而不是媒体查询。

## 和同类项目的对比

| | react-whiteboard | Excalidraw | tldraw | react-sketch-canvas |
| --- | --- | --- | --- | --- |
| 协议 | MIT | MIT | 生产环境需许可证 | MIT |
| 首次加载 JS（gzip） | 约 23 kB | 约 390 kB | 约 720 kB | 约 8 kB |
| 图形、文字、选择移动 | ✅ | ✅ | ✅ | ❌ |
| 压感笔迹 | ✅ | ✅ | ✅ | ❌ |
| 局部擦除 | ✅ | ❌ | ❌ | ✅ |
| 插入图片 / 多人协作 | ❌ | ✅ | ✅ | ❌ |

简单的手绘组件大多只能画线，Excalidraw、tldraw 功能完整但体积大；react-whiteboard 想做的就是中间这一块：白板该有的功能都有，体积和依赖却保持在一个小组件的水平。

体积数据是我用 Vite 7 分别打包各库主组件实测的（不含 React，压缩后 gzip）。需要多人协作、插图片、画流程图，Excalidraw 和 tldraw 依然是更好的选择；这个项目适合“想在自己产品里放一块轻量白板”的场景，比如教学板书、草图标注、签名板。

## 还不够好的地方

说实话，项目刚发布，还有不少要补：

- 选中图形后**还不能缩放和旋转**，只能移动，这是目前最大的短板，接下来会优先补上。
- 压感是用模拟的手写笔输入验证的，**还没在 iPad + Apple Pencil 真机上充分测试**。
- 几千笔以上的大画布，性能还没专门优化。

如果你试用时遇到问题，或者有想要的功能，非常欢迎到 GitHub 提 issue。觉得有意思的话，也欢迎点个 Star ⭐，这是对一个个人开源项目最大的鼓励。

- GitHub：<https://github.com/Inchill/react-whiteboard>
- 在线体验：<https://inchill.github.io/react-whiteboard/>
