/**
 * 装配往目标站的 `devDependencies` 里补的那几条。
 *
 * 这是一张**手写的表**，不是从本包的 package.json 现读的：工作区里那份写的是
 * `workspace:*`，摆进别人的站里装不动；发布版那份又要等 pnpm 在发版那一刻改写。
 * 所以它是第二份真相，靠 `tests/attach.test.ts` 里那条「表跟工作区各包的版本对得上」
 * 守着——**发版抬版本号时这张表跟着抬，那条测试红了就是忘了抬**。
 */
export const LIVEDOC_DEPS: Record<string, string> = {
  "@godcreator02/live-doc-cli": "^0.4.1",
  "@godcreator02/live-doc-format-fumadocs": "^0.2.0",
  "@godcreator02/live-doc-project": "^0.2.0",
  "@godcreator02/live-doc-trajectory": "^0.2.0",
};
