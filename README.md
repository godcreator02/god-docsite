# god-live-doc

**本页回答**：这套包是什么、怎么装、怎么确认它在干活、文档在哪。

## 是什么

把文档里对代码说的话钉在源码上：文档说「我引的是 `src/greet.ts` 第 2 到 3 行」「src 下有这四个文件」
「store.ts 里还有 save」，工具替你盯着。变了就报黄等作者复核，引用指向空气就报红。**文档里不存代码的
副本**——页面上那块是构建时现拿的，记忆只有一条指纹。

五类引用把「文件系统这根轴」填满：行段、整文件、目录树、存在性（含「断言不在」）、名字。

另一摊是**轨迹卡**：docfirst 治现状文档撒谎，轨迹卡治历史被改写——一次方向了断记下来就该冻结，
谁取代了谁看得见。卡不进记录簿、不用 confirm，只要即时校验；星轨盘在站上是一条独立的整页路由，
不是塞进 mdx 的组件。

## 怎么装

```bash
pnpm add -D @godcreator02/docfirst-workflow @godcreator02/docfirst-trajectory
```

`fumadocs` 与 `react` 在包里只是 **peer**，用你项目里装的那份；只跑命令行、不装 fumadocs 的仓
一个都不必装。站的接线从 `@godcreator02/docfirst-workflow/fumadocs` 进。

**站的构建配置里 `serverExternalPackages` 必须留空**：这个包里同时住着服务端那半与两个客户端
组件（状态点、术语），而那个字段按包名匹配、没有子路径粒度——外置的边界会把 `"use client"`
指令吃掉。

**装一个新站是两步，命令行不管这两步**：先铺一个标准 fumadocs 骨架（装了 fumadocs 的人才该有
那个能力，工作台里是站点插件的 `docs-site.create`），再由工作台插件 `@godcreator02/gwb-docfirst-workflow` 的
`docfirst.attach` 把六区装上。它**只在刚铺好的骨架上跑**：站里已经有 `docfirst.config.mjs`、或
`content/` 下已经有骨架之外的内容，就报一句「这个站已有内容，请人工接线」退非零，一个字不改写。

这两步都只在 agent 手上发生一次，所以不在这个包里——包留的是要在**仓**里反复发生的那几条。

## 怎么用

项目根放一份 `docfirst.config.mjs`（挂哪些格式、哪几区进 check、生成物摆哪），文档里写一行草稿记号：

```md
@@docfirst ref src/greet.ts:2-3 @@                       行段
@@docfirst ref config.json @@                            整文件（末尾追加也算变）
@@docfirst tree src @@                                   目录树；可带 depth=2、glob=*.test.ts
@@docfirst exists src/store.ts @@                        在；absent 是「断言不在」
@@docfirst has src/store.ts "export function save" @@    文件里有这个字面量
```

然后：

```bash
pnpm docfirst check                     # 只读，报状态。红退 1，黄和白退 0
pnpm docfirst confirm                   # 出记录、清孤儿、换记号、投影内容
pnpm docfirst confirm content/docs/a.mdx   # 只确认点名的那几篇
pnpm docfirst render                    # 挂了 outputs 映射的摆到落点；没挂的出一份给 AI 读的 md 落 out/
```

**跑通了的样子**：`check` 打出一行一处引用，每行带一个状态符号（🟢 新鲜 / 🟡 有变动 / ⚪ 未确认 /
🔴 缺失）；`confirm` 把草稿记号换成正式记号并写进记录簿，站上每个代码块的标题栏里多一个对应颜色的点。
门禁里挂 `pnpm docfirst check` 就行，它只在「引用指向空气」这一类真错上拦人。

`confirm` 之前**先 commit**：git 记忆只对已提交、且工作区干净的内容钉。有一处钉不住就整篇拒。

## 文档在哪

`docs-site/` 是这两个包的**六区文档站**，也是它们唯一的消费方——装的是工作区里的这两个包，钉的是
工作区里的真源码，所以仓里不另留示例。

```bash
cd docs-site
pnpm build && pnpm start        # 看 http://localhost:4310
pnpm docfirst check
```

六区各是什么：`content/docs/` 现状（进 check）、`content/trajectory/` 轨迹卡、`content/spec/` 在途的活、
`content/future/` 未来、`content/outputs/` 生成正本（进 check）、`content/feedback/` 反馈。
先读现状区的**系统地图**，再读要改的那块的模块页。

文档本身怎么写、六区怎么分、每页写到哪为止，正本是**随工作台插件发的 skill**，住
`packages/gwb-docfirst-workflow/skills/`：写文档读 `docfirst-docs`、落卡读 `trajectory`、装六区读 `docfirst`。
说明书跟着插件走而不是跟着包走，是因为包没有独立的到达路径——躺在 `node_modules` 里的一份
SKILL.md 没人指引、没人会读。通用开发纪律的三份也在这儿：接到需求先盘问读 `spec-grill`、
活大到要派 subagent 读 `parallel-by-module`、扫一遍代码让它自解释读 `self-explaining-code`。

**这份 README 是生成物**，正本是 `docs-site/content/outputs/readme.mdx`；仓根 `AGENTS.md` 同理。
改 mdx 源，`pnpm docfirst render` 重摆，两份一起提交。

## 这个仓自己怎么跑

```powershell
pnpm install
pnpm build          # 各包 tsdown，拓扑序
pnpm typecheck
pnpm test           # 先 build 再 node --test tests/*.test.ts

cd docs-site
pnpm docfirst check
pnpm test           # 站那头的接线（不起 Next）
pnpm build          # next build
node scripts/verify-roster.mjs

cd ../packages/gwb-docfirst-workflow
pnpm check && pnpm build      # 工作台插件自成一摊，用 vitest
```

改了格式包的代码，站要**先删 `.next` 再 build** 才看得见——Turbopack 只按 mdx 内容缓存。
调试站用 `next build` + `next start`，不用 dev。
