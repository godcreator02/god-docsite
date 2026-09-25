/**
 * 装配往目标站的 `devDependencies` 里补的那几条，一律精确号（不带 `^` / `~` / `>=`）。
 *
 * **这两个包名出现在这儿不算依赖**：它们是写进别人 `package.json` 的字符串，件自己一行都不
 * import、发出去也不会被谁装上。件对 `@godcreator/docfirst-workflow` 的零依赖守卫查的是本件
 * `package.json` 的三档依赖面，跟这张表不冲突——装出来的站要跑 `pnpm doc`，那是**仓**里的事，
 * 仓当然该装那个包。
 *
 * 这是一张**手写的表**，不是从哪儿现读的：工作区里那两份写的是 `workspace:*`，摆进别人的站里
 * 装不动；发布版那份又要等 pnpm 在发版那一刻改写。所以它是第二份真相，靠
 * `tests/attach.test.ts` 里那条「表是精确号、跟工作区各包的版本对得上」守着——**那两个包发版抬了
 * 版本号，这张表跟着抬，那条测试红了就是忘了抬**。
 */
export const DOCFIRST_DEPS: Record<string, string> = {
  "@godcreator/docfirst-workflow": "0.2.3",
  "@godcreator/docfirst-trajectory": "0.1.1",
};
