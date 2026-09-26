/**
 * 碰环境的那一块：读盘、起 git 子进程、把生成物摆到落点、读轨迹卡目录。
 * 读取器与旧内容来源（History）在这儿造；git 那条线（定位文件在哪个仓、按 blob 取旧内容、hunk 表、
 * 哪些文件有未提交的改动）也在这儿——钉码（`@godcreator/docfirst-pin`）不碰子进程。
 * 摆放（mdx 正本 → 落点上的生成物：渲、整形、跟盘上比、状态判定、落盘）也是这里的一个模块。
 *
 * 这个目录可以 import workflow 里除 `../cli/` 之外的目录、`@godcreator/docfirst-pin` 与 `@godcreator/docfirst-trajectory`，
 * **不许 import `../cli/`**（`tests/boundary.test.ts` 守着）。
 */

// 导出面就是这个目录的契约面：外面用的是 loadProject 交出来的 Project；
// createReader / createGitHistory / createPlacing 是装配的零件，测试换读取器、换旧内容来源时直接拿；
// createUncommittedProbe 是 check 每跑一次造一个的探针。git 那把原语不出这个口。
export { createReader } from "./fs-reader.ts";
export { createGitHistory } from "./history.ts";
export { createUncommittedProbe } from "./uncommitted.ts";
export type { UncommittedProbe } from "./uncommitted.ts";
export { docIdOf, loadProject } from "./load.ts";
export { migrateLedger } from "./migrate-ledger.ts";
export type { MigrationReport } from "./migrate-ledger.ts";
export type { Project, ProjectConfig } from "./load.ts";
export { createPlacing } from "./placement.ts";
export type { OutputTarget, PlacedCheck, PlacedStatus, PlacedWrite, Placement, Placing, PlacingHost } from "./placement.ts";
export { scanCardDir } from "./card-dir.ts";
