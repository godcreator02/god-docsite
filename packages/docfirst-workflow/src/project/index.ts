/**
 * 项目装配与生成物摆放。读文件、git 这些碰磁盘与子进程的事都在 `../node/`，这个目录从那里取。
 * 摆放（mdx 正本 → 落点上的生成物：渲染、整形、跟已有文件比较、状态判定）也是这里的一个模块。
 *
 * 这个目录可以 import workflow 里除 `../cli/`、`../cards/` 之外的目录与 `@godcreator/code-pin`，
 * **不许 import `../cli/`**（由 `tests/boundary.test.ts` 检查）。
 */

// 导出的就是这个目录的契约：外面用的是 loadProject 返回的 Project；
// createReader / createGitHistory / createPlacing 是装配用的部件，测试换读取器、换旧内容来源时直接用；
// createUncommittedProbe 是 check 每运行一次创建一个的探针。createReader、createGitHistory、createUncommittedProbe
// 的实现在 ../node/，从这里再导出。
export { createGitHistory, createReader, createUncommittedProbe } from "../node/index.ts";
export type { UncommittedProbe } from "../node/index.ts";
export { docIdOf, loadProject } from "./load.ts";
export type { Project } from "./load.ts";
export type { GlossaryConfig, ProjectConfig } from "./config.ts";
export { createPlacing } from "./placement.ts";
export type { OutputTarget, PlacedCheck, PlacedStatus, PlacedWrite, Placement, Placing, PlacingHost } from "./placement.ts";
