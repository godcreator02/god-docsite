/**
 * 建站时交给 gwbDocsite.init 的功能包，一律精确号（不带 `^` / `~` / `>=`）：
 * `@godcreator/docfirst-site` 带进站的路由、remark 链与起始物（docfirst.config.mjs、outputs 正本、
 * 轨迹与未来区起始页），docfirst 系脚本与 `@godcreator/docfirst-workflow` 的依赖范围经它模板里的
 * `template/skeleton/package.json` 写进新站。
 *
 * **包名出现在这儿不算依赖**：它是写进别人 `package.json` 的字符串，插件自己一行都不
 * import、发出去也不会被谁装上。插件对本仓 `packages/` 下各包的零依赖检查查的是本插件
 * `package.json` 的三类依赖与源码 import，跟这张表不冲突——建出来的站要跑 docfirst、要渲染，
 * 那是**站**里的事，站当然该装这个包。
 *
 * 这是一张**手写的表**，不从别处读：工作区里写的是 `workspace:*`，写进别人的站里装不上；
 * 发布版那份又要等发版时才改写。所以它是第二份版本号，由 `tests/create.test.ts` 里那条
 * 「表是精确号、跟工作区各包的版本对得上」检查——**包升了版本号，这张表跟着改，那条测试红了就是忘了改**。
 */
export const DOCFIRST_SITE_FEATURE: Record<string, string> = {
  '@godcreator/docfirst-site': '0.2.1',
}
