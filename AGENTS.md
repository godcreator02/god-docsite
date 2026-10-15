# god-docsite：文档站平台、功能包与 gwb 插件

本文件有两份：Claude Code 读 `CLAUDE.md`（它是本仓 docs-site 的生成物），zcode 等客户端读 `AGENTS.md`（手写的正本），改这份同步那份的内容。

仓根是 pnpm 包工作区。任何站点都是「fumadocs 官方 React Router 模板 + 挑选的功能包」：平台包 `god-docsite` 带唯一的站点模板与建站器，
功能包按功能划分、名字不带站点类型，各自经 fumadocs 与 React Router 原生的扩展点接入站点（站点 `app/features/<包>/` 里的接线文件由建站器写入）。
重构方案见仓外的 `D:\unitfolders\oz47p-docsite-kit\refactor-plan.html`；`docs-site/` 是全仓唯一的文档站。

## 仓里有什么

| 目录 | 内容 |
| --- | --- |
| `packages/god-docsite/` | 平台包：三种页面来源、布局与侧栏、搜索、llms、推送（SSE）、术语标注、vite 插件 `godDocsite()`；`template/` 是唯一的站点模板，`./scaffold` 是建站器（建站、加功能、重写功能汇总文件）；react、fumadocs、vite 等 peer 全标可选，只用建站器的 Node 使用方（gwb-docsite）不连带装它们 |
| `packages/identity/`、`packages/comments/` | 身份（people.json、身份码、给浏览器的公开投影）与评论（评论文件、唯一一份写入 action、评论面板与正文定位）；基础站默认装这两个。comments 的 `template/` 是全站评论页（也是评论写入的 `/comments` action）、侧栏入口、样式与正文高亮，建站、装完依赖后由建站器 `addBaseFeatures` 补进站点 `app/features/comments/` |
| `packages/explainer/` | 讲解组件与它们给生成物用的机读文字 |
| `packages/code-pin/`、`packages/doc-export/`、`packages/trajectory/` | 钉码、生成物（mdx 正本生成 AGENTS.md / README / SKILL.md）、轨迹卡与星轨盘 |
| `packages/docfirst/` | 命令行 `docfirst`：读 `docfirst.config.mjs`，把 check / render / confirm 分派给上面三个功能包；`template/` 是文档维护的起始物 |
| `packages/collab/` | 项目协作：任务与模块、日志与日历、通知、合并检查（命令行 `collab-merge-check`）、记录链接 |
| `plugins/docsite/` | gwb 插件 `@godcreator/gwb-docsite`：身份码、建站与加功能（调平台包的建站器）、托管站点、评论命令、服务 `gwbDocsite` |
| `plugins/docfirst/` | gwb 插件 `@godcreator/gwb-docfirst-workflow`：`docfirst.create`（经 `gwbDocsite` 建站、加 code-pin / trajectory / explainer、把 docfirst 起始物复制到站点根上）、说明书 `docs-site` / `docs-writing` / `trajectory` |
| `plugins/collab/` | gwb 插件 `@godcreator/gwb-collab`：协作仓与别的仓两套操作、通知交给站点/窗格/QQ/AI、项目与任务命令，站点交给 gwb-docsite；`collab.site.init` 在加协作功能、启动服务之前建好仓根 `collab/` 与 `site/journal/`（站点运行时写入它们），仓里还没有自动合并工作流时照 collab 包的模板写出 `.gitea/workflows/collab-auto-merge.yaml`（版本范围填打包时的 collab 版本） |
| `collab-test/` | 本仓的测试站：协作仓形态（`collab/records/` 测试数据 + `site/`），`site/` 是基础站装上全部功能（collab、code-pin、trajectory、explainer），依赖 `workspace:^` 直连本仓的包、不 init git；e2e 用的页面（评论定位回归页、TSX 页、HTML 页、术语与公式、钉码页与被钉的 `src/greet.ts`、轨迹卡）都在它里面；gwb-docsite 托管（端口 4450） |
| `docs-site/` | 全仓文档站：说明、原理、维护者手册与随插件发布的说明书正本（outputs）；轨迹卡在站点根 `trajectory/` |
| `e2e/` | 端到端检查：`run.mjs` 直接在 `collab-test/site` 上启动 dev 与 build + start，各跑一轮浏览器检查（`checks/` 下 base、collab、docs、all-features 四组）；`pack.mjs` 是发版前的打包检查：各包 `pnpm pack`、测试站复制到系统临时目录按 `file:` 装好，跑同样的检查 |
| `scripts/` | `scaffold-check.mjs`：用建站器把 collab-test 与 docs-site 生成到临时目录，和仓里比对建站器负责的文件 |
| `probes/` | 实验材料，一个实验一个目录，照目录里 README 第一行就能重新运行；引用的旧包名保持原样 |

## 怎么跑

* `pnpm install` 之后 `pnpm build` 按依赖序构建全部包、三个插件与两个站；站点只用各包的构建产物
* 依赖不打补丁：dev 下新增内容文件的即时出现由平台包的 vite 插件负责（不再靠 vite 补丁），功能包路由经站点 `app/features/` 的接线文件登记
  （不再靠 React Router 补丁），为什么能删见轨迹卡 `docs-site/trajectory/2026-10-15-drop-dependency-patches.mdx`
