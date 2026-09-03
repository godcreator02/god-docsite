/**
 * @god-live-doc/project——消费方项目的装配。
 * 读取器、记录簿、比较器都在这儿造；git 那条线（定位文件在哪个仓、blob、hunk 表、行段跟随）也住这儿——核心不碰子进程。
 */

export {
  diffHunks,
  git,
  hasCommits,
  hashText,
  headBlob,
  headCommit,
  inHead,
  isClean,
  isIgnored,
  locate,
  objectExists,
  readBlob,
  realpathLoose,
  repoOf,
} from "./git.ts";
export type { Located } from "./git.ts";
export { createGitComparator } from "./git-comparator.ts";
export type { GitRecord } from "./git-comparator.ts";
export { createAutoComparator } from "./auto-comparator.ts";
export { createReader } from "./fs-reader.ts";
export { createLedger } from "./json-ledger.ts";
export { configPathOf, docIdOf, loadProject } from "./load.ts";
export type { Project, ProjectConfig } from "./load.ts";
