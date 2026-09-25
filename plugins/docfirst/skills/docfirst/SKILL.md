---
name: docfirst
description: 要给一个仓建一个接好 docfirst 分区的文档站时用；要核对一个站里的现状有没有漂移、要确认引用、要重新生成生成物时也读它——那几件事不经过这个插件，是自己 cd 到那个仓里跑 pnpm doc，这份说清了跑哪几条；跨仓反馈投到哪儿、什么格式也在这儿。
---

# docfirst 插件：建站，带五份说明书

本插件只有**一条命令**：`docfirst.create`——给一个仓建一个接好 docfirst 分区的文档站。
除此之外它只做一件事：把另外五份说明书注册给你读。

**它对 `@godcreator/docfirst-workflow` 那个包零依赖**，装了本插件不必再装什么包。判据是「这件事在哪儿发生」：
核对 / 确认 / 渲染要在**仓**里发生（那是门禁与站构建要跑的东西），你自己 `cd` 过去跑；只在你手上发生一次的
（读说明书、给一个仓建一次站）才归插件。**插件不转发命令行。**

**站的管理归站点插件**（`@godcreator/gwb-docs-site`，命令 `docs-site.*`）：判断 build 是不是最新、挑空闲端口启动与停止、
到时间自动关闭、站的窗格；建站时跑官方脚手架 `create-fumadocs-app`、套本机约定（端口、页面语言、字体、站名等）与写盘也归它。本插件依赖它：
没装站点插件的 home 里本插件不加载。站建好以后要改结构（加分区、加组件）、要跑 `dev` / `build`，读站点插件的说明书 `docs-site`。

## 建一个新站：一条命令

```
docfirst.create {"dir":"<仓>/docs-site"}
```

站约定放在仓根下的 `docs-site/`。站点插件的 `docs-site.create` 先跑官方脚手架、套本机约定，本插件算好在官方输出上
替换、删除、新增哪些文件（分区、`docfirst.config.mjs`、mdx 接线、名册脚本、各区的起始页）与 docfirst 的依赖、脚本，
交给它一起写盘。**站目录必须还不存在**：
已经有站的仓不能用这条命令，给一个已经用了很久的站加 docfirst，走人工接线。

### `docfirst.create { dir, title?, port? }`

- `dir`：**站目录**的绝对路径（约定是 `<仓>/docs-site`）。它必须还不存在，上一级（仓目录）必须已经存在。
- `title`：站的显示名，不给就依次用仓根 `package.json` 的 `title`、包名去掉 scope、仓的目录名。
- `port`：站的端口，不给由站点插件挑一个没被占用的。

建出来的东西：官方脚手架的站（搜索、llms 路由照旧），加上三个集合（`src/lib/source.ts` 里用 fumadocs-mdx 的 macro
写的 docs、trajectory、future，现状集合经 `applyMdxPreset(docfirstMdxOptions(...))` 接上 docfirst）、三条路由与侧栏三个根节点、
`docfirst.config.mjs`、mdx 接线（`src/components/mdx.tsx` 里的状态点组件）、样式 `src/app/docfirst.css`、名册脚本、
各区的起始页（`content/docs/` 下的入口页、
术语表与 `outputs/` 下的三份生成正本，`content/trajectory/` 与 `content/future/` 各一页），`package.json` 里
有 docfirst 的依赖与 `doc` / `doc:confirm` / `doc:render` / `verify:roster` 几条脚本。

**只写文件**：不跑 `pnpm install`、不 render、不 check。回执里 `next` 就是接着要在站目录里跑的那几条：

```
cd <站目录>
pnpm install
pnpm doc:render     # 生成仓根 README.md / AGENTS.md / CLAUDE.md（正本在 content/docs/outputs/）
pnpm doc            # docfirst check
pnpm dev
```

仓根已经有 `README.md` / `AGENTS.md` / `CLAUDE.md` 时回执里会多一条 `warn`：第一次 `doc:render` 会**覆盖**它们
——先把内容移进 `content/docs/outputs/` 下对应的 mdx（那是正本），再 render。建站本身一个字不动仓根。

## 核对 / 确认 / 渲染：自己在那个仓里跑

这几条**不经过工作台**。`cd` 到那个站目录（有 `docfirst.config.mjs` 的那个，约定是 `<仓>/docs-site`），跑：

