# 文档站地基、docfirst 工作流与协作站

本文件有两份：Claude Code 读 `CLAUDE.md`（它是本仓 docs-site 的生成物），zcode 等客户端读 `AGENTS.md`（手写的正本），改这份同步那份的内容。

仓根是 pnpm 包工作区，住着三族东西：**地基**（文档站基础包与它的能力包、gwb-docsite 插件、自述站）、
**docfirst 文档工作流**（钉码 code-pin、星轨盘 trajectory-disk、命令行 docfirst-workflow、功能包 docsite-docfirst、
gwb-docfirst-workflow 插件）与**协作站**（数据模型包 collab-model、功能包 collab-site、合并检查包 collab-merge-check、
gwb-collab 插件）。docfirst 2026-10-12 自 gwb-docfirst 仓并入（选型卡 `docs-site/trajectory/2026-10-12-merge-into-docsite-kit.mdx`），
协作站 2026-10-13 自 collab-site 仓并入（旧仓在 gitea 上归档）。`docs-site/` 是全仓唯一的文档站：三族的说明、原理与 Gitea 部署都在它里面。

## 仓里有什么

| 目录 | 内容 |
| --- | --- |
| `packages/docsite-kit/` | 组合包 `@godcreator/docsite-kit`（只做接线）：功能包约定、路由挂载、vite 插件（经 Vite 处理源码包、TSX 标题刷新、推送通道服务） |
| `packages/docsite-identity/` 等 | 地基能力包：identity（人员与身份）、comments（评论）、page-sources（三种页面来源）、writing（术语与公式）、ui（界面外壳）、feed（推送通道）、explainer（讲解组件，自 gwb-docfirst 搬入，那边 0.1.1 冻结待切薄壳） |
| `packages/code-pin/`、`packages/trajectory-disk/` | 通用包：钉码核心、星轨盘。不认识 docfirst，谁都能单独使用 |
| `packages/docfirst-workflow/` | docfirst 本身：命令行、项目装配与格式，接到 fumadocs 站上的部分在子入口 `./fumadocs` |
| `packages/docsite-docfirst/` | 地基的功能包：remark 插件、Term 与文件树、星轨盘与卡页路由；`template/` 的起始物（docfirst.config.mjs、outputs 正本、两区起始页）从 docs-site 派生 |
| `packages/docfirst-explainer/` | 转发薄壳：`@godcreator/docsite-explainer` 的原出口名转发（正本已在本仓），装旧包名的站不用改代码 |
| `packages/collab-model/` 等 | 协作站三包：model（数据模型：仓布局、任务与模块格式、通知）、collab-site（功能包：任务页、日历与日志、通知栏）、merge-check（合并检查）。对基础包的依赖暂钉 `^0.1.x`，跟 0.3.0 的适配是 gitea 上 collab-site 仓的 issue #4 |
| `plugins/docsite/` | gwb 基础插件 `@godcreator/gwb-docsite`：身份码、一步建站（建站器在插件里，骨架模板从自述站派生）、托管站点、评论命令、说明书 `docsite` |
| `plugins/docfirst/` | gwb 插件 `@godcreator/gwb-docfirst-workflow`：`docfirst.create`（认站名、选端口、把 docsite-docfirst 交给 `gwbDocsite.init`）、说明书 `docs-site` / `docs-writing` / `trajectory` |
| `plugins/collab/` | gwb 插件 `@godcreator/gwb-collab`：协作仓与别的仓两套操作、通知交给站点/窗格/QQ/AI、项目与任务命令，站点交给 gwb-docsite |
| `site/` | 自述站：**骨架的正本**——`app/` 与根目录的配置手写在这里，docsite 插件构建时派生建站模板（`plugins/docsite/template/`，构建产物不进 git）；内容只剩最小示例与评论定位回归页 |
| `docs-site/` | 全仓文档站：三族的说明、fumadocs 原理、维护者手册与随插件发布的说明书正本（outputs），骨架与自述站同代、手写；轨迹卡三族并在站点根 `trajectory/` |
| `tests/` | 工作区级测试：`boundary.test.ts`（全仓边界守卫——地基不认识 docfirst、docfirst 单向用 docsite-kit）、`template-versions.test.ts`（模板版本盯守） |
| `probes/` | 实验材料，一个实验一个目录，照目录里 README 第一行就能重新运行 |

全部说明都在 `docs-site/content/` 的六个分区里（总览与原理、docsite、docfirst、collab、gitea、维护者手册），
动手前先看总览页的体系地图。

