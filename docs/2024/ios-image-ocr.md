---
date: 2024-02-23
outline: deep
description: 做 OCR 图片上传时踩的两个 iOS 坑：动态创建的 file input 拍照后不触发 change，以及照片 EXIF 方向导致 OCR 识别失败。
---

# iOS 图片上传与 OCR 识别的几个坑

最近在做 OCR 识别相关的工作，图片都由前端上传，过程中遇到了两个问题：

1. 用 JS 动态创建 input 标签来实现选图和拍照，在 iOS 上拍照点"使用照片"后没有任何反应；
2. iOS 拍的照片在 OCR 识别时失败率很高。

下面分别记录排查和解决的过程。

## 一、iOS 拍照后 change 回调不触发

唤起图片上传的代码如下：

```js
const launchHtmlCamera = () => {
  const inputElement = document.createElement('input');
  inputElement.id = 'upload-image';
  inputElement.type = 'file';
  inputElement.accept = 'image/*';
  inputElement.multiple = true; // 允许多选
  inputElement.style.display = 'none';

  // 如果只允许拍照，可以加上 capture 属性（取值为 environment 后置 / user 前置）
  // inputElement.capture = 'environment';

  inputElement.addEventListener('change', handleImageSelect);
  inputElement.click();
};
```

逻辑很简单：创建 input、设置属性，再模拟一次点击唤起选择器。但测试时发现，iOS 上拍完照确认后，`handleImageSelect` 始终没有执行。

在 Stack Overflow 上找到了解决办法，但没有找到官方说明。一种比较常见的解释是：没有挂到 DOM 上的 input 只被局部变量引用，iOS 在打开相机、页面切到后台期间可能会把它回收，监听器也就跟着丢了。要在 iOS 上正常工作，需要同时满足两个条件：

1. input 必须被插入到 DOM 中；
2. 必须用 `addEventListener` 监听 `change`，不能用 `onchange`。

所以在模拟点击之前补一行即可：

```js
document.body.appendChild(inputElement); // 不插入 DOM 的话，iOS 上监听器不会被触发
```

### 顺带遇到的闭包问题

项目用的是 React Hooks。input 插入 DOM 后，绑定在上面的 `handleImageSelect` 是第一次渲染时创建的那个函数，它闭包里拿到的 `imgList` 永远是初始值。结果就是：添加一张图后再添加，只会替换，不会追加。

**推荐做法：用函数式更新。** 问题的根源是回调里读了 `imgList`，那就干脆不读它，把"基于最新值追加"交给 React：

```js
const handleImageSelect = async (event) => {
  const res = await readFiles(event.target.files); // 读取/处理选中的文件
  setImgList((prev) => [...prev, ...res.filter(Boolean)]);
  event.target.value = ''; // 清空，否则再次选择同一张图不会触发 change
};
```

`setImgList` 传入函数时，React 会把最新的 state 作为 `prev` 传进来，跟回调是哪次渲染创建的无关，闭包问题自然消失。这样 input 只需创建一次并一直留在 DOM 里，唤起前判断一下是否已存在即可：

```js
const existing = document.getElementById('upload-image');
if (existing) {
  existing.click();
  return;
}
```

我当时实际用过另外两种办法，也能解决，但都更绕，仅作参考：

- **每次用完就移除 input**：在回调末尾 `removeEventListener` 并把 input 从 DOM 中删掉，下次唤起时重新创建、绑定最新的回调；
- **用 useRef 同步最新值**：在 `useEffect` 里把 `imgList` 写进 ref，回调中读 `ref.current`。

只要回调里需要的仅仅是"上一次的 state"，函数式更新就够了；只有回调还要读其他会变的值（比如某个配置项）时，才需要 ref 这类方案。

## 二、iOS 拍照后 OCR 识别失败

iOS 拍的照片在手机上预览是正的，但 OCR 系统却反馈识别失败。

原因在于照片的像素数据本身并不是"正"的。手机拍照时会把拍摄方向写进 EXIF 的 `Orientation` 字段，相册和浏览器显示时再按这个字段旋转回来，所以我们看到的是正常的方向。而 OCR 系统通常直接按原始像素、当作旋转角度为 0 来处理。

![EXIF 中的 Orientation 信息](/2024/ios-image-ocr/exif-orientation.png){data-zoomable}

