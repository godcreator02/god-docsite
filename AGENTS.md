# god-live-doc（重写）

这个单元是 god-live-doc 的重写工位。单元根就是 git 仓。两个子文件夹：

* `god-live-doc/`：pnpm 包工作区。`packages/` 下六个包（core、project、cli、format-md、
  format-fumadocs、format-html），`docs-site/` 是自己的 fumadocs 文档站（用这套机制写自己的文档，
  也是工作区成员），`tests/` 是工作区级测试。**怎么装、怎么接、怎么跑，看 `god-live-doc/README.md`**，
  这儿不复述。
* `examples/`：邻居示例，外部引用这套包的消费方——`fumadocs-site`（外部 fumadocs 站）、
  `plain`（手写 html + 纯 md，比较器换成 hash）、`notes`（命令行记事本，一篇 mdx 手册把五类引用全用上；
  文档站「五类引用」那章钉的是它的真文件，改它要连着那章一起 confirm）。各自 link 依赖
  `../../god-live-doc/packages/*`，各自 `pnpm install`、各自跑测试。

README 和这份规矩都是**生成物**：正本分别是 `docs-site/content/docs/maintain/readme.mdx` 和 `agents.mdx`，
改 mdx 源（不是改生成物），`pnpm livedoc render --target ai` 重摆，mdx 源和生成物一起提交。
方案正本是单元根的 `god-live-doc-rewrite.md`，接口、记录格式、状态表、顺序都在那儿；
跟方案有出入的地方记在 `god-live-doc/README.md` 的「待定」段，方案要变先改正本再改代码。

## 参考，不要改

* 实验室 `D:\dshfiles\260901lab`（台阶七 `step7-packages` / `step7-site` / `step7-mini`）：架构定案的出处，
  教学代码，**只读**。要搬逻辑就搬，别 import 它。
* 老仓 `D:\dshfiles\26082711aju\god-live-doc`：git 记忆那条线的出处（`libs/core/src/core/git.ts`、
  `diff.ts`、`hash.ts`、`pins.ts` 的代码钉分支），**只读**。功能面已对齐，不再是参考，代码只看这个仓。

## 规矩

* 中文写注释、文档、提交信息；标识符英文。注释只写现状，不写「原来怎么样」。
* TS，tsdown 构建，pnpm，测试用 `node --test`（工作区里的测试是 `.ts`，Node 直接跑；站和示例里的
  是 `.mjs`）。不用 threads 池 / native loader 那类沙箱绕行，同仓不并行跑测试。
* 核心零依赖（只用 `node:crypto`），格式包依赖核心（format-md / format-fumadocs 另外用 remark 那套；
  format-fumadocs 可依赖 project，fumadocs 只能是 peer）。`tests/boundary.test.ts` 守着，别绕。
* 子进程调用一律带超时。
* 门禁，五摊都要绿才提交：
  * `god-live-doc/`：`pnpm test`、`pnpm typecheck`、`pnpm build`
  * `god-live-doc/docs-site/`：`pnpm livedoc check`、`pnpm test`、`pnpm build`、`node scripts/verify-roster.mjs`
  * `examples/plain/`：`pnpm test`
  * `examples/fumadocs-site/`：`pnpm test`、`pnpm build`
  * `examples/notes/`：`pnpm livedoc check`、`pnpm test`
* 动了引用到的源码，`livedoc confirm` 之前**先 commit**——git 比较器只对已提交、工作区干净的内容钉。
* 挂了 outputs 映射的文档（readme / agents 这两篇）改了 mdx 源，`pnpm livedoc render --target ai` 重摆
  生成物，跟 mdx 源一起提交；check 守着生成物跟源一致，红了就是没重摆。
* 改了格式包代码，站要先删 `.next` 再 build。调试站用 build + start，不用 dev；起的站验完必须停掉。
* 提交按步骤拆，一个提交一件事。提交信息末尾带 `Co-Authored-By` 与 `Claude-Session` 行（会话里给的那两行）。
* 不碰 `D:\dshfiles\26082412vto\homes\`；不碰主实例。