## 怎么跑

* `pnpm install` 之后 `pnpm build` 按依赖序构建全部包、三个插件与两个站；站点只用各包的构建产物
* `vite` 挂着 8.3.4 的补丁（`patches/vite@8.3.4.patch`，登记在仓根 `pnpm-workspace.yaml`）：Windows 上 Vite 对
  `import.meta.glob` 相对 base 的处理有缺陷，成因与验证见 `probes/2610121018_vite-add-discovery`。升级 vite 前先跑该 probe 的测试看上游修了没有
* 两个站的开发服务都交给 gwb-docsite 托管（`docsite.site.add`），不在会话里自己 `pnpm dev`；自述站在 4430、docs-site 在 4340。
  要写评论，开发服务的环境变量 `DOCSITE_IDENTITY_CODE` 要是站里 `people.json` 某人的码（经 gwb-docsite 启动时它自己给）
* **地基骨架直接改 `site/app/` 与根目录的配置（正本）**，docsite 插件的 `pnpm build` 会重新派生模板；骨架依赖有变化同步改
  插件的版本表 `plugins/docsite/src/scaffold/versions.ts`（`@godcreator` 系的精确版本）。docs-site 的骨架手写、与自述站同代，
  地基升级骨架时对照 `site/` 改过去
* 日常只用开发服务，`pnpm build` 只作提交前的检查
* 插件打包时带进各包的构建产物：改了包要先构建；在隔离 home 里验插件用 `devkit.dev`（说明书 gwb-devkit）
* 测试按节奏跑，不是每次全量：改代码过程中 `pnpm exec vitest run --changed`（或点名文件）；提交前跑**改到的包**全量；
  仓根 `pnpm check`（逐包 check，plugins/collab 的 `pnpm test` 默认排除 `tests/verified/`）、`pnpm test`、`pnpm build`；
  `docs-site/` 里 `pnpm docfirst check`、`pnpm test`、`pnpm typecheck`、`pnpm build`；改了被钉的代码，本仓未提交改动引起的黄灯算红，
  照 `docs-site` 说明书处理后放进同一个提交
* `plugins/collab` 的 `tests/verified/` 是**已验证的行为假设**（整组织克隆、ahead/behind 语义、文件监视事件）：断言对着 git 与
  watcher 本体，日常不跑。四种信号下跑 `pnpm test:verified`：升 git 或关键依赖、动了 `src/organization/setup/` 或
  `src/other-repos/fetch/`、发版前、用户或 agent 明确要求
* 发版只用 `devkit.release`，包按依赖序排：能力包 → 组合包 → 插件；docfirst 侧各发各的；协作站按
  collab-model → collab-merge-check → collab-site → plugins/collab 的顺序，发前跑一遍 `pnpm test:verified`。升版本号前先读 skill「gwb-release」

## 规矩

* 包的方向由 `tests/boundary.test.ts` 唯一守卫：地基（docsite-\*）不认识 docfirst 任何包；通用包互不认识；
  docfirst 只有 docsite-docfirst 经 peer 用组合包 docsite-kit。改方向先改那张表并写明为什么
* `plugins/docfirst/src/deps.ts` 是写进新站的功能包版本表（精确号），`plugins/docfirst/tests/create.test.ts` 盯着它与
  工作区版本一致；`docsite-docfirst` 模板里 docfirst-workflow 的范围由根 `tests/template-versions.test.ts` 盯守
* 改了基础包或插件的行为、导出、命令，同一个提交里改 `docs-site/content/` 对应分区的说明页（插件还有随包的 SKILL.md，
  正本在 `docs-site/content/docs/outputs/skills/`，`pnpm docfirst render` 生成）
* 仓根的 README.md 与 CLAUDE.md 是 `docs-site` outputs 的生成物（正本在 `docs-site/content/docs/outputs/`）；AGENTS.md 手写（本文件）
* 某条路走不通、做了选型、实验有了结论，当场写一张轨迹卡（三族统一放 `docs-site/trajectory/`），只增不改
* 评论定位的回归页是自述站写作示例里的「收起内容试验」（`site/content/writing/collapse-test.mdx`）：改了评论定位，在它上面过一遍

## 只读参考

- 实验室 `D:\dshfiles\260901lab`（`step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，教学代码，**只读**，要用其中的逻辑就复制过来
- 老仓 `D:\dshfiles\26082711aju\god-live-doc`：用 git 取旧内容这项功能的出处，**只读**，功能已对齐不再参考
