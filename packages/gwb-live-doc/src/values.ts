/**
 * 占位符的值从哪儿来：站叫什么名字、起手页那块「第一条引用」写什么。
 *
 * 模块内部件，不在装配接口的面上——调用方给一个站目录，名字与钉块都是这儿从它的仓现认的。
 */
import { basename } from "node:path";
import type { SiteValues } from "./template.js";

/** 名字：能从仓根 package.json 认出来就别让人再敲一遍。`--title` 给了就用给的 */
export function namesFor(
  repoDir: string,
  manifest: { name?: unknown; title?: unknown } | null,
  title?: string,
): Omit<SiteValues, "port" | "pinBlock"> {
  let pkg = typeof manifest?.name === "string" ? manifest.name : "";
  if (pkg === "") pkg = basename(repoDir);
  const pkgName = pkg.includes("/") ? pkg.slice(pkg.indexOf("/") + 1) : basename(repoDir);
  const given = (title ?? "").trim();
  const fromManifest = typeof manifest?.title === "string" ? manifest.title.trim() : "";
  return {
    title: given !== "" ? given : fromManifest !== "" ? fromManifest : pkgName,
    pkg,
    pkgName,
  };
}

/**
 * 起手页里那块「第一条引用」，按仓根 `src/index.ts` 的内容决定。
 *
 * 找得到 `export const name` 就钉那一行——**行号是现找的，不写死**。找不到（或者根本没有
 * 这个文件）就不钉，改成写一段「第一条引用怎么钉」：**硬塞一条钉不住的引用，等于开局
 * 就给读者一条红的。**
 */
export function pinBlockFrom(entrySource: string | null): string {
  if (entrySource !== null) {
    const lines = entrySource.split("\n");
    const at = lines.findIndex((line) => /^\s*export\s+const\s+name\s*=/.test(line));
    if (at >= 0) {
      const n = at + 1;
      return `下面这块不是抄进文档的副本，是构建那一刻从源码现拿的：

@@livedoc ref ../src/index.ts:${n}-${n} @@

上面那行是**草稿记号**。先落一个提交，再在这个目录跑 \`pnpm doc:confirm\`，它会被换成正式
记号、状态点转绿——git 比较器只对已提交、工作区干净的内容钉。`;
    }
  }
  // 样例记号写进围栏里：围栏内容是 code 节点，check 认不出草稿记号——**这一步不能省**，
  // 一条指着 `某个文件.ts` 的活记号会让刚接好线的站开局就报一条钉不住的引用。
  return `**这一页还没钉第一条引用。** 钉一条：在正文里单起一行写草稿记号（不是写在围栏里，
下面这块是样例），路径相对这个站目录——代码在仓根就写 \`../\`：

\`\`\`text
@@livedoc ref ../src/某个文件.ts:12-18 @@
\`\`\`

然后落一个提交、在这个目录跑 \`pnpm doc:confirm\`——草稿记号换成正式记号，状态点转绿。
git 比较器只对已提交、工作区干净的内容钉。`;
}
