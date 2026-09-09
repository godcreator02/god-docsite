/**
 * 包的主出口 `@godcreator02/livedoc`：**命令行的 main，加装配那个模块的面**。
 *
 * 这个口不是给站用的——站要的是 `@godcreator02/livedoc/fumadocs`（接线与格式实现）。
 * 这个口的读者是两种：写测试的（直接调 `main(["check"])`，不必起子进程），
 * 与想不绕命令行就装一次六区的程序（`planAttach` / `attachSite`）。
 *
 * 可执行本身在 `dist/cli.mjs`（bin `livedoc`），它只把参数递给 `main`、把退出码递回去。
 */
export { main } from "./cli/run.ts";
export type { CardProblemReport, CheckReport, ComponentReport, DocReport, OutputReport, RefReport } from "./cli/report.ts";
// 装配好的项目：站侧的测试要拿它自己核对一遍（`page.test.mjs`），命令行内部用的也是它。
// engine / host 别的零件不出这个口——它们是模块内部，仓里的测试直接 import 源码
export { loadProject } from "./host/index.ts";
export type { Project, ProjectConfig } from "./host/index.ts";
export { attachSite, planAttach, DEFAULT_PORT, DOC_SCRIPTS, LIVEDOC_DEPS, SUPERSEDED } from "./site/index.ts";
export type { AttachOptions, AttachPlan, AttachResult, TemplateFile } from "./site/index.ts";
