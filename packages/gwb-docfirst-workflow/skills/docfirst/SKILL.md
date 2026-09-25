---
name: docfirst
description: 要给一个刚建好的 fumadocs 骨架装上 docfirst 的六区时用；要核对一个站里的现状有没有漂移、要确认引用、要重新生成生成物时也读它——那几件事不经过这个插件，是自己 cd 到那个仓里跑 pnpm doc，这份说清了跑哪几条；跨仓反馈投到哪儿、什么格式也在这儿。
---

# docfirst 插件：装六区，加五份说明书

本插件只有**一条命令**：`docfirst.attach`——给一个已经生成好的 fumadocs 骨架装上 docfirst 的六区。
除此之外它只做一件事：把另外五份说明书注册给你读。

**它对 `@godcreator/docfirst-workflow` 那个包零依赖**，装了本插件不必再装什么包。判据是「这件事在哪儿
发生」：核对 / 确认 / 渲染要在**仓**里发生（那是门禁与站构建要跑的东西），你自己 `cd` 过去跑；
只在你手上发生一次的（读说明书、给一个新骨架写一次文件）才归插件。**插件不转发命令行。**

**站的管理归站点插件**（`@godcreator/gwb-docs-site`，命令 `docs-site.*`）：扫容器根找站、生成标准
fumadocs 骨架、判断 build 是不是最新、挑空闲端口启动与停止、到时间自动关闭、站的窗格。两个插件
互不依赖、各带各的模板。

## 建一个新站是两步

```
docs-site.create {"dir":"<仓>/docs-site"}     站点插件：生成标准 fumadocs 骨架（一个集合、一条路由、一页 index）
docfirst.attach  {"dir":"<仓>/docs-site"}     本插件：在骨架上装六区、docfirst.config.mjs、mdx 接线、名册脚本
```

**顺序不能反，中间不要改文件。** `attach` 只在刚生成的骨架上跑：站里已经有 `docfirst.config.mjs`、
或者 `content/` 下已经有骨架之外的内容，它回一句「这个站已有内容，请人工接线」，一个字不改写。
给一个已经用了很久的站加 docfirst 就走这条路——人工接线，比自动改写 AST 安全。

### `docfirst.attach { dir, title? }`

- `dir`：**站目录**的绝对路径（约定是 `<仓>/docs-site`）。给成仓目录是最常犯的错，那时回
  「不是目录」或「不是 fumadocs 骨架」。
- `title`：站的显示名，不给就取仓根 `package.json` 的 `name`，再退回仓的目录名。

装的东西：六个集合（`source.config.ts`）、六条路由与侧栏六个根节点、`docfirst.config.mjs`、
mdx 接线（投影块与术语组件）、名册脚本、五个区的骨架页，`package.json` 里补上 docfirst 的依赖
与 `doc` / `doc:confirm` / `doc:render` / `verify:roster` 几条脚本。骨架自己那份
`src/app/docs/layout.tsx` 会被删掉（留着就是两层 DocsLayout 嵌套渲染，侧栏出现两遍）。

**只写文件**：不跑 `pnpm install`、不 render、不 check。回执里 `next` 就是接着要在那个仓里跑的
那几条：

```
cd <站目录>
pnpm install
pnpm doc:render     # 生成仓根 AGENTS.md / README.md（正本在 content/outputs/）
pnpm doc            # docfirst check
pnpm dev
```

仓根已经有 `README.md` / `AGENTS.md` 时回执里会多一条 `warn`：站里 outputs 预置了映射，
第一次 `doc:render` 会**覆盖**它们——先把内容搬进 `content/outputs/` 下对应的 mdx（那是正本），
再 render。装配自己一个字不动仓根。

起始页写了第一条引用怎么钉：钉完先提交，再 `pnpm doc:confirm`——git 比较器只认已提交、
工作区干净的内容。

## 核对 / 确认 / 渲染：自己在那个仓里跑

这几条**不经过工作台**。`cd` 到那个站目录（有 `docfirst.config.mjs` 的那个），跑：

