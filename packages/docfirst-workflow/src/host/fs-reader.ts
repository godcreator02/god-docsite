/**
 * 读取器：判定层看到的一切都从这儿来。
 *   read     读工作区文件，整文件按行给
 *   list     目录的名字表：相对 dir 的 posix 路径，目录带尾斜杠，排过序。在 git 仓里按 .gitignore 过滤（dist/、
 *            node_modules/ 不进清单，也不往里走），.git 自己去掉；不在仓里原样列。glob 只认 * 和 ?，匹配名字不匹配路径
 *   kindOf   路径是文件还是目录（软链接按指向的算）
 * 换成读某个提交、读内存，再写一个这样的文件即可。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Reader } from "../engine/index.ts";
import { git, locateDir } from "./git.ts";

/** glob 只认 * 和 ?；匹配的是名字，不是路径 */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function statOf(path: string): "file" | "dir" | null {
  try {
    return statSync(path).isDirectory() ? "dir" : "file";
  } catch {
    return null;
  }
}

/**
 * dir 底下被 .gitignore 忽略的路径，相对 dir 的 posix 路径、目录带尾斜杠；整棵树一次
 * `git status --ignored=matching` 问全。口径跟拿 `check-ignore` 一条一条问相同：只列匹配忽略规则的，
 * 被忽略的目录整个算一项、不往里列，目录本身没被忽略而里面的文件被忽略就列那些文件，已跟踪的不算忽略。
 * `--no-optional-locks`：status 顺手刷新索引要拿锁，别跟同时在这个仓里干活的人抢。
 * dir 本身落在一个被忽略的目录里时，git 报的是那个祖先目录，这时整棵树都算被忽略。
 * 目录不在任何仓里就一个都不忽略。定位走 locateDir（从目录自身起找仓）不走 locate：目标目录恰是仓根时
 * 先跳一级会跳出这个仓，忽略集空掉、过滤整个失效。
 */
function ignoredUnder(root: string, dir: string): (rel: string) => boolean {
  const at = locateDir(root, dir);
  if (at === null) return () => false;
  const scope = at.rel === "" ? [] : ["--", `:(literal)${at.rel}`];
  const out = git(at.repo, ["--no-optional-locks", "status", "--porcelain", "-z", "--ignored=matching", "--untracked-files=all", ...scope]);
  const prefix = at.rel === "" ? "" : `${at.rel}/`;
  const ignored = new Set<string>();
  const fields = out.split("\0");
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]!;
    // 改名与复制那一条后面多跟一个原路径字段，跳过它
    if (field[0] === "R" || field[0] === "C") i += 1;
    if (!field.startsWith("!! ")) continue;
    const path = field.slice(3);
    if (prefix !== "" && path.endsWith("/") && prefix.startsWith(path)) return () => true;
    if (path.startsWith(prefix)) ignored.add(path.slice(prefix.length));
  }
  return (rel) => ignored.has(rel) || ignored.has(`${rel}/`);
}

export function createReader(root: string): Reader {
  return {
    read(file) {
      try {
        return readFileSync(join(root, file), "utf8").split("\n");
      } catch {
        return null;
      }
    },

    list(dir, depth, glob) {
      const base = resolve(root, dir);
      if (statOf(base) !== "dir") return null;
      const match = glob === undefined ? null : globToRegExp(glob);
      const out: string[] = [];
      const isIgnored = ignoredUnder(root, dir);
      let dirsAtLevel = [""];
      for (let level = 1; dirsAtLevel.length > 0; level += 1) {
        const entries = dirsAtLevel.flatMap((rel) =>
          readdirSync(join(base, rel), { withFileTypes: true })
            .filter((e) => e.name !== ".git")
            .map((e) => ({ entry: e, rel: rel === "" ? e.name : `${rel}/${e.name}` })),
        );
        const dirsBelow: string[] = [];
        for (const { entry, rel } of entries) {
          if (isIgnored(rel)) continue;
          const isDir = entry.isDirectory() || statOf(join(base, rel)) === "dir";
          if (match === null || match.test(entry.name)) out.push(isDir ? `${rel}/` : rel);
          if (isDir && level < depth) dirsBelow.push(rel);
        }
        dirsAtLevel = dirsBelow;
      }
      return out.sort();
    },

    kindOf: (path) => statOf(resolve(root, path)),
  };
}
