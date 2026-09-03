# god-live-doc（重写）

这个单元是 god-live-doc 的重写工位。单元根就是 git 仓。两个子文件夹：

- `god-live-doc/`：pnpm 包工作区。`packages/` 下六个包（core、project、cli、format-md、format-fumadocs、format-html），`docs-site/` 是自己的 fumadocs 文档站（用这套机制写自己的文档，link 依赖包），`tests/` 是工作区级测试。
- `examples/`：邻居示例，外部引用这套包的消费方——fumadocs 站、手写 html、纯 md 项目，各自 link 依赖 `../../god-live-doc/packages/*`。

方案正本在总控台 `D:\dshfiles\26082611vry\console\docs-god-flow\drafts\god-live-doc-rewrite.md`，接口、记录格式、状态表、顺序都在那儿；本仓的现状文档写在 `god-live-doc/docs-site/` 里，方案变了先改那份草稿再改代码。

## 参考，不要改

- 实验室 `D:\dshfiles\260901lab`（台阶七 `step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，教学代码，**只读**。要搬逻辑就搬，别 import 它。
- 老仓 `D:\dshfiles\26082711aju\god-live-doc`：git 记忆那条线的出处（`libs/core/src/core/git.ts`、`diff.ts`、`hash.ts`、`pins.ts` 的代码钉分支），**只读**，对齐后退役。

## 规矩

- 中文写注释、文档、提交信息；标识符英文。注释只写现状，不写「原来怎么样」。
- TS，tsdown 构建，pnpm，测试用 `node --test`（或 vitest 标准写法，不用 threads 池 / native loader 那类沙箱绕行，同仓不并行跑测试）。
- 核心零依赖，格式包只依赖核心（format-fumadocs 可依赖 project，fumadocs 只能是 peer）。边界测试守着，别绕。
- 门禁：`pnpm test`、`pnpm typecheck`、`pnpm build` 全绿才提交。docs-site 改了要 `next build` 过（调试用 build + start，不用 dev；改了格式包代码先删 `.next` 再 build）。
- 提交按步骤拆，一个提交一件事。提交信息末尾带 `Co-Authored-By` 与 `Claude-Session` 行（会话里给的那两行）。
- 不碰 `D:\dshfiles\26082412vto\homes\`；不碰主实例。
