// 书签数据：想加网站，在对应分类里加一行就行
// note 写一句为什么值得看；图标由 scripts/favicons.mjs 自动抓取（部署时也会自动跑），抓不到的可以用 icon 手动指定地址

export interface Site {
  title: string
  url: string
  note?: string
  icon?: string // 自动抓不到图标时，手动指定图标地址
}
export interface Group {
  name: string
  desc?: string
  sites: Site[]
}

const groups: Group[] = [
  {
    name: 'AI',
    desc: '模型、教程和 Agent',
    sites: [
      { title: 'DeepSeek', url: 'https://chat.deepseek.com/', note: '国产大模型，推理和写代码都不错' },
      { title: 'Kimi', url: 'https://kimi.moonshot.cn/', note: '长文本阅读强，丢论文、文档进去很好用' },
      { title: 'Google AI Studio', url: 'https://aistudio.google.com/', note: '免费试用 Gemini 系列模型，还能直接搭小应用' },
      { title: 'WaytoAGI', url: 'https://www.waytoagi.com/', note: '中文 AI 知识库，教程和工具导航都很全' },
      { title: 'Hello-Agents', url: 'https://datawhalechina.github.io/hello-agents/', note: 'Datawhale 出品，从零学构建智能体' },
      { title: 'Agent Learning Hub', url: 'https://datawhalechina.github.io/Agent-Learning-Hub/', note: 'Agent 学习资料汇总' },
      { title: 'Learn Claude Code', url: 'https://learn.shareai.run/zh/', note: '拆解编程 Agent 的工作原理' },
      { title: '深度学习与大模型学习路径', url: 'https://loveunk.github.io/deep-learning-llm-agent-notes/', note: '从深度学习到大模型、Agent 的学习路线' },
      { title: 'LangChain 中文入门教程', url: 'https://liaokong.gitbook.io/llm-kai-fa-jiao-cheng/', note: 'LangChain 上手教程，例子多' },
      { title: 'MCP 中文站', url: 'https://mcpcn.com/', note: 'MCP 协议的中文文档' },
      { title: 'MCP.so', url: 'https://mcp.so/zh', note: 'MCP Server 导航，找现成的工具接入' },
      { title: 'SkillsBench', url: 'https://www.skillsbench.ai/', note: '评测 Agent Skills 实际效果的基准' },
      { title: 'Midscene.js', url: 'https://midscenejs.com/', note: '用自然语言驱动 UI 自动化和测试' },
      { title: 'GitDiagram', url: 'https://gitdiagram.com/', note: '把 GitHub 仓库一键画成架构图' },
      { title: 'Next AI Draw.io', url: 'https://next-ai-drawio.jiang.jp/', note: '用一句话生成 draw.io 图表' },
      { title: 'prompts.chat', url: 'https://prompts.chat/', note: '开源的提示词合集' },
      { title: 'PromptHero', url: 'https://prompthero.com/', note: '搜 AI 绘画和对话的提示词' },
      { title: 'Vercel AI Playground', url: 'https://sdk.vercel.ai/', note: '在一个页面里对比多个大模型的回答' }
    ]
  },
  {
    name: '电子书',
    desc: '能在线免费读的好书',
    sites: [
      { title: 'Hello 算法', url: 'https://www.hello-algo.com/', note: '动画图解数据结构与算法，入门首选' },
      { title: '网道 JavaScript 教程', url: 'https://wangdoc.com/javascript/', note: '系统过一遍 JS 的好教材' },
      { title: 'Eloquent JavaScript', url: 'https://eloquentjavascript.net/', note: '经典 JS 入门书，带交互式练习' },
      { title: 'You Don\'t Know JS', url: 'https://github.com/getify/You-Dont-Know-JS', note: '深挖 JS 语言机制的系列书' },
      { title: 'JavaScript 二十年', url: 'https://cn.history.js.org/', note: 'JS 从诞生到今天的历史' },
      { title: '深入理解 TypeScript', url: 'https://jkchao.github.io/typescript-book-chinese/', note: 'TS 进阶读物，类型系统讲得透' },
      { title: 'Pro Git', url: 'https://git-scm.com/book/zh/v2', note: 'Git 官方书，有中文版' },
      { title: 'Docker 从入门到实践', url: 'https://yeasy.gitbook.io/docker_practice/', note: 'Docker 中文入门书，持续更新' },
      { title: 'Vue 技术内幕', url: 'http://caibaojian.com/vue-design/', note: '逐行分析 Vue 2 源码' },
      { title: 'You Need To Know CSS', url: 'https://lhammer.cn/You-need-to-know-css/', note: '一组实用 CSS 技巧，每个都有演示' },
      { title: 'LeetCode Cookbook', url: 'https://books.halfrost.com/leetcode/', note: '按题型整理的 LeetCode 题解' },
      { title: 'How to be a Programmer', url: 'https://braydie.gitbooks.io/how-to-be-a-programmer/content/zh/', note: '程序员成长的经验之谈' },
      { title: '深入理解 AI Agent', url: 'https://bojieli.github.io/ai-agent-book/astro/', note: '从原理到实践讲 Agent 的开源书' },
      { title: '深入理解 AI Infra', url: 'https://github.com/bojieli/ai-infra-book', note: '从硬件约束和模型架构讲 AI 基础设施' },
      { title: '高性价比人生指南', url: 'https://eternity4719.github.io/HowToLiveBetter/', note: '不讲技术，讲怎么用更少的钱和精力过得更好' },
      { title: 'free-programming-books', url: 'https://github.com/EbookFoundation/free-programming-books', note: '免费编程书大合集' },
      { title: 'Project Gutenberg', url: 'https://www.gutenberg.org/', note: '数万本公版电子书，免费下载' },
      { title: '微信读书', url: 'https://weread.qq.com/', note: '日常读书主力' },
      { title: 'Vue.js 技术揭秘', url: 'https://ustbhuangyi.github.io/vue-analysis/', note: '黄轶写的 Vue 2 源码解析' }
    ]
  },
  {
    name: '学习',
    desc: '课程、刷题和系统化的学习资源',
    sites: [
      { title: '极客时间', url: 'https://time.geekbang.org/', note: '技术专栏和视频课，质量整体不错' },
      { title: '中国大学 MOOC', url: 'https://www.icourse163.org/', note: '国内高校的精品公开课' },
      { title: 'edX', url: 'https://www.edx.org/', note: '哈佛、MIT 等名校的免费在线课程' },
      { title: 'TED Talks', url: 'https://www.ted.com/talks', note: '各领域的精彩演讲' },
      { title: '慕课网', url: 'https://www.imooc.com/', note: '偏实战的 IT 课程' },
      { title: '网易云课堂', url: 'https://study.163.com/', note: '综合类在线课程平台' },
      { title: '蓝桥云课', url: 'https://www.lanqiao.cn/', note: '带在线实验环境的编程课' },
      { title: '力扣 LeetCode', url: 'https://leetcode.cn/', note: '刷算法题的主阵地' },
      { title: 'CodeTop', url: 'https://codetop.cc/home', note: '按公司和频率整理的面试题库' },
      { title: '代码随想录', url: 'https://programmercarl.com/', note: '按顺序刷题的算法攻略，讲解清楚' },
      { title: '小林coding', url: 'https://xiaolincoding.com/', note: '图解网络、操作系统、MySQL' },
      { title: 'LearnVue', url: 'https://learnvue.co/', note: 'Vue 的教程和实践文章' },
      { title: 'W3cplus', url: 'https://www.w3cplus.com/', note: '大漠的 CSS 和前端技术站' },
      { title: '前端早早聊', url: 'https://www.zaozao.run/article', note: '前端大会的分享文章合集' },
      { title: 'SitePoint', url: 'https://www.sitepoint.com/web/', note: 'Web 开发教程和文章' },
      { title: 'Envato Tuts+', url: 'https://tutsplus.com/', note: '设计和开发的免费教程' },
      { title: 'SVG Tutorial', url: 'https://codepen.io/HunorMarton/full/PoGbgqj', note: '交互式的 SVG 入门教程' },
      { title: 'State of JS', url: 'https://2022.stateofjs.com/zh-Hans/resources/', note: '年度 JS 生态调查，附推荐学习资源' },
      { title: '人人都是产品经理', url: 'https://www.woshipm.com/', note: '产品和运营的学习交流社区' }
    ]
  },
  {
    name: '博客',
    desc: '常看的个人和团队博客',
    sites: [
      { title: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/blog/', note: '每周科技周刊，信息密度高' },
      { title: 'Anthony Fu', url: 'https://antfu.me/', note: 'Vue、Vite 核心成员，写开源和创造' },
      { title: 'V8 Blog', url: 'https://v8.dev/', note: 'V8 团队讲 JS 引擎的内部实现' },
      { title: 'John Resig', url: 'https://johnresig.com/', note: 'jQuery 作者的博客' },
      { title: 'Umar Hansa', url: 'https://umaar.com/', note: 'DevTools 小技巧专家' },
      { title: 'kvz.io', url: 'https://kvz.io/', note: '关于软件、基础设施和创业' },
      { title: '美团技术团队', url: 'https://tech.meituan.com/', note: '大厂工程实践，干货多' },
      { title: 'ChokCoco', url: 'https://www.cnblogs.com/coco1s/', note: 'CSS 奇技淫巧，脑洞很大' },
      { title: 'Joe\'s Blog', url: 'https://hijiangtao.github.io/', note: '前端与可视化' },
      { title: 'jayzou', url: 'https://jayzou.js.org/', note: '前端开发者的个人博客' },
      { title: 'Sam Twidale', url: 'https://samcodes.co.uk/', note: '游戏和图形方向的开发者博客' },
      { title: 'Ryan\'s Blog', url: 'https://www.crs811.com/', note: '技术和生活随笔' },
      { title: '前端人的俱乐部', url: 'https://f2er.club/', note: '前端技术文章' }
    ]
  },
  {
    name: '好文章',
    desc: '值得反复读的单篇',
    sites: [
      { title: '深入剖析 QuickJS', url: 'https://ming1016.github.io/2021/02/21/deeply-analyse-quickjs/', note: '戴铭拆解 JS 引擎 QuickJS 的实现' },
      { title: '解构 UI：轮播', url: 'http://pandaqr.github.io/2016/11/06/%E8%A7%A3%E6%9E%84UI-%E8%BD%AE%E6%92%AD-Carousels.html', note: '把轮播组件的设计细节一条条拆开' },
      { title: '用图片对比算法做白屏检测', url: 'https://toutiao.io/posts/1siqlk0/preview', note: '白屏监控的一种实用思路' },
      { title: '从 0 到 1 搭建 React UI 组件库', url: 'https://www.cnblogs.com/shanejix/p/15913265.html', note: '组件库工程化的完整过程' },
      { title: '增强型 95 计费', url: 'https://cloud.361way.com/insight/10/', note: '讲清云带宽的 95 计费方式' }
    ]
  },
  {
    name: '工具',
    desc: '开发和日常常用的在线工具',
    sites: [
      { title: 'IT Tools', url: 'https://it-tools.tech/', note: '开发小工具合集：编码转换、UUID、哈希等' },
      { title: 'Excalidraw', url: 'https://excalidraw.com/', note: '手绘风白板，画草图和架构图很快' },
      { title: 'draw.io', url: 'https://app.diagrams.net/', note: '免费的流程图、架构图工具' },
      { title: 'ProcessOn', url: 'https://www.processon.com/', note: '在线思维导图和流程图，支持协作' },
      { title: 'regex101', url: 'https://regex101.com/', note: '调试正则，逐段解释匹配过程' },
      { title: 'Regulex', url: 'https://jex.im/regulex/', note: '把正则表达式画成可视化的图' },
      { title: 'iHateRegex', url: 'https://ihateregex.io/', note: '常用正则速查，附图解' },
      { title: 'CODELF', url: 'https://unbug.github.io/codelf/', note: '起变量名犯难时，搜搜别人怎么命名' },
      { title: 'TinyPNG', url: 'https://tinypng.com/', note: '压缩图片，几乎看不出损失' },
      { title: 'PageSpeed Insights', url: 'https://pagespeed.web.dev/', note: '测网页性能和 Core Web Vitals' },
      { title: 'Wappalyzer', url: 'https://www.wappalyzer.com/', note: '看一个网站用了什么技术栈' },
      { title: 'jsPerf', url: 'https://jsperf.app/', note: '在线对比 JS 代码的性能' },
      { title: 'Choose a License', url: 'https://choosealicense.com/licenses/', note: '开源协议怎么选，一张表看明白' },
      { title: 'Unsplash', url: 'https://unsplash.com/', note: '免费可商用的高质量图片' },
      { title: 'Flourish', url: 'https://flourish.studio/', note: '做交互式图表和数据故事' },
      { title: '创客贴', url: 'https://www.chuangkit.com/', note: '在线做海报、封面图，模板多' },
      { title: '吾道幻灯片', url: 'https://www.woodo.cn/', note: '在线做 PPT，模板不少' },
      { title: 'BootCDN', url: 'https://www.bootcdn.cn/', note: '国内访问快的开源库 CDN' },
      { title: 'UNPKG', url: 'https://unpkg.com/', note: '直接用 URL 引用 npm 包里的文件' },
      { title: 'Docusaurus', url: 'https://docusaurus.io/zh-CN/', note: 'Meta 开源的文档站生成器' },
      { title: 'Squoosh', url: 'https://squoosh.app/', note: 'Google 出的图片压缩，能实时对比效果' },
      { title: 'Pixabay', url: 'https://pixabay.com/', note: '免费可商用的图片、插画和视频' }
    ]
  },
  {
    name: '参考',
    desc: '查文档、看规范',
    sites: [
      { title: 'MDN Web 文档', url: 'https://developer.mozilla.org/zh-CN/', note: '前端最权威的文档' },
      { title: 'Can I use', url: 'https://caniuse.com/', note: '查浏览器对某个特性的支持情况' },
      { title: 'web.dev Learn', url: 'https://web.dev/learn/', note: 'Google 出的系统化 Web 课程' },
      { title: 'Chrome DevTools', url: 'https://developer.chrome.com/docs/devtools?hl=zh-cn', note: '开发者工具官方文档，很多隐藏用法' },
      { title: 'Google Developers', url: 'https://developers.google.com/', note: 'Google 各类开发文档入口' },
      { title: '30 seconds of code', url: 'https://www.30secondsofcode.org/', note: '短小实用的代码片段' },
      { title: 'Google Style Guides', url: 'https://github.com/google/styleguide', note: 'Google 各语言的代码风格指南' },
      { title: 'Angular 提交规范', url: 'https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits', note: '约定式提交（Conventional Commits）的源头' },
      { title: 'Project Guidelines', url: 'https://github.com/elsewhencode/project-guidelines/blob/master/README-zh.md', note: 'JS 项目的一套工程实践约定' },
      { title: 'React', url: 'https://react.dev/', note: 'React 官方文档，新版写得很好' },
      { title: 'TC39', url: 'https://tc39.es/', note: 'JS 语言规范和新提案的进展' },
      { title: 'W3C', url: 'https://www.w3.org/', note: 'Web 标准的制定者' },
      { title: 'Chrome Platform Status', url: 'https://chromestatus.com/features', note: 'Chrome 新特性的上线进度' },
      { title: 'npm Docs', url: 'https://docs.npmjs.com/', note: 'npm 官方文档' },
      { title: 'Babel', url: 'https://babeljs.io/', note: 'JS 编译器，文档里的在线 REPL 很好用' },
      { title: 'PostCSS', url: 'https://www.postcss.com.cn/', note: '用 JS 插件转换 CSS 的工具' },
      { title: 'Vue I18n', url: 'https://kazupon.github.io/vue-i18n/zh/', note: 'Vue 国际化方案' },
      { title: '语义化版本', url: 'https://semver.org/lang/zh-CN/', note: '版本号该怎么递增' },
      { title: 'GitHub Docs', url: 'https://docs.github.com/', note: 'GitHub 官方文档' },
      { title: 'GeoJSON', url: 'https://geojson.cn/', note: 'GeoJSON 规范中文版' },
      { title: 'UCloud 文档中心', url: 'https://docs.ucloud.cn/', note: 'UCloud 云产品文档' },
      { title: 'CSS-Tricks', url: 'https://css-tricks.com/', note: 'CSS 文章和指南，Flexbox、Grid 完全指南是经典' }
    ]
  },
  {
    name: '速查',
    desc: '忘了语法时，打开就能查',
    sites: [
      { title: 'HTML Cheat Sheet', url: 'https://htmlcheatsheet.com/', note: '交互式 HTML 速查' },
      { title: 'CSS Cheat Sheet', url: 'https://htmlcheatsheet.com/css/', note: '交互式 CSS 速查' },
      { title: 'HTML Reference', url: 'https://htmlreference.io/', note: '所有 HTML 元素和属性的图解' },
      { title: 'CSS Reference', url: 'https://cssreference.io/', note: '图解每个 CSS 属性的效果' },
      { title: 'Grid 速查', url: 'https://grid.malven.co/', note: '一图看懂 CSS Grid' },
      { title: 'Flexbox 速查', url: 'https://flexbox.malven.co/', note: '一图看懂 Flexbox' },
      { title: 'JS 速查', url: 'https://html-css-js.com/js/', note: 'JavaScript 常用语法速查' },
      { title: 'Cheatography', url: 'https://cheatography.com/', note: '各种语言和工具的速查表' }
    ]
  },
  {
    name: 'UI 与设计',
    desc: '配色、字体、图标和动效',
    sites: [
      { title: 'Apple Design Resources', url: 'https://developer.apple.com/design/resources/', note: '苹果官方的设计模板和素材' },
      { title: 'Type Scale', url: 'https://type-scale.com/', note: '可视化地生成字号梯度' },
      { title: 'Fontjoy', url: 'https://fontjoy.com/', note: '一键生成字体搭配' },
      { title: 'ColorDrop', url: 'https://colordrop.io/', note: '精选配色方案' },
      { title: 'uiGradients', url: 'https://uigradients.com/', note: '好看的渐变色合集' },
      { title: 'Easings', url: 'https://easings.co/', note: '调贝塞尔缓动曲线，让动画更自然' },
      { title: 'Animista', url: 'https://animista.net/', note: '现成的 CSS 动画，挑好直接复制' },
      { title: 'Transition.css', url: 'https://www.transition.style/', note: '基于 clip-path 的转场动画' },
      { title: 'GSAP', url: 'https://gsap.com/', note: '专业级 JS 动画库' },
      { title: 'anime.js', url: 'https://www.animejs.cn/documentation/', note: '轻量的 JS 动画库，有中文文档' },
      { title: 'Galacean Effects', url: 'https://galacean.antgroup.com/effects/', note: '蚂蚁开源的 Web 动效方案' },
      { title: 'Uiverse', url: 'https://uiverse.io/', note: '开源 UI 组件合集，CSS 和 Tailwind 都有' },
      { title: 'Neumorphism.io', url: 'https://neumorphism.io/', note: '生成新拟态风格的阴影' },
      { title: 'Fancy Border Radius', url: 'https://9elements.github.io/fancy-border-radius/', note: '调出不规则的圆角形状' },
      { title: 'Get Waves', url: 'https://getwaves.io/', note: '生成 SVG 波浪' },
      { title: 'Shape Divider', url: 'https://www.shapedivider.app/', note: '做区块之间的分隔形状' },
      { title: 'pattern.css', url: 'https://bansal.io/pattern-css', note: '纯 CSS 背景纹理' },
      { title: 'loading.io', url: 'https://loading.io/', note: '各种加载动画' },
      { title: 'CSS Button Generator', url: 'https://www.cssbuttongenerator.com/', note: '可视化生成按钮样式' },
      { title: 'CSSPeeper', url: 'https://csspeeper.com/', note: '浏览器插件，快速查看网页的样式' },
      { title: 'Icons8', url: 'https://icons8.com/', note: '图标、插画、照片素材' },
      { title: 'Flaticon', url: 'https://www.flaticon.com/', note: '海量免费矢量图标' },
      { title: 'Iconshock SVG', url: 'https://www.iconshock.com/svg-icons/', note: '渐变风格的 SVG 图标' },
      { title: 'Avataaars', url: 'https://getavataaars.com/', note: '生成卡通头像' },
      { title: 'imgcook', url: 'https://www.imgcook.com/', note: '设计稿一键生成代码' },
      { title: 'cubic-bezier.com', url: 'https://cubic-bezier.com/', note: '拖动调节缓动曲线，实时预览' },
      { title: 'CSS 3D Transform 示例', url: 'https://polypane.app/css-3d-transform-examples/', note: '一组好看的 3D 透视效果，可直接复制' }
    ]
  },
  {
    name: 'Playground',
    desc: '在线写代码、练手',
    sites: [
      { title: 'CodePen', url: 'https://codepen.io/', note: '前端 Demo 分享社区' },
      { title: 'CodeSandbox', url: 'https://codesandbox.io/', note: '在线跑完整的前端项目' },
      { title: 'AST Explorer', url: 'https://astexplorer.net/', note: '看代码被解析成的语法树，写 Babel 插件必备' },
      { title: 'CSSBattle', url: 'https://cssbattle.dev/', note: '用最少的 CSS 还原目标图形，很上瘾' },
      { title: 'Flexbox Froggy', url: 'https://flexboxfroggy.com/', note: '用小游戏学 Flex 布局' },
      { title: 'CodinGame', url: 'https://www.codingame.com/', note: '边玩游戏边刷编程题' },
      { title: 'ES6 Console', url: 'https://es6console.com/', note: '在线看 ES6 编译成 ES5 的结果' },
      { title: 'Liveweave', url: 'https://liveweave.com/', note: '轻量的 HTML/CSS/JS 在线编辑器' },
      { title: 'dabblet', url: 'https://dabblet.com/', note: '调 CSS 的小型实时编辑器' },
      { title: 'CSS Playground', url: 'https://css-playground-ten.vercel.app/?lang=en', note: '在线练 CSS 的小游乐场' }
    ]
  },
  {
    name: '社区',
    desc: '常逛的社区和资讯',
    sites: [
      { title: 'V2EX', url: 'https://www.v2ex.com/', note: '程序员和创意工作者的社区' },
      { title: 'SegmentFault 思否', url: 'https://segmentfault.com/', note: '中文技术问答社区', icon: 'https://static.segmentfault.com/main_site_next/prod/favicon.ico' },
      { title: 'Stack Overflow', url: 'https://stackoverflow.com/', note: '遇到报错先来这里搜' },
      { title: 'DEV Community', url: 'https://dev.to/', note: '开发者写作社区，氛围友好' },
      { title: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/', note: 'Web 设计与开发的深度文章' },
      { title: 'Best of JS', url: 'https://bestofjs.org/', note: '看 JS 生态里哪些项目在涨星' },
      { title: 'This Week In React', url: 'https://thisweekinreact.com/', note: 'React 生态周报' },
      { title: 'ShopTalk Show', url: 'https://shoptalkshow.com/', note: '聊前端开发的播客' },
      { title: 'Buzzing', url: 'https://www.buzzing.cc/', note: '用中文浏览国外社交媒体的热门讨论' },
      { title: 'InfoQ', url: 'https://www.infoq.cn/', note: '技术资讯和架构实践' },
      { title: '图灵社区', url: 'https://www.ituring.com.cn/', note: '图灵出版社的技术图书社区' },
      { title: 'CNode', url: 'https://cnodejs.org/', note: 'Node.js 中文社区' },
      { title: 'Docker 中文社区', url: 'https://www.docker.org.cn/', note: 'Docker 中文资料' },
      { title: 'Viget', url: 'https://www.viget.com/articles/', note: '设计开发公司的博客，文章质量高' },
      { title: 'Reddit', url: 'https://www.reddit.com/', note: '什么话题都有的社区' },
      { title: 'Medium', url: 'https://medium.com/', note: '英文写作平台，技术文章很多' },
      { title: '36氪', url: 'https://www.36kr.com/', note: '科技和创投资讯' }
    ]
  },
  {
    name: '有趣的网站',
    desc: '随便点开都能玩一会儿',
    sites: [
      { title: '自由钢琴', url: 'https://www.autopiano.cn/', note: '在线弹钢琴，还能自动演奏曲子' },
      { title: 'Google 地球', url: 'https://earth.google.com/web/', note: '在浏览器里环游地球' },
      { title: 'JavaScript engines zoo', url: 'https://ivankra.github.io/javascript-zoo/', note: '世界上各种 JS 引擎的大合集' },
      { title: 'AwesomeIndex', url: 'https://awesomeindex.dev/', note: '搜索各种 awesome 列表' }
    ]
  }
]

export default groups

// 「先从这里逛起」的三个推荐，url 要和上面某个网站一致
export const featured = [
  { url: 'https://www.hello-algo.com/', label: '入门算法，就读它' },
  { url: 'https://excalidraw.com/', label: '画图最顺手' },
  { url: 'https://cssbattle.dev/', label: '很上瘾的小游戏' }
]
