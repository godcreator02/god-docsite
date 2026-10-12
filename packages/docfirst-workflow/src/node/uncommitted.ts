/**
 * 一处黄灯是不是这次改动引起的：被钉的文件（目录树是那个目录）跟文档在同一个 git 仓里，
 * 并且在那个仓里有未提交的改动（工作区或暂存区跟 HEAD 不一样，或者未跟踪）。
 * check 把这种黄算红：改代码的那个提交里就该复核并 `--accept`。
 *
 * 一个探针只用在一次 check 里：每个仓的 `git status` 只跑一次、结果记在探针里；
 * 下一次 check 创建新探针，不会拿到过时的答案。
 */
import type { Target } from "@godcreator/code-pin";
import { locate, locateDir, uncommittedPaths } from "./git.ts";
import type { Located } from "./git.ts";

export type UncommittedProbe = (doc: string, target: Target) => boolean;

export function createUncommittedProbe(root: string): UncommittedProbe {
  const byRepo = new Map<string, Set<string>>();
  const pathsIn = (repo: string): Set<string> => {
    let paths = byRepo.get(repo);
    if (paths === undefined) {
      paths = uncommittedPaths(repo);
      byRepo.set(repo, paths);
    }
    return paths;
  };

  return (doc, target) => {
    const home = locate(root, doc);
    const at: Located | null = target.kind === "tree" ? locateDir(root, target.dir) : locate(root, target.file);
    if (home === null || at === null || at.repo !== home.repo) return false;
    const paths = pathsIn(at.repo);
    if (target.kind !== "tree") return paths.has(at.rel);
    const prefix = at.rel === "" ? "" : `${at.rel}/`;
    for (const path of paths) if (path.startsWith(prefix)) return true;
    return false;
  };
}