```
pnpm doc                              核对。有红时退出码 1——那是核对结果，不是命令失败
pnpm docfirst check --json             机读报告：哪几页的钉码漂移了、哪个生成物过期了，一行 JSON
pnpm doc:confirm                      确认，把草稿记号换成正式记号。**先 commit**
pnpm doc:confirm content/docs/a.mdx   按页限定：只动点名的那几篇，别人没复核的黄灯不替他确认
pnpm doc:render                       重新生成 outputs 的生成物（README / AGENTS / SKILL.md 那类）
pnpm docfirst trajectory               列轨迹卡的盘 / 树 / 主干
```

**要看哪几页漂移了就跑带 `--json` 的那条**，自己读那份报告：`docs[].items[]` 里 `status` 是
`changed`（内容变了）或 `missing`（引用的目标不存在）的就是待重写；`line` 是记号在文档里的第几行、
`lines` 是被引段今天在源文件里的位置、`diff` 是变了的那几行——按这三样定位，**只改漂移的段落，
不重排全页**。`unconfirmed`（还没确认过）不算漂移。只有孤儿记录或名册外组件的页不用重写正文：
前者 `confirm` 清掉，后者在 `docfirst.config.mjs` 里补转成机读文本的规则。

哪个仓有站、站在哪，问站点插件的 `docs-site.list`。

## 跨仓反馈：投到目标仓站的 inbox

在 A 仓干活时发现 B 仓的东西不好用，**投进 B 仓自己站的反馈区**——`docs-site/content/feedback/inbox.mdx`
（早先生成的站有叫 `inbound.mdx` 的，投之前先看一眼），往末尾追加一节，不需要命令。格式（跟新站
模板生成的那一页一致）：

```
## <yyyy-MM-dd> <一句话标题>

来源：<哪个仓 / 哪次会话>

<正文：碰到什么、期望怎样、你觉得该改哪儿>
```

**每条都要写清来源**——哪个仓、哪次会话。只追加，不 commit、不动别人的条目；处理完的条目由
收件的仓删掉——收件页只放待处理的条目，不是档案。

**当场切换到目标仓投递代价太高**（手上的活做到一半、目标仓还没有站或收件页），先放进总控台的
`feedback/` 暂存目录（`D:\unitfolders\00000-console\console\feedback\`，一条一个文件，怎么攒、怎么分发见
那儿的 README），之后一并分发到目标仓的 inbox。**暂存目录不是终点，投完即删**——正本永远在目标仓自己的站里。

各仓自己的重复操作候选不投 inbox：那是那个站里的 `content/feedback/hatch.mdx`，仓内直接编辑。
反馈区两页分工：inbox 收别的仓投来的，hatch 收本仓自己的。

## 本插件还带着五份说明书

- **`docfirst-docs`**：文档站怎么写——六区怎么分、五类引用记号、每页写到哪为止。写或改任何仓的
  文档站之前先读它。
- **`trajectory`**：什么时候记一张轨迹卡、怎么写、卡的字段是什么。
- **`spec-grill`**：接到一句话需求，动代码之前怎么盘问到人点头。
- **`parallel-by-module`**：任务大到要派 subagent 时怎么按模块切分、什么必须串行。
- **`docs-governance`**：文档与注释治理——代码自解释扫描、术语统一、清除历史描述、所有权重新划分。

前两份讲的是 `@godcreator/docfirst-workflow` 那个包的行为，后三份讲通用开发纪律、不描述任何代码——但它们要跟钉码写法与六区对得上，所以正本同样放在那个包的仓（`docs-site/content/outputs/skills/`），
生成物随本插件发布——**包没有独立的途径让你读到**：它装在 `node_modules` 里，没有任何说明指向它，
一份说明书能被你读到全靠插件把自己包里那个目录 register 给了 skills 插件。


## 出错时

- 回「不是目录」：`dir` 给成了仓目录而不是站目录，或者骨架还没生成——先 `docs-site.create`
- 回「不是 fumadocs 骨架」：那个目录的 `package.json` 依赖里没有 `fumadocs-core` / `-mdx` / `-ui`
- 回「这个站已有内容，请人工接线」：那个站已经接过线、或 `content/` 下已经有人写过东西。
  本插件不改写任何东西，走人工接线那条路
- 想核对却找不到命令：**本插件没有那条命令**，自己 `cd` 到那个仓里跑（见上面那节）
