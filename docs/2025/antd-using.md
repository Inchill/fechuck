# antd 使用小记录

很早以前就用 `antd` 了，非常棒的桌面端组件库。现在偶尔会有一些需求需要用到它，因为以前没有把使用中遇到的各种问题记录下来，导致后面再遇到的时候，又要花费太多时间去重新趟一遍，影响效率，所以决定在这篇文章都记录一下，便于查找。

## Upload 自定义错误提示

很久没用 antd 的 Upload 组件了，今天用的时候发现，当上传失败时，默认的错误提示是英文的，然后看文档因为内容太多了，没有细看。其实我想实现的效果如下：

![error tip](/2025/antd-upload/error-tip.png){data-zoomable}

我的诉求是不需要上传到服务器，所以使用了 `customRequest` 来自定义本地上传。这里做的工作如下：

```js
const customRequest = async (options) => {
    const {file, onSuccess, onError} = options;
    if (file?.size > MAX_FILE_SIZE) {
        file.status = 'error';
        file.response = '文件大小不能超过10MB';
        onError();
        return;
    }
    // 读取文件内容
    const reader = new FileReader();
    reader.onload = () => {
        try {
            JSON.parse(reader.result as string);
            setFileList([file]);
            onSuccess();
        } catch (err) {
            file.status = 'error';
            file.response = '文件格式不是JSON格式';
            setFileList([file]);
            onError();
        }
    };
    reader.readAsText(file);
};
```

做了两件事：文件大小校验和格式校验。但是在一开始我没用上 `file.status` 和 `file.response` 这两个字段，一直在 `onError` 函数中传递提示语，然后一直没生效。后来就扒拉了一下源代码，发现得用这两个字段来设置错误提示。又去官网看了下，其实也是有这两个字段的，只是当时没注意到。

![custom error](/2025/antd-upload/custom-error.png){data-zoomable}

注释里也说明了这是 custom error 用的。

![custom error use](/2025/antd-upload/custom-error-use.png){data-zoomable}

## Form 表单校验 outOfDate 为 true

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
