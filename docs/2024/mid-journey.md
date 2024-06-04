# 程序员使用 Midjourney 的正确姿势

Midjourney 是一款 AI 图片生成工具，最近一年来在产品和设计领域非常流行。作为 web 开发，天然地会和图片打交道，于是也对 Midjourney 进行了一番探索。和 ChatGPT 一样，高效地生成我们想要的
东西，需要我们合理地利用 prompt。

## 目录

[[toc]]

## 基础命令 /imagine

通过一段文本生成图片，使用的是 `/imagine` 命令。在 `Discord` 里，首先输入 `/`，会弹出命令菜单供我们选择：

![Midjourney prompts](/2024/mid-journey-prompt.png)

这里我们选择 `/imagine` 命令。比如我们想生成一只在草地上的小猫，我们可以这么输入：

![cat prompt](/2024/cat-prompt.png)

按下回车键后，我们只需要耐心等待片刻，就可以看到生成的图片了。生成的图片如下所示：

![ai cat](/2024/ai-cat.png)

可以看到生成了四张图片，图片下面有两行按钮，我们看下官方文档是怎么描述这些按钮的用途的。

:::info U 按钮
U1 ~ U4 是图片选择按钮，通过选择对应网格的图片，可以把这张图片单独提取出来，便于我们预览和下载。
:::

:::info V 按钮
V1 ～ V4 是用于生成新的图片的按钮，点击网格对应区域的图片，Midjourney 会基于这张图片生成一个新的网格，样式和风格会和原图片一致。
:::

:::info R 按钮
R 按钮会重新生成一张图像网格。
:::

如果我们对生成的图像网格不满意，我们可以点击 R 按钮生成新的图片网格，如果新的图片网格里有我们喜欢的图片，我们可以点击 U 按钮提取出来。如果需要微调，可以使用 V 按钮在保持当前图片风格的基础上生成新的图片网格。

## 增强或修改图片

当我们点击 U 按钮选择一张图片后，Midjourney 会生成如下内容：

![selected cat](/2024/selected-cat.png)

第一排按钮里，从左到右依次是对图片进行变化的按钮；第二排按钮是对图片进行缩放，第三排按钮是对图片进行平移，第四排按钮是收藏图片。这些按钮都是对图片进行再次加工的，我们可以借助这些按钮实现对图片的调整。

## Prompts 基础用法

Prompts 的精准与否，决定了生成的图片是否更能满足我们的要求，所以有必要重点关注 Prompts 的使用。

Prompts 是一段简短的文本短语，Midjourney Bot 会对其进行解释以生成图像。在这个过程中会将提示中的单词和短语分解为更小的部分（称为标记），将其与其训练数据进行比较，然后用于生成图像。精心设计的 prompts 可以帮助制作独特且令人兴奋的图像。

![basic prompt](/2024/basic-prompt.png)

> 最佳的实践就是尽可能提供简短的词汇去描述你想生成的事物，而不是罗列一大堆指示。除此之外，尽可能使用英文，因为 Midjourney 对中文的处理不太好。

拿官方文档提供的为例，第二个 prompt 就比第一个精准且简短。

- ❌：给我展示一张大量盛开的加州罂粟花的图片，将它们变成明亮、充满活力的橙色，并用彩色铅笔以插图风格绘制它们。
- ✅: 用彩色铅笔绘制的亮橙色加州罂粟花。

## Prompts 高级用法

高级用法就是加参数，因为一段纯文本是不够的，需要我们添加一些参数来进一步描述我们想要的图像。就拿前面的例子来说，我们想让生成的图片有参照，就需要提供参照的图片链接。

![advanced prompt](/2024/advanced-prompts.png)

举一个例子，我想参照加菲猫，让它坐在沙滩上，可以这样写 prompts：

```text
https://upload.wikimedia.org/wikipedia/en/thumb/b/bc/Garfield_the_Cat.svg/250px-Garfield_the_Cat.svg.png a cat seat on the beach
```

生成的图片是这样的：

![garfield](/2024/garfield.png)

加菲猫坐在沙滩上，但是这个背景看着在外星球，不太符合我们的期望，我们可以更精准一点：

```text
https://upload.wikimedia.org/wikipedia/en/thumb/b/bc/Garfield_the_Cat.svg/250px-Garfield_the_Cat.svg.png a cat on the beach with sunshine
```

![garfield on beach](/2024/garfield-on-beach.png)

第一张图片就比较符合我们的诉求了，我们在这张图片上继续深入，看看加了参数后会是什么样。

### 参数列表

以下是基本参数列表：

- 纵横比：--aspect 或者 --ar
- 随机性：--chaos，取值为 0 ～ 100，用于调整生成图像的变化和随机性。值较高会更具不确定性和创意性，较低会使得更为一致和可预测。
- 角色参考：--cref URL，指定一张图像链接，用于生成图像的参考。
- 快速模式：--fast。
- 图像权重：--iw，设置相对于文本权重的图像提示权重，默认值为 1。
- 否定提示：--no，否定提示，将会把参数后文本指定的元素不包含在图像中。
- 图像质量：--quality <.25、.5 或 1>，或 --q <.25、.5 或 1> 你希望花费多少渲染质量时间。默认值为 1。数值越高，使用的 GPU 分钟数越多；数值越低，使用的 GPU 分钟数越少。
- 样式随机：--style random，在提示符中随机添加 32 个基本样式的样式调谐器代码。你也可以使用 --style random-16、--style random-64 或 --style random-128 来使用其他长度的样式调谐器的随机结果。
- 模型参数：--niji 参数用于指定 Midjourney 生成图片时使用的模型，--niji <4, or 5> 这类模型专注于动漫风格的图像。

