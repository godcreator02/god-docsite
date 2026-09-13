# god-live-doc

**仓根就是这个目录 `god-live-doc/`**，它同时是 pnpm 包工作区。上一级是单元目录，那儿只有一张
出生证 `unit.json`，不在 git 里。仓里三样：`packages/` 下两个 npm 包（`docfirst-workflow` 主包、
`docfirst-trajectory` 轨迹包）外加一个工作台插件 `gwb-docfirst-workflow`，`docs-site/` 是自己的 fumadocs 文档站
（用这套机制写自己的文档，也是工作区成员），`tests/` 是工作区级测试。
**怎么装、怎么接、怎么跑，看 `README.md`**，这儿不复述。

消费方示例不在仓里：这两个包对外的样子由 `docs-site` 自己演——它就是「装了这两个包的项目」，
钉的是工作区里的真源码。星轨盘的诗名 fixture 住 `tests/fixtures/trajectory/`，
轨迹卡住 `docs-site/content/trajectory/`。

README 和这份规矩都是**生成物**：正本分别是 `docs-site/content/outputs/readme.mdx` 和
`docs-site/content/docs/maintain/agents.mdx`，改 mdx 源（不是改生成物），
`pnpm docfirst render` 重摆，mdx 源和生成物一起提交。

**动手前先读文档站**：`docs-site/content/docs/system-map.mdx` 是总代码地图，七个模块各一页在
`content/docs/modules/`，接口与边界逐条钉在真源码上。站分六区——现状 `docs/`、轨迹 `trajectory/`、
在途 `spec/`、未来 `future/`、生成正本 `outputs/`、反馈 `feedback/`；`docfirst check` 只扫现状与
生成正本两区，别的四区不进门禁。文档怎么写、六区怎么分、每页写到哪为止，正本是随工作台插件
`@godcreator02/gwb-docfirst-workflow` 发的 skill `packages/gwb-docfirst-workflow/skills/docfirst-docs/SKILL.md`，动文档前读它。

## 参考，不要改

* 实验室 `D:\dshfiles\260901lab`（台阶七 `step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，
  教学代码，**只读**。要搬逻辑就搬，别 import 它。它在**老根** `D:\dshfiles`（DSH 时代的归档区），
  本仓住 `D:\unitfolders` 下的单元里，这是跨根引用。
* 老仓 `D:\dshfiles\26082711aju\god-live-doc`（同在老根）：git 记忆那条线的出处（`libs/core/src/core/git.ts`、
  `diff.ts`、`hash.ts`、`pins.ts` 的代码钉分支），**只读**。功能面已对齐，不再是参考，代码只看这个仓。

## 规矩

* 中文写注释、文档、提交信息；标识符英文。注释只写现状，不写「原来怎么样」。
* TS，pnpm，测试用 `node --test`（工作区里的测试是 `.ts`，Node 直接跑；站里的是 `.mjs`）。
  **例外只有工作台插件**：它用 vitest，跟 devkit 建出来的插件骨架一致，不为一个插件把骨架掰弯。
  不用 threads 池 / native loader 那类沙箱绕行，同仓不并行跑测试。
* 工具链两套并存，别互相搬：两个 npm 包是 tsdown + TS 6；工作台插件是 `tsc`，跑在 TS 7 上。
  各自的 `package.json` 说了算。
* **主包 `src/` 下四层，方向单向**：`engine`（判定，只用 `node:crypto`）→ `host`（碰环境）→
  `fumadocs`（格式实现与站接线）→ `cli`（入口，四条子命令 check / confirm / render / trajectory）。
  轨迹是独立包线，只被 `cli` 用。**包与插件互不认识**：包不许出现任何 `@godcreator02/gwb-*`，插件也
  不许依赖包，两个方向各由 `tests/boundary.test.ts` 与插件的 `tests/artifact.test.ts&#x60; 守着。
  **`tests/boundary.test.ts` 是塌包之后唯一的边界守卫**，别绕、别删、别为了让门禁绿注释掉某一条。
* **要在仓里发生的（核对、确认、渲染）归包，只在 agent 手上发生一次的归插件**：铺六区
  （`docfirst.attach`）与六份说明书住 `packages/gwb-docfirst-workflow/`。站的一生（扫站、起停、端口、
  窗格）与铺 fumadocs 骨架归站点插件 `@godcreator02/gwb-docs-site`，两个插件互不依赖、只经命令总线说话。
* 子进程调用一律带超时。
* 门禁，三摊都要绿才提交：
  * 仓根：`pnpm test`、`pnpm typecheck`、`pnpm build`
  * `docs-site/`：`pnpm docfirst check`、`pnpm test`、`pnpm build`、`node scripts/verify-roster.mjs`
  * `packages/gwb-docfirst-workflow/`：`pnpm check`（typecheck + oxlint + vitest）、`pnpm build`
* 发版 **两边各发各的、没有先后**：插件对包零依赖。两个包抬版本号时跟着改
  `packages/gwb-docfirst-workflow/src/deps.ts` 那张表——插件的 `tests/attach.test.ts` 守着它。
* 动了引用到的源码，`docfirst confirm` 之前**先 commit**——git 比较器只对已提交、工作区干净的内容钉。
* 挂了 outputs 映射的文档（readme / agents / 五份 skill）改了 mdx 源，`pnpm docfirst render` 重摆
  生成物，跟 mdx 源一起提交；check 守着生成物跟源一致，红了就是没重摆。
* 改了 `src/fumadocs/` 的代码，站要先删 `.next` 再 build。调试站用 build + start，不用 dev；
  起的站验完必须停掉。
* 提交按步骤拆，一个提交一件事。提交信息末尾带 `Co-Authored-By` 与 `Claude-Session` 行（会话里给的那两行）。
* 不碰 `D:\dshfiles\26082412vto\homes\`（在老根 `D:\dshfiles`，DSH 时代的归档区）；不碰主实例。
