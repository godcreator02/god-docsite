# gwb-docfirst

**仓根就是这个目录 `gwb-docfirst/`**，它同时是 pnpm 包工作区。上一级是单元目录，那儿只有一张
出生证 `unit.json`，不在 git 里。布局照 devkit 的 workspace 仓：`plugins/docfirst/` 是工作台插件 `@godcreator/gwb-docfirst-workflow`，
`packages/` 下是 npm 包：通用包 `code-pin`（钉码核心）、`trajectory-disk`（星轨盘）不认识 docfirst，谁都能单独使用；
docfirst 自己的包是 `docfirst-workflow`（命令行、项目装配与格式，接到 fumadocs 站上的部分在子入口 `./fumadocs`）与
`docfirst-explainer`（docfirst 站上用的讲解组件：分步、动画、选情况模板与零件，还有画接缝图的 `SeamDiagram`）。`docs-site/` 是自己的 fumadocs 文档站（用这套机制写自己的文档；站用 `workspace:*`
引这几个包，也是工作区成员，这是本仓有意的例外），`tests/` 是工作区级测试。
**怎么装、怎么接、怎么运行，看 `README.md`**，这儿不复述。

使用方示例不在仓里：`docs-site` 就是「装了这几个包的项目」，钉的是工作区里的实际源码。
星轨盘的诗名 fixture 在 `tests/fixtures/trajectory/`，轨迹卡在 `docs-site/content/trajectory/`。

README、CLAUDE.md、这份规矩与插件里的 SKILL.md 都是**生成物**：正本是 `docs-site/content/` 下的 mdx
（这份的正本是 `docs-site/content/maintain/agents.mdx`，其余在 `docs-site/content/docs/outputs/`），对应关系看
`docs-site/docfirst.config.mjs` 的 `outputs`。改 mdx 正本，`pnpm docfirst render` 重新生成，正本和生成物放进同一个提交。

**动手前先读文档站**：先看首页 `docs-site/content/docs/index.mdx` 的全局接缝图，每个包一个目录
（如 `content/docs/pin/`）：目录首页是这个包的接缝与接口，讲原理的页跟在它下面；改这个仓要知道的（布局、提交前的检查、测试与边界）在 `content/maintain/`；接口与边界逐条钉在实际源码上。文档怎么写、分区怎么分、钉码怎么确认，
正本是随工作台插件发的 skill「docfirst-docs」（生成物在
`plugins/docfirst/skills/docfirst-docs/SKILL.md`），动文档前读它。
**改了被钉的代码，就在同一个提交里处理它引起的黄灯**：本仓未提交改动引起的黄灯，`pnpm docfirst check` 算红。

## 参考，不要改

- 实验室 `D:\dshfiles\260901lab`（台阶七 `step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，
  教学代码，**只读**。要用它的逻辑就复制过来，别 import 它。它在 `D:\dshfiles`（DSH 时代的归档区），
  本仓在 `D:\unitfolders` 下的单元里，这条引用跨出了 `D:\unitfolders`。
- 老仓 `D:\dshfiles\26082711aju\god-live-doc`（同在 `D:\dshfiles`）：用 git 取旧内容这项功能的出处，**只读**。
  功能已对齐，不再参考，代码只看这个仓。

## 规矩

- 中文写注释、文档、提交信息；标识符英文。注释只写现状，不写「原来怎么样」。
- TS，pnpm，测试用 `node --test`（工作区里的测试是 `.ts`，Node 直接运行；站里的是 `.mjs`）。
  **例外只有工作台插件**：它用 vitest，跟 devkit 生成的插件初始文件一致，不为一个插件改那套配置。
  不用 threads 池 / native loader 那类绕开沙箱的做法，同仓不并行运行测试。
- 工具链两套并存，别互相照搬：`packages/` 下的 npm 包是 tsdown + TS 6；工作台插件是 `tsc`，运行在 TS 7 上。
  以各自的 `package.json` 为准。
- **包按接缝切开，方向单向**：通用包 `code-pin`（只用 `node:crypto`）、`trajectory-disk`（`.` 入口零 import）
  互不认识，也不认识 docfirst，包里一个 docfirst 字样都没有（清单里指向本仓的仓地址除外）；`docfirst-explainer` 跟它们一样
  不依赖任何 `@godcreator/` 包，只是名字里带 docfirst；`docfirst-workflow` 认识 `code-pin` 与 `trajectory-disk`，除了 `src/fumadocs/` 不认识任何站的宿主。调用链从 `docfirst` 命令开始的归 `cli` 及它下面的目录，
  由 fumadocs 或 Next 调用的归 `src/fumadocs/`；`src/fumadocs/` 只按包名用本包的 `.`、`./mdx`、`./cards`，别的目录不认识它。
  workflow 里 `marker` / `reference` / `mdx` / `code` / `pinning` / `project` / `cards` / `node` / `cli` / `fumadocs` 几个目录之间也单向，只有 `node` 读写磁盘、启动子进程。`docfirst-explainer` 只给站用，`docfirst-workflow` 与插件都不依赖它。
  **包与插件互不认识**：包不许出现任何 `@godcreator/gwb-*`，
  插件也不许依赖包，两个方向各由 `tests/boundary.test.ts` 与插件的 `tests/artifact.test.ts` 检查。
  **`tests/boundary.test.ts` 是唯一检查这些边界的测试**（包的方向、自成一体的包与通用包、workflow 目录方向、宿主只能是可选的 peer、
  包不认识插件、docfirst-explainer 的三个入口），别绕、别删、别为了让检查通过注释掉某一条。
- **要在仓里发生的（核对、确认、渲染）归包，只在 agent 手上发生一次的归插件**：建站
  （`docfirst.create` 与 `docfirst.create-plain`）与说明书在 `plugins/docfirst/`。建站的每一步（运行官方脚手架、本机约定、
  选端口、写入文件）都在插件的 `src/` 里，插件必需注入的只有命令总线 `gwbCommands`，不依赖别的插件建站。
- 子进程调用一律带超时。
- 提交前的检查，下面每处都要通过才提交：
  - 仓根：`pnpm test`、`pnpm typecheck`、`pnpm build`
  - `docs-site/`：`pnpm docfirst check`、`pnpm test`、`pnpm build`、`node scripts/verify-roster.mjs`
  - `plugins/docfirst/`：`pnpm check`（typecheck + oxlint + vitest）、`pnpm build`
- 发版 **两边各发各的、没有先后**：插件对 `packages/` 下的包零依赖。`docfirst-workflow` 升版本号时跟着改
  `plugins/docfirst/src/deps.ts` 那张表——插件的 `tests/create.test.ts` 检查它。
- 改了站构建时 remark 插件会调用到的包代码（`docfirst-workflow/src/fumadocs/` 及它调用的 workflow 别的出口、code-pin），要先删 `.next` 再重新构建。
  站不用 `pnpm dev`：看页面也是先 `pnpm build` 再 `pnpm start`，改了内容重新 build。`build` 集中在收尾或发版前运行一次，
  用户没说要看就构建通过即结束；说要看就一直开着 `start`，服务带超时（默认 12 小时）自动停。
- 提交按步骤拆，一个提交一件事。
- 不碰 `D:\dshfiles\26082412vto\homes\`（在 `D:\dshfiles`，DSH 时代的归档区）；不碰主实例。
