---
name: docs-site
description: 写或改任何文档站的页面、做教程或教学站、建一个不接 docfirst 的普通 fumadocs 站（`docfirst.create-plain`）、给 fumadocs 站写组件、加分区、在本地看站或构建站、升级 fumadocs、pnpm 安装站的依赖失败时读。讲每一页怎么写成一个讲清原理的网页（控制条与零件用 `@godcreator/docs-explain` 的分步、动画、选情况三种模板，画面按题目设计，动画、图、能动手的部件为主，直接讲原理、少用类比）、描述一个系统时先画接缝图再按接缝讲、这个站能做到什么、组件怎么写（画面与讲解文字都在组件里，mdx 只写标签）、怎么验收，以及两种建站命令、加分区、pnpm 与 next 的常见安装与构建错误。docfirst 站独有的分区、钉码、生成物看 `docfirst-docs`。
---

# 把每一页做成讲清原理的网页

## 怎么写

假设用户说「做个网页给我讲讲 git 的原理」，你会怎么做，文档站的每一页就怎么做。**控制条与零件是固定的一套，
画面按题目设计**：分步、动画、选情况三种讲解组件的控制条，以及面板、终端、胶囊、代码行这些零件，所有站都用
`@godcreator/docs-explain`（见「讲解组件的外壳与零件」一节），读者学一次就会用；组件中间画什么、页面怎么排、
小标题怎么起，每一页按它的题目设计。一大段一大段的文字没人愿意看。

- **先想清楚再动手**：读者看完这一页要明白哪一两件事，读者现在已经知道什么、会在哪一步看不懂
- **直接讲原理**：是什么东西、按什么规则、在什么时候、变成什么。用真名、真实的数据结构、真实的命令与输出。
  类比少用，只在真东西讲不清时才用，用了就说清它哪一点对得上、哪一点对不上，别拿类比代替解释
- **一个具体例子贯穿全页**：同一个仓、同一组数据从头用到尾，读者不用每一节重新理解一遍场景。
  描述一个系统时，这个例子就是它的接缝图（下一节）
- **能看、能动、能自己操作的东西承担主要解释**，文字负责引出和收尾。读者自己点一步、拨一个参数、换一种情况，
  比看一段描述更容易懂
- **一次只推进一个概念**，后一个建立在前一个之上
- **每张图、每段动画都要讲清一件光读文字拼不起来的事**：跨多台机器、多个时刻、多个文件的机制。
  表格加一句话能说清的不画；读者在真实产品里能直接看到的界面默认不模拟，讲解确实需要时才做
- **图直接画**（SVG、React 组件），不用 Mermaid
- **画面跟着题目走**：画面里的布局、动画节奏都为这一页设计，别照搬上一页的画面；颜色用外壳那一套角色色，
  每个角色（一台电脑、一个文件、一个包）在整页里固定一种颜色
- 页面顶上已经按 frontmatter 渲染了 `title` 和 `description`，正文不写 `# 标题`

## 描述一个系统：先画接缝图

讲一个代码仓、一组插件、一套架构时，**先放一张接缝图把整个系统分成模块，再按接缝逐条讲功能**。
别一开始就挑一段看起来关键的代码逐行讲：读者还不知道它在系统里处于什么位置，讲得再细也用不上。讲一个概念
（比如 git 的原理）没有可切分的模块，不用这张图。

图上几种元素的意思是固定的，配色、布局、字体按系统自己设计：

- **虚线框是模块**（包或层），标包名和一句话的角色，按依赖方向从上往下排
- **框里的方块是能力**：能力名加最关键的标识符（文件名、类型名、命令名），不展开实现
- **每条跨过模块边界的线带一个编号，这就是接缝**。实线是代码调用或 import，虚线是读写磁盘上的文件。
  模块内部的线不画
- **系统之外的东西放在框外**：人、git hook、CI、别的系统，箭头指向它们进来的入口
- 画的是能力和它们之间的契约，不是文件之间的 import 依赖图
- **做成能点的**：点一个接缝编号，高亮它两端的能力、在旁边显示这条接缝的契约；点一个模块，淡化和它无关的部分

图后面的正文用同一套编号：

1. **逐条讲接缝**：连着哪两端，中间传的是什么（函数签名、数据形状、文件格式），哪一边负责，改了会让哪一边出问题
2. **再讲各模块对外能做什么**

代码只在契约那一行出现，内部实现确实影响理解时才讲。系统大时分层：顶层图只画包，点一个包进入它自己的接缝图，
一张图里的能力超过二十个左右就看不清了。只有一个模块的系统，画它和外部（工作台、磁盘、用户、别的服务）之间的接缝。

做到什么程度可以看两个站：`D:\unitfolders\qrx1l-collab-site\collab-site\docs-site`（多种情况的推演、两台电脑并排、
终端逐字打出命令）与 `D:\unitfolders\8hv2f-ts-dojo\ts-dojo`（浏览器里写代码、编译、判题）。看的是完成度，不是照抄的样子。

## 讲解组件的外壳与零件

