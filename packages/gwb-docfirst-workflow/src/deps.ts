/**
 * 建站时写进站的 `devDependencies` 的那几条，一律精确号（不带 `^` / `~` / `>=`）。
 *
 * **这两个包名出现在这儿不算依赖**：它们是写进别人 `package.json` 的字符串，插件自己一行都不
 * import、发出去也不会被谁装上。插件对 `@godcreator/docfirst-workflow` 的零依赖检查查的是本插件
 * `package.json` 的三档依赖，跟这张表不冲突——装出来的站要跑 `pnpm doc`，那是**仓**里的事，
 * 仓当然该装那个包。
 *
 * 这是一张**手写的表**，不从别处读：工作区里那两份写的是 `workspace:*`，写进别人的站里装不上；
 * 发布版那份又要等发版时才改写。所以它是第二份版本号，由 `tests/create.test.ts` 里那条
 * 「表是精确号、跟工作区各包的版本对得上」检查——**那两个包升了版本号，这张表跟着改，那条测试红了就是忘了改**。
 */
export const DOCFIRST_DEPS: Record<string, string> = {
  "@godcreator/docfirst-workflow": "0.3.1",
  "@godcreator/docfirst-trajectory": "0.1.1",
};
