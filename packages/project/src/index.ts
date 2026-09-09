/**
 * @godcreator02/live-doc-project——消费方项目的装配。
 * 读取器、记录簿、比较器都在这儿造；git 那条线（定位文件在哪个仓、blob、hunk 表、行段跟随）也住这儿——核心不碰子进程。
 * 摆放（mdx 正本 → 落点上的生成物：渲、整形、跟盘上比、四态判定、落盘）也是这个包的一个模块。
 */

// 导出面就是这个包的契约面：包外用的是 loadProject 交出来的 Project，
// 三个 create* 是装配的零件（测试换比较器、换读取器时直接拿），git 那把原语一个都不出包——
// 它们是 git 比较器的内部实现，摆出去等于把「换掉 git 那条线要动谁」讲不清楚。
export { hashText } from "./git.ts";
export { createGitComparator } from "./git-comparator.ts";
export type { GitRecord } from "./git-comparator.ts";
export { createAutoComparator } from "./auto-comparator.ts";
export { createReader } from "./fs-reader.ts";
export { loadProject } from "./load.ts";
export type { Project, ProjectConfig } from "./load.ts";
export { createPlacing } from "./placement.ts";
export type { OutputTarget, PlacedCheck, PlacedStatus, PlacedWrite, Placement, Placing, PlacingHost } from "./placement.ts";
