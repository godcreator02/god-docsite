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

/** dir 下这些相对路径里，哪些被 .gitignore 忽略了。目录不在任何仓里就一个都不忽略。
 * 定位走 locateDir（从目录自身起找仓）不走 locate：目标目录恰是仓根时先跳一级会跳出这个仓，
 * 忽略集空掉、过滤整个失效 */
function ignoredOf(root: string, dir: string, rels: string[]): Set<string> {
  const at = locateDir(root, dir);
  if (at === null || rels.length === 0) return new Set();
  const paths = rels.map((r) => (at.rel === "" ? r : `${at.rel}/${r}`));
  let out: string;
  try {
    out = git(at.repo, ["check-ignore", "--stdin"], `${paths.join("\n")}\n`);
  } catch (err) {
    // 退 1 是「一个都没被忽略」
    const e = err as { status?: number; stdout?: string };
    if (e.status !== 1) throw err;
    out = e.stdout ?? "";
  }
  const hit = new Set(out.split("\n").map((s) => s.trim()).filter((s) => s !== ""));
  return new Set(rels.filter((r, i) => hit.has(paths[i]!)));
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
      const walk = (rel: string, level: number): void => {
        const entries = readdirSync(join(base, rel), { withFileTypes: true }).filter((e) => e.name !== ".git");
        const rels = entries.map((e) => (rel === "" ? e.name : `${rel}/${e.name}`));
        const ignored = ignoredOf(root, dir, rels);
        entries.forEach((e, i) => {
          const r = rels[i]!;
          if (ignored.has(r)) return;
          const isDir = e.isDirectory() || statOf(join(base, r)) === "dir";
          if (match === null || match.test(e.name)) out.push(isDir ? `${r}/` : r);
          if (isDir && level < depth) walk(r, level + 1);
        });
      };
      walk("", 1);
      return out.sort();
    },

    kindOf: (path) => statOf(resolve(root, path)),
  };
}
