/**
 * 建站时写进站的 `devDependencies` 的那几条，一律精确号（不带 `^` / `~` / `>=`）。
 * `@godcreator/docfirst-workflow` 给站提供命令行 `docfirst`、`docfirst.config.mjs` 用的 mdx 格式，
 * 以及子入口 `./fumadocs` 下接入 fumadocs 的部分（集合选项、组件名册、状态点组件、星轨盘的读卡建模与组件、样式）。
 * 站的模板不直接 import 通用包 `code-pin`、`trajectory-disk`，它们随这个包装上，不写进表里；
 * 星轨盘组件与样式由 `docfirst-workflow/fumadocs/trajectory` 与 `/fumadocs/trajectory.css` 再导出。
 *
 * **包名出现在这儿不算依赖**：它是写进别人 `package.json` 的字符串，插件自己一行都不
 * import、发出去也不会被谁装上。插件对本仓 `packages/` 下各包的零依赖检查查的是本插件
 * `package.json` 的三类依赖与源码 import，跟这张表不冲突——建出来的站要运行 `pnpm doc`、要渲染，
 * 那是**仓**里的事，仓当然该装这个包。
 *
 * 这是一张**手写的表**，不从别处读：工作区里写的是 `workspace:*`，写进别人的站里装不上；
 * 发布版那份又要等发版时才改写。所以它是第二份版本号，由 `tests/create.test.ts` 里那条
 * 「表是精确号、跟工作区各包的版本对得上」检查——**包升了版本号，这张表跟着改，那条测试红了就是忘了改**。
 */
export const DOCFIRST_DEPS: Record<string, string> = {
  "@godcreator/docfirst-workflow": "0.5.6",
};
