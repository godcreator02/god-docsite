# god-live-doc

**本页回答**：这套包是什么、怎么装、怎么确认它在正常工作、文档在哪。

## 是什么

把文档里对代码说的话钉在源码上：文档说「我引的是 `src/greet.ts` 第 2 到 3 行」「src 下有这四个文件」
「store.ts 里还有 save」，工具替你检查这些话还成不成立。变了就报黄等作者复核，引用指向的东西不在了就报红。**文档里不存代码的
副本**——页面上那块是构建时现从源码读的，确认时的记录就写在记号自己身上：一段指纹，加上确认时那份文件的 blob 名。

五类引用覆盖文件系统上能说的几类事：行段、整文件、目录树、存在性（含「断言不在」）、名字。

另一部分是**轨迹卡**：docfirst 防止现状文档与代码不符，轨迹卡防止历史被改写——一次方向上的决定
记下来就不再改，谁取代了谁看得见。卡不钉码、不用 confirm，`check` 时一并校验；星轨盘在站上是一条独立的整页路由，
不是放进 mdx 的组件。

## 怎么装

```bash
pnpm add -D @godcreator/docfirst-workflow @godcreator/docfirst-fumadocs
```

`@godcreator/docfirst-workflow` 是命令行、项目装配与 mdx 格式，`@godcreator/docfirst-fumadocs` 是站的 fumadocs 接线；
钉码核心 `@godcreator/docfirst-pin` 与轨迹核心 `@godcreator/docfirst-trajectory` 随它们装上。`fumadocs` 与 `react`
只是 fumadocs 接线的 **peer**，用你项目里装的那份；只跑命令行、不装 fumadocs 的仓只装 `@godcreator/docfirst-workflow`。

**站的构建配置里 `serverExternalPackages` 必须留空**：`@godcreator/docfirst-fumadocs` 里同时有服务端代码与客户端
组件（状态点），而那个字段按包名匹配、没有子路径粒度——外置之后 `"use client"` 指令会丢掉；星轨盘的客户端组件在
`@godcreator/docfirst-trajectory` 里，同样不能外置。

**建一个新站用工作台插件，命令行不管这一步**：工作台插件 `@godcreator/gwb-docfirst-workflow` 的
`docfirst.create {"dir":"<仓>/docs-site"}` 一步建好接了三个区（现状 `docs`、轨迹 `trajectory`、未来 `future`）的站；
不接 docfirst 的普通 fumadocs 站用 `docfirst.create-plain`，参数相同。两条都运行官方脚手架 `create-fumadocs-app`、
应用本机约定、挑端口并写盘，`docfirst.create` 再在官方输出上增、换、删几份文件。站目录必须还不存在；给一个用了很久的站加 docfirst 走人工接线。

建站只在 agent 手上发生一次，所以不在这几个包里——包留的是要在**仓**里反复发生的那几条。

## 怎么用

项目根放一份 `docfirst.config.mjs`（用哪些格式——通常是 `@godcreator/docfirst-workflow/mdx`、内容根在哪、组件名册、生成物写到哪）。内容根下 `trajectory/` 是轨迹卡、
`future/` 是未来区，其余目录都是现状区、都进核对，不用登记。文档里写一行草稿记号：

```md
@@docfirst ref src/greet.ts:2-3 @@                       行段
@@docfirst ref config.json @@                            整文件（末尾追加也算变）
@@docfirst tree src @@                                   目录树；可带 depth=2、glob=*.test.ts
@@docfirst exists src/store.ts @@                        在；absent 是「断言不在」
@@docfirst has src/store.ts "export function save" @@    文件里有这个字面量
```

然后：

```bash
pnpm docfirst check                                 # 只读，报状态。红退 1；本仓未提交改动引起的黄也算红
pnpm docfirst confirm                               # 机械写回：草稿换成正式记号，挪了位置的写回新行号，重新生成生成物
pnpm docfirst confirm content/docs/a.mdx --accept   # 复核过后，接受点名页里的黄灯；必须点名页
pnpm docfirst render                                # 只把 outputs 里有映射的生成正本渲染到落点
```

**正常工作的样子**：`check` 打出一行一处引用，每行带一个状态符号（🟢 新鲜 / 🟡 有变动 / ⚪ 未确认 /
🔴 缺失）；`confirm` 把草稿记号换成正式记号、把记录写进记号的属性，站上每个代码块的标题栏里多一个对应颜色的点。
门禁里加上 `pnpm docfirst check` 就行。**改了被钉的代码，就在同一个提交里处理它引起的黄灯**：
先 `confirm`，再逐条复核剩下的黄灯、点名页 `--accept`。确认不要求先提交。

## 文档在哪

`docs-site/` 是这几个包的文档站，也是它们唯一的使用方——装的是工作区里的这几个包，钉的是
工作区里的真源码，所以仓里不另留示例。

```bash
cd docs-site
pnpm build && pnpm start        # 看 http://127.0.0.1:4310
pnpm docfirst check
```

先读现状区的**系统地图**（四个包与它们之间的接缝），再读要改的那块的模块页。

文档本身怎么写、分区各放什么、每页写到哪为止，正本是**随工作台插件发的 skill**，在
`plugins/docfirst/skills/`：写文档读 `docfirst-docs`、写轨迹卡读 `trajectory`、建站读 `docfirst`、
设计站的页面与组件、构建站读 `docs-site`。
说明书随插件发布而不随包发布，是因为包没有独立的途径让 agent 读到——放在 `node_modules` 里的一份
SKILL.md 没有说明指向它、没人会读。通用开发纪律的三份也在这儿：接到需求先盘问读 `spec-grill`、
任务大到要派子代理读 `parallel-by-module`、治理文档与注释读 `docs-governance`。

**这份 README 与仓根 `AGENTS.md`、`CLAUDE.md` 是生成物**，改 `docs-site/content/docs/` 下的 mdx 正本再 `pnpm docfirst render`。

## 这个仓自己怎么跑

```powershell
pnpm install
pnpm build          # plugins/ 与 packages/ 下各自构建（插件 tsc、五个包 tsdown），拓扑序
pnpm typecheck
pnpm test           # 先 build 再 node --test tests/*.test.ts

cd docs-site
pnpm docfirst check
pnpm test           # 站这一侧的接线（不启动 Next）
pnpm build          # next build
node scripts/verify-roster.mjs

cd ../plugins/docfirst
pnpm check && pnpm build      # 工作台插件单独一套门禁，用 vitest
```

改了站构建时 remark 插件会跑到的包代码（`packages/docfirst-fumadocs/`，连同它调用的 workflow 与 pin），站要**先删 `.next` 再 build** 才看得见——Turbopack 只按 mdx 内容缓存。
调试站用 `next build` + `next start`，不用 dev。
