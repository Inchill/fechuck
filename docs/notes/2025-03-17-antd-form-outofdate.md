---
date: 2025-03-17
tags: [antd, Form]
description: onValuesChange 里立即校验时表单 store 还没同步，outOfDate 一直为 true；把校验放进 setTimeout 延后一拍。
---

# antd Form 校验时 outOfDate 一直为 true

问题是这样的，在一个弹窗里使用了 `Form` 表单，表单比较简单，当用户输入变化的时候会触发 `onFieldsChange` 回调，然后对表单进行校验，并设置一个 `disabled` 变量，用于控制提交按钮是否禁用，并结合 `Tooltip` 组件显示校验错误信息。本以为是一个比较简单的需求，但是实际上在校验的时候，表单已经全部填写，但仍然进入了 catch 分支，并且导致 `outOfDate` 始终为 true。

```js
const handleFormChange = async () => {
    try {
        const values = await form.validateFields({ validateOnly: true });
        setDisabled(false);
    } catch (err) {
        setDisabled(true);
    }
};
```

`outOfDate` 为 true，说明这个表单数据过期了。 `Form` 组件基于 `rc-field-form` 封装的，在其源码中找到了 `onValuesChange` 方法，`outOfDate` 为 true 发生的原因是，在 `rc-field-form`里，`onValuesChange` 触发时，表单的内部 `store` 还没有完成同步更新。于是乎，在回调函数里，将校验的时机延迟了一下，放在了定时器里。

```js
const onValuesChange = () => {
    setTimeout(async () => {
        try {
            const values = await form.validateFields({ validateOnly: true });
            setDisabled(false);
        } catch (err) {
            setDisabled(true);
        }
    }, 0);
};
```
