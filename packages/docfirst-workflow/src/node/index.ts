/**
 * Node 实现：包里只有这个目录碰 `node:fs`、`node:child_process`、`node:os`。读写文件、列目录、加载模块，
 * 钉码核心要的读取器与旧内容来源（git 版），以及「一处黄是不是本仓未提交改动引起的」探针。
 * 这里的函数不认识 docfirst 的任何格式：记号、mdx、卡、分区、配置的键都由调用方定。
 *
 * 这个目录只认识 `@godcreator/code-pin`，包里别的目录都不认识（由 `tests/boundary.test.ts` 检查）。
 * git.ts 里的底层函数不从这里导出。
 */
export { filesUnder, filesUnderFollowingLinks, isDirectory, namesIn, pathExists, readDirFiles, readText, readTextIfExists, writeText, writeTextMakingParents } from "./files.ts";
export { importDefault } from "./module.ts";
export { createReader } from "./fs-reader.ts";
export { createGitHistory } from "./history.ts";
export { createUncommittedProbe } from "./uncommitted.ts";
export type { UncommittedProbe } from "./uncommitted.ts";
