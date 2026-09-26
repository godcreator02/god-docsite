# god-live-doc

**仓根就是这个目录 `god-live-doc/`**，它同时是 pnpm 包工作区。上一级是单元目录，那儿只有一张
出生证 `unit.json`，不在 git 里。布局照 devkit 的 workspace 仓：`plugins/docfirst/` 是工作台插件 `@godcreator/gwb-docfirst-workflow`，
`packages/` 下四个 npm 包（`docfirst-pin` 钉码核心、`docfirst-trajectory` 轨迹核心、`docfirst-workflow` 命令行与项目、
`docfirst-fumadocs` fumadocs 适配），外加文档站讲解组件的模板包 `docs-explain`（分步、动画、选情况三种模板与零件，
普通 fumadocs 站也用），`docs-site/` 是自己的 fumadocs 文档站（用这套机制写自己的文档；站用 `workspace:*`
引这几个包，也是工作区成员，这是本仓有意的例外），`tests/` 是工作区级测试。
**怎么装、怎么接、怎么跑，看 `README.md`**，这儿不复述。

使用方示例不在仓里：`docs-site` 就是「装了这几个包的项目」，钉的是工作区里的真源码。
星轨盘的诗名 fixture 在 `tests/fixtures/trajectory/`，轨迹卡在 `docs-site/content/trajectory/`。

README、CLAUDE.md、这份规矩与插件里的七份 SKILL.md 都是**生成物**：正本是 `docs-site/content/docs/outputs/` 下的 mdx
（这份的正本是 `docs-site/content/docs/maintain/agents.mdx`），对应关系看 `docs-site/docfirst.config.mjs`
的 `outputs`。改 mdx 正本，`pnpm docfirst render` 重新生成，正本和生成物放进同一个提交。

**动手前先读文档站**：`docs-site/content/docs/system-map.mdx` 是总地图（四个包与十二条接缝），
模块页按包组织在 `content/docs/modules/`，接口与边界逐条钉在真源码上。文档怎么写、分区怎么分、钉码怎么确认，
正本是随工作台插件发的 skill「docfirst-docs」（生成物在
`plugins/docfirst/skills/docfirst-docs/SKILL.md`），动文档前读它。
**改了被钉的代码，就在同一个提交里处理它引起的黄灯**：本仓未提交改动引起的黄灯，`pnpm docfirst check` 算红。

## 参考，不要改

- 实验室 `D:\dshfiles\260901lab`（台阶七 `step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，
  教学代码，**只读**。要搬逻辑就搬，别 import 它。它在**老根** `D:\dshfiles`（DSH 时代的归档区），
  本仓在 `D:\unitfolders` 下的单元里，这是跨根引用。
- 老仓 `D:\dshfiles\26082711aju\god-live-doc`（同在老根）：用 git 取旧内容这项功能的出处，**只读**。
  功能已对齐，不再参考，代码只看这个仓。

## 规矩

- 中文写注释、文档、提交信息；标识符英文。注释只写现状，不写「原来怎么样」。
- TS，pnpm，测试用 `node --test`（工作区里的测试是 `.ts`，Node 直接跑；站里的是 `.mjs`）。
  **例外只有工作台插件**：它用 vitest，跟 devkit 建出来的插件骨架一致，不为一个插件改骨架。
  不用 threads 池 / native loader 那类绕开沙箱的做法，同仓不并行跑测试。
- 工具链两套并存，别互相照搬：五个 npm 包是 tsdown + TS 6；工作台插件是 `tsc`，跑在 TS 7 上。
  以各自的 `package.json` 为准。
- **四个包按接缝切开，方向单向**：`docfirst-pin`（只用 `node:crypto`）与 `docfirst-trajectory`（`.` 入口零 import）
  谁都不认识；`docfirst-workflow` 认识这两个、不认识任何站的宿主；`docfirst-fumadocs` 认识另外三个，谁都不认识它。
  调用链从 `docfirst` 命令开始的归 workflow，由 fumadocs 或 Next 调用的归 fumadocs 适配。workflow 里
  `format` / `mdx` / `project` / `cli` 四个目录也单向。`docs-explain` 跟四个 docfirst 包互不认识，只给站用。
  **包与插件互不认识**：包不许出现任何 `@godcreator/gwb-*`，
  插件也不许依赖包，两个方向各由 `tests/boundary.test.ts` 与插件的 `tests/artifact.test.ts` 检查。
  **`tests/boundary.test.ts` 是唯一的边界守卫**（包的方向、两个核心零依赖、workflow 目录方向、宿主只能是 peer、
  包不认识插件、docs-explain 只给站用），别绕、别删、别为了让门禁通过注释掉某一条。
- **要在仓里发生的（核对、确认、渲染）归包，只在 agent 手上发生一次的归插件**：建站
  （`docfirst.create` 与 `docfirst.create-plain`）与七份说明书在 `plugins/docfirst/`。建站的每一步（运行官方脚手架、本机约定、
  挑端口、写盘）都在插件的 `src/` 里，插件必需注入的只有命令总线 `gwbCommands`，不依赖别的插件建站。
- 子进程调用一律带超时。
- 门禁，三处都要通过才提交：
  - 仓根：`pnpm test`、`pnpm typecheck`、`pnpm build`
  - `docs-site/`：`pnpm docfirst check`、`pnpm test`、`pnpm build`、`node scripts/verify-roster.mjs`
  - `plugins/docfirst/`：`pnpm check`（typecheck + oxlint + vitest）、`pnpm build`
- 发版 **两边各发各的、没有先后**：插件对五个包零依赖。`docfirst-workflow` 与 `docfirst-fumadocs` 升版本号时跟着改
  `plugins/docfirst/src/deps.ts` 那张表——插件的 `tests/create.test.ts` 检查它。
- 改了站构建时 remark 插件会跑到的包代码（`docfirst-fumadocs` 及它调用的 workflow、pin），站要先删 `.next` 再 build。调试站用 build + start，不用 dev；
  启动的站验完必须停掉。
- 提交按步骤拆，一个提交一件事。提交信息末尾带 `Co-Authored-By` 与 `Claude-Session` 行（会话里给的那两行）。
- 不碰 `D:\dshfiles\26082412vto\homes\`（在老根 `D:\dshfiles`，DSH 时代的归档区）；不碰主实例。