所有站的讲解组件都用 `@godcreator/docs-explain`：站的 `package.json` 依赖它，全局样式里引入它的 `styles.css`。
风格是**现代开发者工具风**：1px 细边框、大圆角；边框、标题栏、标签都用同一个颜色调淡，不铺实心色块；
深色终端窗口左上角三个点；很轻的阴影与小动画，不用辉光、渐变、毛玻璃。

三种模板，控制条都在画面上方、排成固定的一行，切换时按钮不挪位置；说明文字在画面下方：

- **分步** `Stepper`：`[▶/⏸] [‹ 上一步] [1 2 … n] [下一步 ›]`。每一步是一个固定状态，播放是每隔几秒自动下一步。
  讲有先后的过程
- **动画** `Timeline`：同一行，中间换成带章节刻度的横条。时间连续，能拖到任意一刻、往回拖。画面必须写成
  「时间 → 画面」的函数（模板把当前时刻、第几章、本章进度传进来），不能用一次性的 CSS 动画
- **选情况** `CasePicker`：一排情况按钮，画面高亮这种情况走过的路径与结论。讲同一套规则下几种情况的差别

零件：`Pane`（同色调淡标题栏的卡片）、`Terminal`、`Pill`、`Dot`、`CodeLines`（行号、高亮行段、新增行、改动行）、
`Diff`。组件自己的画面只写这一页独有的部分，外壳与零件不重画一套。`@godcreator/docs-explain/text` 把步骤、章节、
情况的数据转成段落，docfirst 站的机读规则用它。

## 这个站能做到什么

- **任意 React 组件**：写在 `src/components/`，登记进 `src/components/mdx.tsx` 的组件表，mdx 里直接写 `<名字 />`。
  Tailwind 可以直接用。fumadocs 自带的组件从 `fumadocs-ui/components/<名>` 导入（`callout`、`steps`、`tabs`、`card`、
  `accordion`、`files`、`type-table`、`image-zoom`），默认组件表里只有 `Card`、`Callout`、代码块与标题几样，别的要自己登记
- **不用正文版式**：组件最外层加 `not-prose`，不受正文排版的字号、间距影响；宽窄屏用容器查询（外层 `@container`，
  里面 `@2xl:` 这类前缀）。frontmatter 写 `full: true`，这一页去掉右侧目录、内容铺满宽度。要一整页完全自己设计，
  在 `src/app/` 下另写路由和布局，代价是它不在侧栏、搜索与 `llms.txt` 里
- **深浅两种主题**：背景、边框、次要文字用 fumadocs 的主题色（`bg-fd-card`、`border-fd-border`、`text-fd-muted-foreground`，
  SVG 里 `fill-fd-*` / `stroke-fd-*`），会自动切换。自己的彩色定义成一组 CSS 变量，`.dark` 下另给一套；
  浅底用 `color-mix(in srgb, 颜色 12%, transparent)` 调。中性主题的 `fd-primary` 是接近黑白的灰，不能用作强调色
- **动画**：CSS 关键帧与 `transition` 做得了的用 CSS；弹簧、拖拽、元素从一处移到另一处用 `motion`
  （fumadocs 已经带着它，写进站自己的 `package.json` 再用）。讲状态怎么变时，同一个东西在前后两步里用同一个稳定的 `key`，
  它会移过去，读者看得见变化本身，而不是消失再重画
- **系统设了「减少动画」**（`prefers-reduced-motion`）就关掉动画，用 `motion` 的在外层包 `<MotionConfig reducedMotion="user">`

组件的几条硬性规则：

- **图、动画、能动手的部件这类讲解组件自包含**：画面和讲解文字都写在组件里，mdx 里只写 `<名字 />` 这样的标签，
  不把讲解写成组件的子元素或参数。讲解文字写成组件的一份数据（比如分步动画每一步的说明），放在不依赖 React 的模块里，
  画面的 React 代码读它。直接读 mdx 源文件只看到标签，要看讲的内容打开组件文件。`Tabs`、`Callout` 这类排版组件
  包的是作者写的正文，照常用子元素
- 用到状态、事件、动画的组件，第一行写 `'use client'`；只画静态 SVG 的不用
- 浏览器 API 放进 `useEffect`：页面先在服务端渲染一遍，那时没有 `window`
- 带 `'use client'` 的模块不能给服务端组件导出常量：服务端拿到的是客户端引用，不是值。共用的常量放进不带它的模块
- 颜色别交给 `motion` 插值：它解析不了 `var(--x)`，过渡中途给出无效颜色，线整条消失。颜色写在 `stroke` / `style` 上、
  用 CSS `transition` 渐变，`motion` 只管位置、大小、透明度
