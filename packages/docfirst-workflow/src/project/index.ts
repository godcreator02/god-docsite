/**
 * 访问文件系统与子进程的部分：读文件、启动 git 子进程、把生成物摆放到落点。
 * 读取器与旧内容来源（History）在这儿创建；git 相关的部分（定位文件在哪个仓、按 blob 取旧内容、hunk 表、
 * 哪些文件有未提交的改动）也在这儿——钉码核心（`@godcreator/code-pin`）不碰子进程。
 * 摆放（mdx 正本 → 落点上的生成物：渲染、整形、跟已有文件比较、状态判定、写入文件）也是这里的一个模块。
 *
 * 这个目录可以 import workflow 里除 `../cli/`、`../cards/` 之外的目录与 `@godcreator/code-pin`，
 * **不许 import `../cli/`**（由 `tests/boundary.test.ts` 检查）。
 */

// 导出的就是这个目录的契约：外面用的是 loadProject 返回的 Project；
// createReader / createGitHistory / createPlacing 是装配用的部件，测试换读取器、换旧内容来源时直接用；
// createUncommittedProbe 是 check 每运行一次创建一个的探针。git.ts 里的底层函数不从这里导出。
export { createReader } from "./fs-reader.ts";
export { createGitHistory } from "./history.ts";
export { createUncommittedProbe } from "./uncommitted.ts";
export type { UncommittedProbe } from "./uncommitted.ts";
export { docIdOf, loadProject } from "./load.ts";
export type { Project, ProjectConfig } from "./load.ts";
export { createPlacing } from "./placement.ts";
export type { OutputTarget, PlacedCheck, PlacedStatus, PlacedWrite, Placement, Placing, PlacingHost } from "./placement.ts";
