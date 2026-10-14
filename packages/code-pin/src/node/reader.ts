/**
 * 读工作区的读取器：
 *   read     读文件，整文件按行给
 *   list     目录的名字表：相对 dir 的 posix 路径，目录带尾斜杠，排过序。在 git 仓里按 .gitignore 过滤（dist/、
 *            node_modules/ 不进清单，也不进去遍历），.git 自己去掉；不在仓里原样列。glob 只认 * 和 ?，匹配名字不匹配路径
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Reader } from "../core/index.ts";
import { git, locateDir, statusEntries } from "./git.ts";

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

/** 路径不存在（或路径中间有一段是文件）时的错误码：这几种当成「没有」，别的读取失败照原样抛 */
const NOT_THERE = new Set(["ENOENT", "ENOTDIR"]);

function statOf(path: string): "file" | "dir" | null {
  try {
    return statSync(path).isDirectory() ? "dir" : "file";
  } catch (err) {
    if (NOT_THERE.has((err as NodeJS.ErrnoException).code ?? "")) return null;
    throw err;
  }
}

/**
 * dir 底下被 .gitignore 忽略的路径：整棵树一次 `git status --ignored=matching` 问全。口径跟逐项问 `check-ignore` 相同：
 * 只列匹配忽略规则的，被忽略的目录整个算一项、不往里列，已跟踪的不算忽略。
 * dir 本身落在一个被忽略的目录里时，git 报的是那个祖先目录，这时整棵树都算被忽略。目录不在任何仓里就一个都不忽略。
 */
function ignoredUnder(root: string, dir: string): (rel: string) => boolean {
  const at = locateDir(root, dir);
  if (at === null) return () => false;
  const scope = at.rel === "" ? [] : ["--", `:(literal)${at.rel}`];
  const out = git(at.repo, ["--no-optional-locks", "status", "--porcelain", "-z", "--ignored=matching", "--untracked-files=all", ...scope]);
  const prefix = at.rel === "" ? "" : `${at.rel}/`;
  const ignored = new Set<string>();
  for (const { code, path } of statusEntries(out)) {
    if (code !== "!!") continue;
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
      } catch (err) {
        // 钉的是一个目录也当成文件不在：这处钉报缺失
        const code = (err as NodeJS.ErrnoException).code ?? "";
        if (NOT_THERE.has(code) || code === "EISDIR") return null;
        throw err;
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
  };
}
