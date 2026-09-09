# god-live-doc

**仓根就是这个目录 `god-live-doc/`**，它同时是 pnpm 包工作区。上一级是单元目录，那儿只有一张
出生证 `unit.json`，不在 git 里。仓里三样：`packages/` 下七个 `live-doc-*` 包（core、project、cli、
format-md、format-fumadocs、format-html、trajectory）外加一个工作台件 `gwb-live-doc`，
`docs-site/` 是自己的 fumadocs 文档站（用这套机制写自己的文档，也是工作区成员），
`tests/` 是工作区级测试。**怎么装、怎么接、怎么跑，看 `README.md`**，这儿不复述。

消费方示例不在仓里：这套包对外的样子由 `docs-site` 自己演——它就是「装了这几个包的项目」，
钉的是工作区里的真源码。星轨盘的诗名 fixture 住 `tests/fixtures/trajectory/`，
轨迹卡住 `docs-site/content/trajectory/`。

README 和这份规矩都是**生成物**：正本分别是 `docs-site/content/outputs/readme.mdx` 和
`docs-site/content/docs/maintain/agents.mdx`，改 mdx 源（不是改生成物），
`pnpm livedoc render --target ai` 重摆，mdx 源和生成物一起提交。

**动手前先读文档站**：`docs-site/content/docs/system-map.mdx` 是总代码地图，八个包各一页模块页在
`content/docs/modules/`，接口与边界逐条钉在真源码上。站分六区——现状 `docs/`、轨迹 `trajectory/`、
在途 `spec/`、未来 `future/`、生成正本 `outputs/`、反馈 `feedback/`；`livedoc check` 只扫现状与
生成正本两区，别的四区不进门禁。文档怎么写、六区怎么分、每页写到哪为止，正本是随
`@godcreator02/live-doc-cli` 发的 skill `packages/cli/skills/livedoc-docs/SKILL.md`，动文档前读它。

## 参考，不要改

* 实验室 `D:\dshfiles\260901lab`（台阶七 `step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，
  教学代码，**只读**。要搬逻辑就搬，别 import 它。它在**老根** `D:\dshfiles`（DSH 时代的归档区），
  本仓住 `D:\unitfolders` 下的单元里，这是跨根引用。
* 老仓 `D:\dshfiles\26082711aju\god-live-doc`（同在老根）：git 记忆那条线的出处（`libs/core/src/core/git.ts`、
  `diff.ts`、`hash.ts`、`pins.ts` 的代码钉分支），**只读**。功能面已对齐，不再是参考，代码只看这个仓。

## 规矩

* 中文写注释、文档、提交信息；标识符英文。注释只写现状，不写「原来怎么样」。
* TS，pnpm，测试用 `node --test`（工作区里的测试是 `.ts`，Node 直接跑；站里的是 `.mjs`）。
  **例外只有工作台件**：它用 vitest，跟 devkit 建出来的件骨架一致，不为一个件把骨架掰弯。
  不用 threads 池 / native loader 那类沙箱绕行，同仓不并行跑测试。
* 工具链两套并存，别互相搬：七个包是 tsdown + TS 6；工作台件是 `tsc` 出 node 半、`esbuild` 打
  浏览器半、`tailwindcss` 编带 `livedoc` 前缀的样式表，跑在 TS 7 上。各自的 `package.json` 说了算。
* 核心零依赖（只用 `node:crypto`），格式包依赖核心（format-md / format-fumadocs 另外用 remark 那套；
  format-fumadocs 可依赖 project，fumadocs 只能是 peer）。件依赖 cli，七个包不认识件、也不认识任何
  `@godcreator02/gwb-*`——方向单向。`tests/boundary.test.ts` 守着，别绕。
* 子进程调用一律带超时。
* 门禁，三摊都要绿才提交：
  * 仓根：`pnpm test`、`pnpm typecheck`、`pnpm build`
  * `docs-site/`：`pnpm livedoc check`、`pnpm test`、`pnpm build`、`node scripts/verify-roster.mjs`
  * `packages/gwb-live-doc/`：`pnpm check`（typecheck + oxlint + vitest）、`pnpm build`
* 发版顺序 **cli 先、件后**：件装的是发出去的那份 cli，工作区里的软链只在这个仓里成立。
* 动了引用到的源码，`livedoc confirm` 之前**先 commit**——git 比较器只对已提交、工作区干净的内容钉。
* 挂了 outputs 映射的文档（readme / agents 这两篇）改了 mdx 源，`pnpm livedoc render --target ai` 重摆
  生成物，跟 mdx 源一起提交；check 守着生成物跟源一致，红了就是没重摆。
* 改了格式包代码，站要先删 `.next` 再 build。调试站用 build + start，不用 dev；起的站验完必须停掉。
* 提交按步骤拆，一个提交一件事。提交信息末尾带 `Co-Authored-By` 与 `Claude-Session` 行（会话里给的那两行）。
* 不碰 `D:\dshfiles\26082412vto\homes\`（在老根 `D:\dshfiles`，DSH 时代的归档区）；不碰主实例。