```
pnpm doc                                       核对。有红时退出码 1——那是核对结果，不是命令失败
pnpm docfirst check --json                      机读报告：哪几页的钉码漂移了、哪个生成物过期了，一行 JSON
pnpm doc:confirm                               机械写回：草稿换成正式记号、挪了位置的写回新行号、重新渲染生成正本
pnpm doc:confirm content/docs/a.mdx --accept   复核过后，签掉点名页里的黄灯
pnpm doc:render                                只重新生成生成物（README / AGENTS / SKILL.md 那类）
pnpm docfirst trajectory                        列轨迹卡的盘 / 树 / 主干
```

**改了被钉的代码，就在同一个提交里处理它引起的黄灯**：钉住的文件在本仓有未提交改动、内容又变了的黄灯，
`pnpm doc` 算红。先 `doc:confirm` 做完机械写回，再逐条看剩下的黄灯，论断还成立就 `--accept`，不成立先改论断。
`--accept` 必须点名页，别人没复核的黄灯不替他签。确认不要求先提交。

**要看哪几页漂移了就跑带 `--json` 的那条**，自己读那份报告：`docs[].items[]` 里 `status` 是 `changed`（内容变了）
或 `missing`（引用的目标不存在）的就是待重写；`line` 是记号在文档里的第几行、`lines` 是被引段今天在源文件里的
位置、`diff` 是变了的那几行——按这三样定位，**只改漂移的段落，不重排全页**。`unconfirmed`（还没确认过）不算漂移。
只有名册外组件的页不用重写正文：在 `docfirst.config.mjs` 里补转成机读文本的规则。

## 跨仓反馈：投进目标仓站的 `future/inbox/`

在 A 仓工作时发现 B 仓的东西不好用，**直接投进 B 仓自己站的未来区**：新建一个文件
`docs-site/content/future/inbox/<yyyy-MM-dd>-<来源仓>-<英文短标题>.mdx`，不需要命令。文件名用英文小写和短横线
（git 会把中文路径显示成八进制转义），中文标题写进 `title`。格式：

```
---
title: <一句话标题>
description: 来源：<哪个仓 / 哪次会话>
---

<正文：碰到什么、期望怎样、证据在哪、你觉得该改哪儿>
```

然后在 B 仓里 `git add` 这个文件、`git commit --only` 这个文件。一条一个文件，所以不会跟 B 仓里别人未提交的
改动冲突，也不用等。处理完由收件的仓删掉这个文件，结论写进现状页或轨迹卡——inbox 只放待处理的条目，不是档案。

## 本插件还带着五份说明书

- **`docfirst-docs`**：文档站怎么写——分区怎么分、五类引用记号、每页写到哪为止、钉码怎么确认。
  写或改任何仓的文档站之前先读它。
- **`trajectory`**：什么时候记一张轨迹卡、怎么写、卡的字段是什么。
- **`spec-grill`**：接到一句话需求，动代码之前怎么问到人同意。
- **`parallel-by-module`**：任务大到要派子代理时怎么按模块切分、什么必须串行。
- **`docs-governance`**：文档与注释治理——代码自解释扫描、术语统一、清除历史描述、分清谁负责什么。

这几份连同这一份，正本都在 `@godcreator/docfirst-workflow` 那个包的仓里（`docs-site` 的生成正本），生成物随本插件
发布——**包没有独立的途径让你读到**：它装在 `node_modules` 里，没有任何说明指向它，一份说明书能被你读到全靠插件
把自己包里那个目录注册给了 skills 插件。

## 出错时

- 回「dir 要是绝对路径」：给了相对路径，插件在工作台主进程里运行，不知道该相对于哪个目录
- 回「站目录的上一级要是已经存在的仓目录」：`dir` 多写或少写了一层，或者仓还没建
- 回「docs-site.create 没建成：……」：后面是站点插件的原话。最常见的是站目录已经存在（这个仓已经有站，
  走人工接线），其次是跑官方脚手架要联网没联上、端口冲突，或脚手架的输出变了、本插件的文件清单对不上
  （新增的已经有、替换或删除的没有），照原话处理
- 回「不认识的参数」：只收 `dir`、`title`、`port` 三个
- 想核对却找不到命令：**本插件没有那条命令**，自己 `cd` 到那个仓里跑（见上面那节）