还是以上面的加菲猫举例，现在我想以加菲猫为参照，纵横比为 4:3，同时随机性为 50，可以这样写：

```text
a cat on the beach with sunshine --cref https://upload.wikimedia.org/wikipedia/en/thumb/b/bc/Garfield_the_Cat.svg/250px-Garfield_the_Cat.svg.png --ar 4:3 --chaos 50
```

最终生成的图片如下：

![garfield cat on the beach with sunshine](garfield-cat-on-the-beach-with-sunshine.png)

这里的第三张图片就很有意思，我选择了 U3 按钮，然后点击了 vary subtle，生成的图像格子如下：

![garfield cat vary subtle](garfield-cat-vary-subtle.png)

还是很有意思的，这些参数能够极大程度地帮助我们创作出我们想要的图像。

## 实践

上面讲了很多 Midjourney 的基本用法，但是还没有实地应用过，现在我想举几个例子。

### 生成 logo

作为程序员基本都会有自己的技术博客网站，并且通常都会设置 logo、favicon 等，但是素材怎么设计比较麻烦，Midjourney 就可以帮我们解决这个问题。我们可以参照一些网站的 logo，然后使用 Midjourney 加工调整，输出符合期望的 logo。

比如我想借鉴宫崎骏的动漫电影《龙猫》为原型，设计一款毕加索风格的图片：

```text
generate a totoro with Picasso line drawing style
```

Midjourney 输出如下：

![totoro picasso](/2024/totoro-picasso.png)

让我们加点调味剂，加一些参数让其更加抽象随机，在上述命令后添加 --chaos 50，

```text
generate a totoro logo more abstract with Picasso line drawing style --chaos 60
```

Midjourney 输出如下：

![totoro more abstract](/2024/totoro-more-abstract.png)

经过加工后，生成了以下图片，其中第三张就适合作为 logo。

![more cute totoro](/2024/more-cute-totoro.png)

### 生成 icon

生成 favicon 需要一些素材，推荐两个网站：`https://icons8.com/`、`https://www.iconfinder.com/`。

Midjourney 对图片链接有限制，如果是国内链接可能会失败，所以用尽量使用国外链接比较稳妥。这里我用树懒图标作为参照，生成一个自定义的新图标。

```text
a cartoon sloth --cref https://cdn3.iconfinder.com/data/icons/animal-emoji/50/Sloth-256.png --ar 1:1 --chaos 50
```

生成的图片格子如下：

![cartoon sloth](/2024/cartoon-sloth.png)

选取第一张，作为新的图标，再作一些微调，最终效果如下：

![sloth icon](/favicon.ico)

### 生成海报图片

生成海报需要我们确定以下内容：

1. 主题和风格；
2. prompts 和参数。

在上述内容确定后，Midjourney 会为我们生成第一版图片，接下来需要我们对第一版图片进行调整。

#### 夏日旅行海报

比如我们要生成一张有关夏日旅行的海报，我们先要确定主题和风格。

1. 主题和风格：提到夏日旅行我们脑海中浮现出一副在沙滩上躺在椅子上晒太阳的画面，然后期望的是生成 2D 动漫风格；
2. 对应的 prompts：我们将其翻译为英文描述，`a woman on the beach, lying on a chair, sunbathing, in the style of 2d comics`。

生成的初版图如下：

![summer traveling](/2024/summer-traveling.png)

前面提到过动漫风格参数需要加 --niji, 我们试着加上 --niji 5 参数。最终的 prompts 如下：`a woman on the beach, lying on a chair, sunbathing, in the style of 2d comics --niji 5`。

![summer traveling with niji](/2024/summer-traveling-with-niji.png)

#### 父亲节海报

1. 主题和风格：父亲拉着儿子的手在玩耍。
2. prompts：father holding son's hand playing on the playground --niji 5。

输出初版图如下：

![father and son](/2024/father-son.png)

这里对第三张图片进行一些调整，继续升级后输出如下：

![father hold son](/2024/father-hold-son.png)

## 总结

- 基础命令 `/imagine` 可以生成一张图片，`/imagine` 后面接 prompts 即可。
- `prompts` 基础用法，在于合理地搭配词汇，词汇越简短越精准，图片才更能符合诉求。
- `prompts` 高级用法，其实是在文本描述之后使用参数，去更加细化地控制图片生成。比如我们想指定参照图片，就可以使用 `--cref URL` 去指定参照图片。`--chaos <0, 100>` 参数可以控制图片的随机性，数值越高，生成的图片越随机。`--style random` 参数可以随机生成 32 个基本样式的样式调谐器代码。`--niji <4, 5>` 参数可以指定 Midjourney 生成图片时使用的模型，`--niji 5` 表示使用 5.0 模型，`--niji 4` 表示使用 4.0 模型。
- 实践：Midjourney 的使用场景非常多，比如生成 logo、icon、海报等，通过实践可以更加直观地理解 Midjourney 的使用场景。

## 参考文档

有关 Midjourney 的更多使用细节，可以查阅官方文档里，里面有更多的示例和用法，去帮助我们生成想要的图片。

- [Midjourney 官方文档](https://docs.midjourney.com/docs/quick-start)
- [icons8](https://icons8.com/)
- [iconfinder](https://www.iconfinder.com/)
