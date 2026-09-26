/**
 * 包的主出口 `@godcreator/docfirst-workflow`：**命令行的 main**，加上项目装配与读卡目录。
 *
 * 读者两种：写测试的（直接调 `main(["check"])`，不必起子进程）；站那一侧的适配包
 * `@godcreator/docfirst-fumadocs`（构建期要 loadProject 装配项目、要 scanCardDir 读轨迹卡）。mdx 格式本身在 `./mdx` 出口。
 * 引用、清单与钉码编排的类型也从这里出：钉码核心只认目标与记录，带文档位置的类型都在 workflow。
 *
 * **给一个新骨架铺各区不在这个包里**：那件事只在 agent 手上发生一次，铺的是模板、不碰判定，
 * 所以它归工作台插件（`@godcreator/gwb-docfirst-workflow` 的 `docfirst.create`，模板也随那个插件发）。
 * 这个包留下的是要在**仓**里发生的那几件——门禁与站构建跑的核对 / 确认 / 渲染 / 轨迹。
 *
 * 可执行本身在 `dist/cli.mjs`（bin `docfirst`），它只把参数递给 `main`、把退出码递回去。
 */
export { main } from "./cli/run.ts";
export type { CardProblemReport, CheckReport, ComponentReport, DocReport, OutputReport, RefReport } from "./cli/report.ts";
// 装配好的项目：站侧的测试要拿它自己核对一遍（`page.test.mjs`），命令行内部用的也是它。
// project 别的零件不出这个口——它们是模块内部，仓里的测试直接 import 源码
export { docIdOf, loadProject, scanCardDir } from "./project/index.ts";
export type { Project, ProjectConfig } from "./project/index.ts";
export type { Item, Listing, Reference } from "./reference/index.ts";
export type { ConfirmResult, ConfirmStep, Pinning } from "./pinning/index.ts";