- SVG 路径字符串不能做弹簧动画，`motion` 只会在两端之间跳：让端点坐标各自 `useSpring`，用 `useTransform` 每帧算出 `d`
- `pathLength` 会覆盖虚线设置：要画成虚线的线不做「从头画出」的动画，只淡入
- **docfirst 站还要改两个地方**：`src/components/registry.ts` 的名单加上组件名；`docfirst.config.mjs` 的 `components`
  给它一条规则，写明它在机读版与 `llms.txt` 里变成什么文字——动画和图在那里只剩文字，规则里要把它讲的事写出来。
  规则照 `src/components/tabs/tabs.ai.mjs` 的写法，放在组件旁边、不依赖 React 的 `.ai.mjs` 文件里，读组件那份讲解数据
  生成文字（比如每一步一段）。画面和机读版读的是同一份数据，两边不会对不上；mdx 源文件里只有标签，机读版里内容是全的。
  `node scripts/verify-roster.mjs` 核对 `registry.ts` 的名单与 `components` 的规则一致

## 验收

- `pnpm dev` 加客户端的预览：每个按钮点一下、每种情况走一遍，深浅主题各看一次，把窗口拉窄看一次
- 预览面板被隐藏时，页面的逐帧回调不运行，动画停在中途；这时连续截几张图让它往前走，再看最终画面。
  面板隐藏时页面宽度是 0，先用预览工具给页面设一个尺寸。预览把窗口缩放过时按坐标点会点偏，改用元素引用
- 收尾运行一次 `pnpm build`：`dev` 只编译打开过的页，整站构建失败它看不出来
- docfirst 站再运行 `pnpm doc` 与 `node scripts/verify-roster.mjs`，看一眼机读版（`/llms.mdx/docs/<页>/content.md`）里组件变成的文字读得懂
- 组件里的文字不进站内搜索：读者会搜的词要出现在页面标题、描述或正文里

## 生成站

站约定放在 `<仓>/docs-site`，是一个独立的 pnpm 项目，命令都在站目录里运行。建站是 docfirst 插件的两条命令，参数相同：

```
docfirst.create-plain {"dir":"D:\\unitfolders\\<单元>\\<仓>\\docs-site"}
```

`docfirst.create-plain` 建普通 fumadocs 站；要 docfirst 的现状、轨迹、未来三个区就用 `docfirst.create`。
`dir` 必须还不存在、上一级得存在；只写文件，接着 `pnpm install`、`pnpm dev`。站来自官方脚手架 `create-fumadocs-app`
（版本写死在 docfirst 插件里，要联网），加上本机约定：允许 esbuild 运行构建脚本、`dev` / `start` 写端口并只监听 127.0.0.1、
字体 Sarasa Mono SC、页面语言 zh-CN、站名、去掉 GitHub 链接、删掉分享图与落地页、`/` 跳到 `/docs`。
站里自带搜索（中文不用另配）、`/llms.txt`、每页的 markdown 版本。参数只有 `dir`、`title`（站名）、`port`；
`port` 不给就挑一个没被别的站占用的，查占用的范围是单元文件夹插件的 `units-root` 设置指的目录。细节看命令的 `usage`。

**加一个分区**（`content/notes/` → `/notes`）改四处：`src/lib/source.ts` 里用 `fumadocs-mdx/macro` 的 `defineDocs` 加集合、
再加一条 `loader`；`src/app/notes/[[...slug]]/page.tsx` 照 docs 的写；侧栏在 `src/app/docs/layout.tsx` 里把各 loader 的
`getPageTree()` 拼成一棵树、每个分区一个 `root: true` 的文件夹节点，新分区的 `layout.tsx` 写
`export { default } from '../docs/layout'`。集合写了 `mdxOptions` 会去掉缺省处理，用 `applyMdxPreset(...)` 加回来。

**侧栏顺序**写在各目录的 `meta.json`：`{ "pages": ["index", "...", "glossary"] }`，`"..."` 是其余按文件名排。

## 安装或构建失败

- `pnpm-workspace.yaml` 的 `allowBuilds: esbuild: true` 别删，少了 `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS`
- 发布不满一天的包 pnpm 拒绝安装（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`），锁文件里有这种包时连 `pnpm build` 都运行不了：
  把版本退回上一个。只在本机临时验证可以在当前终端设 `$env:pnpm_config_minimum_release_age='0'`，不写进仓里
- 安装设置写 `pnpm-workspace.yaml`，项目级 `.npmrc` 里的安装设置 pnpm 不读
- 用 fumadocs 间接带进来的包（`motion`、`next-themes`）也写进站自己的 `package.json`：pnpm 不让代码 import 没声明的依赖
- `next.config.mjs` 的 `serverExternalPackages` 里不放带 `'use client'` 组件的包，否则预渲染报
  `Cannot read properties of null (reading 'use')`
- `-H 127.0.0.1` 别删：next 缺省监听所有网卡
- 升级 fumadocs：先在临时目录 `pnpm dlx create-fumadocs-app@<版本>` 生成一份对照、读迁移说明，改 `package.json` 版本
  （`fumadocs-core` 与 `fumadocs-ui` 同号），`pnpm install`、`pnpm build`

人看站用 VS Code 扩展「文档站」（`D:\unitfolders\035mp-vscode-docs-site\vscode-docs-site`）；agent 用 `pnpm dev` 加客户端预览，看完停掉。