比如上面这张图，Orientation 为 6（Rotated 90° CCW）：原始像素相对正向是逆时针转了 90 度的，在设备上看是正的，是因为系统显示时帮我们顺时针转了回来。OCR 往往按区域识别，比如要求图片顶部某块区域必须是二维码，但在原始像素里这块区域跑到了左侧，文字也是横躺的，OCR 框定的区域自然找不到它。

![旋转导致识别区域错位](/2024/ios-image-ocr/ocr-orientation.png){data-zoomable}

### Orientation 的常见取值

| 值 | 原始像素相对正向 | 显示时需要 |
| --- | --- | --- |
| 1 | 正常 | 不处理 |
| 3 | 旋转了 180° | 旋转 180° |
| 6 | 逆时针转了 90°（竖拍常见） | 顺时针旋转 90° |
| 8 | 顺时针转了 90° | 逆时针旋转 90° |

读取 Orientation 当时用的是开源库 exif-js（下面的代码基于它，注意这个库已经多年没有维护，新项目不建议再引入），原理可参考：[笔记：使用 JavaScript 读取 JPEG 文件 EXIF 信息中的 Orientation 值](https://zhuanlan.zhihu.com/p/25216999)。

### 按 Orientation 手动还原图片

```js
/**
 * 根据 EXIF Orientation 还原图片方向
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export const getExif = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        EXIF.getData(img, () => {
          const orientation = EXIF.getTag(img, 'Orientation');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          switch (orientation) {
            case 3: // 180°，宽高不变
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.rotate(Math.PI);
              ctx.drawImage(img, -img.width, -img.height);
              break;
            case 6: // 顺时针 90°，宽高互换
              canvas.width = img.height;
              canvas.height = img.width;
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(img, 0, -img.height);
              break;
            case 8: // 逆时针 90°，宽高互换
              canvas.width = img.height;
              canvas.height = img.width;
              ctx.rotate(-Math.PI / 2);
              ctx.drawImage(img, -img.width, 0);
              break;
            default:
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
          }

          canvas.toBlob(resolve, file.type);
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
```

### 实际采用的做法：用 canvas 重绘一遍

最终交给 OCR 的图片，我没有手动旋转，而是直接用 canvas 把图片重绘一遍再导出：

```js
/**
 * 用 canvas 重绘图片，导出不带 EXIF 方向信息的图片
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export const formatOrientation = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        // 0.5 为压缩质量，只对 image/jpeg、image/webp 生效，PNG 会忽略该参数
        canvas.toBlob(resolve, file.type, 0.5);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
```

这样处理后，OCR 识别失败的情况少了很多。如果仍然识别不了，再让 OCR 服务端把图片旋转 180 度重试一次。

### 为什么重绘一遍就有效

现代浏览器（Chrome 81+、Safari 13.1+、Firefox 77+）会在显示和 `drawImage` 时自动按 EXIF 方向摆正图片（CSS 的 `image-orientation` 默认值就是 `from-image`）。所以 `drawImage` 画到 canvas 上的已经是摆正后的像素，而 canvas 导出的图片不带 EXIF 信息。两者叠加，得到的就是一张"像素本身就是正的"图片，OCR 自然能识别。

这也意味着：**在这些浏览器上不要再用上面的 `getExif` 手动旋转**，否则会转两次。`getExif` 只适合需要兼容老版本浏览器的场景。

如果不需要兼容老浏览器，也可以省掉 FileReader 和 Image，直接用 `createImageBitmap` 解码，写法更短：

```js
export const formatOrientation = async (file) => {
  const bitmap = await createImageBitmap(file); // 默认按 EXIF 方向解码
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
};
```

不过各浏览器对 `createImageBitmap` 方向处理的支持时间不一，上线前最好在目标机型上实测一张竖拍照片。

## 小结

- iOS 上动态创建的 file input，要插入 DOM 并用 `addEventListener` 监听 `change`；
- Hooks 里给原生 DOM 绑定回调要注意闭包，更新 state 优先用函数式写法 `setState(prev => ...)`；
- 手机照片的方向靠 EXIF 记录，交给 OCR 等后端服务前，用 canvas 重绘一遍把方向"固化"到像素里。
