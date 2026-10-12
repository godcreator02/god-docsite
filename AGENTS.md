# 文档站地基与 docfirst 工作流

本文件有两份：Claude Code 读 `CLAUDE.md`（它是本仓 docs-site 的生成物），zcode 等客户端读 `AGENTS.md`（手写的正本），改这份同步那份的内容。

仓根是 pnpm 包工作区，住着两族东西：**地基**（文档站基础包与它的能力包、gwb-docsite 插件、自述站）与
**docfirst 文档工作流**（钉码 code-pin、星轨盘 trajectory-disk、命令行 docfirst-workflow、功能包 docsite-docfirst、
gwb-docfirst-workflow 插件、docs-site 文档站）。2026-10-12 前 docfirst 住在独立的 gwb-docfirst 仓，选型见
`docs-site/trajectory/2026-10-12-merge-into-docsite-kit.mdx`。

## 仓里有什么

| 目录 | 内容 |
| --- | --- |
| `packages/docsite-kit/` | 组合包 `@godcreator/docsite-kit`（只做接线）：功能包约定、路由挂载、vite 插件（经 Vite 处理源码包、TSX 标题刷新、推送通道服务） |
| `packages/docsite-identity/` 等 | 地基能力包：identity（人员与身份）、comments（评论）、page-sources（三种页面来源）、writing（术语与公式）、ui（界面外壳）、feed（推送通道）、explainer（讲解组件，自 gwb-docfirst 搬入，那边 0.1.1 冻结待切薄壳） |
| `packages/code-pin/`、`packages/trajectory-disk/` | 通用包：钉码核心、星轨盘。不认识 docfirst，谁都能单独使用 |
| `packages/docfirst-workflow/` | docfirst 本身：命令行、项目装配与格式，接到 fumadocs 站上的部分在子入口 `./fumadocs` |
| `packages/docsite-docfirst/` | 地基的功能包：remark 插件、Term 与文件树、星轨盘与卡页路由；`template/` 的起始物（docfirst.config.mjs、outputs 正本、两区起始页）从 docs-site 派生 |
| `packages/docfirst-explainer/` | 转发薄壳：`@godcreator/docsite-explainer` 的原出口名转发（正本已在本仓），装旧包名的站不用改代码 |
| `plugins/docsite/` | gwb 基础插件 `@godcreator/gwb-docsite`：身份码、一步建站（建站器在插件里，骨架模板从自述站派生）、托管站点、评论命令、说明书 `docsite` |
| `plugins/docfirst/` | gwb 插件 `@godcreator/gwb-docfirst-workflow`：`docfirst.create`（认站名、选端口、把 docsite-docfirst 交给 `gwbDocsite.init`）、说明书 `docs-site` / `docs-writing` / `trajectory` |
| `site/` | 自述站：讲地基与能力包，是**骨架的正本**——`app/` 与根目录的配置手写在这里，docsite 插件构建时派生建站模板（`plugins/docsite/template/`，构建产物不进 git） |
| `docs-site/` | docfirst 文档站：讲钉码/核对/轨迹卡，是 **docfirst 站的正本与示例**，骨架与自述站同代、手写 |
| `tests/` | 工作区级测试：`boundary.test.ts`（全仓边界守卫——地基不认识 docfirst、docfirst 单向用 docsite-kit）、`template-versions.test.ts`（模板版本盯守） |
| `trajectory/` | 地基侧轨迹卡，只增不改；docfirst 的轨迹卡在 `docs-site/trajectory/` |
| `probes/` | 实验材料，一个实验一个目录，照目录里 README 第一行就能重新运行 |

基础包的用法、项目骨架每个文件做什么，写在自述站 `site/content/` 里；docfirst 工作流的原理与操作写在 `docs-site/content/`，
动手前先看两站的首页与全局接缝图。

## 怎么跑

* `pnpm install` 之后 `pnpm build` 按依赖序构建全部包、两个插件与两个站；站点只用各包的构建产物
* `vite` 挂着 8.3.4 的补丁（`patches/vite@8.3.4.patch`，登记在仓根 `pnpm-workspace.yaml`）：Windows 上 Vite 对
  `import.meta.glob` 相对 base 的处理有缺陷，成因与验证见 `probes/2610121018_vite-add-discovery`。升级 vite 前先跑该 probe 的测试看上游修了没有
* 两个站的开发服务都交给 gwb-docsite 托管（`docsite.site.add`），不在会话里自己 `pnpm dev`；自述站在 4430、docs-site 在 4340。
  要写评论，开发服务的环境变量 `DOCSITE_IDENTITY_CODE` 要是站里 `people.json` 某人的码（经 gwb-docsite 启动时它自己给）
* **地基骨架直接改 `site/app/` 与根目录的配置（正本）**，docsite 插件的 `pnpm build` 会重新派生模板；骨架依赖有变化同步改
  插件的版本表 `plugins/docsite/src/scaffold/versions.ts`（`@godcreator` 系的精确版本）。docs-site 的骨架手写、与自述站同代，
  地基升级骨架时对照 `site/` 改过去
* 日常只用开发服务，`pnpm build` 只作提交前的检查
* 插件打包时带进各包的构建产物：改了包要先构建；在隔离 home 里验插件用 `devkit.dev`（说明书 gwb-devkit）
* 提交前的检查，每处都过才提交：仓根 `pnpm check`（根 tests 的类型检查 + 逐包 check）、`pnpm test`、`pnpm build`；
  `docs-site/` 里 `pnpm docfirst check`、`pnpm test`、`pnpm typecheck`、`pnpm build`；改了被钉的代码，本仓未提交改动引起的黄灯算红，
  照 `docs-site` 说明书处理后放进同一个提交
* 发版只用 `devkit.release`，包按依赖序排：能力包 → 组合包 → 插件；docfirst 侧的包与插件各发各的。升版本号前先读 skill「gwb-release」

## 规矩

* 包的方向由 `tests/boundary.test.ts` 唯一守卫：地基（docsite-\*）不认识 docfirst 任何包；通用包互不认识；
  docfirst 只有 docsite-docfirst 经 peer 用组合包 docsite-kit。改方向先改那张表并写明为什么
* `plugins/docfirst/src/deps.ts` 是写进新站的功能包版本表（精确号），`plugins/docfirst/tests/create.test.ts` 盯着它与
  工作区版本一致；`docsite-docfirst` 模板里 docfirst-workflow 的范围由根 `tests/template-versions.test.ts` 盯守
* 改了基础包或插件的行为、导出、命令，同一个提交里改对应站的说明页（插件还有随包的 SKILL.md，正本在 `docs-site/content/`，
  `pnpm docfirst render` 生成）；地基侧的说明页正本在 `site/content/`
* 仓根的 README.md 与 CLAUDE.md 是 `docs-site` outputs 的生成物（正本在 `docs-site/content/docs/outputs/`）；AGENTS.md 手写（本文件）
* 某条路走不通、做了选型、实验有了结论，当场写一张轨迹卡（地基侧 `trajectory/`、docfirst 侧 `docs-site/trajectory/`），只增不改
* 评论定位的回归页是自述站写作示例里的「收起内容试验」（`site/content/writing/collapse-test.mdx`）：改了评论定位，在它上面过一遍

## 只读参考

- 实验室 `D:\dshfiles\260901lab`（`step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，教学代码，**只读**，要用其中的逻辑就复制过来
- 老仓 `D:\dshfiles\26082711aju\god-live-doc`：用 git 取旧内容这项功能的出处，**只读**，功能已对齐不再参考
