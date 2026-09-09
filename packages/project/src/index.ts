/**
 * @godcreator02/live-doc-project——消费方项目的装配。
 * 读取器、记录簿、比较器都在这儿造；git 那条线（定位文件在哪个仓、blob、hunk 表、行段跟随）也住这儿——核心不碰子进程。
 * 摆放（mdx 正本 → 落点上的生成物：渲、整形、跟盘上比、四态判定、落盘）也是这个包的一个模块。
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
  locateDir,
  objectExists,
  readBlob,
  realpathLoose,
  repoOf,
} from "./git.ts";
export type { Located } from "./git.ts";
export { createGitComparator } from "./git-comparator.ts";
export type { GitRecord } from "./git-comparator.ts";
export { createAutoComparator, createAutoSpanComparator } from "./auto-comparator.ts";
export { createReader, globToRegExp } from "./fs-reader.ts";
export { createLedger } from "./json-ledger.ts";
export { configPathOf, docIdOf, docsDirsOf, loadProject } from "./load.ts";
export type { Project, ProjectConfig } from "./load.ts";
export { createPlacing, placementsOf } from "./placement.ts";
export type { OutputTarget, PlacedCheck, PlacedStatus, PlacedWrite, Placement, Placing, PlacingHost } from "./placement.ts";