* 站点的开发服务都交给 gwb-docsite 托管（`docsite.site.add`），不在会话里自己 `pnpm dev`；docs-site 在 4340、collab-test 在 4450。
  要写评论，开发服务的环境变量 `DOCSITE_IDENTITY_CODE` 要是站里 `people.json` 某人的码（经 gwb-docsite 启动时它自己给）
* **站点骨架只改 `packages/god-docsite/template/`**，功能包的接线文件只改各包的 `template/`；docs-site、collab-test/site 的 `app/` 由建站器写出，
  改了模板用建站器重新生成它们。`pnpm scaffold:check`（几秒钟）比对两个站和建站器生成的是否一致，站点自己维护的文件名单写在 `scripts/scaffold-check.mjs` 里
* 插件打包时带进各包的构建产物：改了包要先构建；在隔离 home 里验插件用 `devkit.dev`（说明书 gwb-devkit）
* 每个包都有 `build`、`typecheck`、`test`、`check`（`check` 先 typecheck 再 test，有 `lint` 的再 lint）；仓根 `pnpm check` 逐个包跑 check
  （`--workspace-concurrency=1`：几个包的测试大量调 git，并行时超时；docs-site 没有 check，它的检查见下），
  `pnpm test` 是 `pnpm -r test`，`pnpm depcheck` 跑 dependency-cruiser（要先 `pnpm build`，包之间按包名 import 时解析到对方的 `dist/`）
* 测试按节奏跑，不是每次全量：改代码过程中只跑改到的包（`pnpm --filter <包> check`），e2e 可以只跑一轮（`pnpm e2e --server=dev`）；
  **合并分支前跑 `pnpm verify`**：`pnpm build` → `pnpm check` → `pnpm depcheck` → `pnpm scaffold:check` → `pnpm e2e`（`--skip-build`，不再重复构建）。
  `pnpm e2e` 不建站、不装依赖，直接测 collab-test，一分钟左右；它在站里新建的评论、任务、临时内容页都带本次运行编号，每轮跑完删掉，
  最后一项检查 `git status collab-test` 和跑之前一样（多出、少了的路径会列出来）。日志与 `report.json` 在 `%TEMP%/god-docsite-e2e/repo-<运行时刻>/`。
  `docs-site/` 里 `pnpm docfirst check`、`pnpm typecheck`、`pnpm build`；
  改了被钉的代码，本仓未提交改动引起的黄灯算红，照 `docs-site` 说明书处理后放进同一个提交
* **发版前再跑 `pnpm e2e:pack`**：查只有装成 tarball 才会露出来的问题（包的 `files` 漏了文件、`exports` 指错、依赖没写进 `dependencies`、类型对不上）。
  它把测试站依赖的包 `pnpm pack`、collab-test 复制到 `%TEMP%/god-docsite-e2e/pack-<运行时刻>/`、依赖换成 `file:<tarball>` 装好、typegen + tsc，
  再跑和 `pnpm e2e` 完全相同的检查；装依赖要一两分钟，日常不跑
* `plugins/collab` 的 `tests/verified/` 是**已验证的行为假设**（整组织克隆、ahead/behind 语义、文件监视事件）：断言对着 git 与
  watcher 本体，日常不跑。四种信号下跑 `pnpm test:verified`：升 git 或关键依赖、动了 `src/organization/setup/` 或
  `src/other-repos/fetch/`、发版前、用户或 agent 明确要求
* 发版只用 `devkit.release`，包按依赖序排：第 0 层（god-docsite、identity、explainer、code-pin、trajectory）→ 第 1 层（comments、doc-export）→
  第 2 层（collab、docfirst）→ 插件；发前跑 `pnpm verify` 与 `pnpm e2e:pack`，协作侧再跑一遍 `pnpm test:verified`。升版本号前先读 skill「gwb-release」

## 规矩

* 包的方向由 dependency-cruiser（`.dependency-cruiser.cjs`，`pnpm depcheck`）唯一负责检查：comments → identity；doc-export → code-pin；
  collab → identity、comments；docfirst → code-pin、doc-export、trajectory；report → comments；god-docsite 不依赖任何功能包，
  功能包也不依赖 god-docsite；除此之外功能包互不依赖；包内 `core/`、`node/`、`site/`、`cli/` 的分层也在那里。改方向先改那张表并写明为什么
* 改了基础包或插件的行为、导出、命令，同一个提交里改 `docs-site/content/` 对应分区的说明页（插件还有随包的 SKILL.md，
  正本在 `docs-site/content/docs/outputs/skills/`，`pnpm docfirst render` 生成）
* 仓根的 README.md 与 CLAUDE.md 是 `docs-site` outputs 的生成物（正本在 `docs-site/content/docs/outputs/`）；AGENTS.md 手写（本文件）
* 某条路走不通、做了选型、实验有了结论，当场写一张轨迹卡（放 `docs-site/trajectory/`），只增不改
* 评论定位的回归页是测试站里的「收起内容试验」（`collab-test/site/content/writing/collapse-test.mdx`），e2e 的 base 组在它上面检查
* e2e 不改仓里已跟踪的文件：要写的检查只写本次运行新建、带运行编号的东西，跑完删掉。加新检查也照这个做，不改已跟踪的页、不回退文件
  （别的会话可能同时在改这个仓）

## 只读参考

- 实验室 `D:\dshfiles\260901lab`（`step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，教学代码，**只读**，要用其中的逻辑就复制过来
- 老仓 `D:\dshfiles\26082711aju\god-live-doc`：用 git 取旧内容这项功能的出处，**只读**，功能已对齐不再参考
