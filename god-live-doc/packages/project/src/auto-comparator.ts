/**
 * auto 比较器（默认）：按被引文件的位置挑记忆，一个项目里 git 记录和 hash 记录并存。
 *
 *   文件在哪                                  记忆
 *   任何 git 仓里、没被忽略                    git——已提交且干净才钉得住；未跟踪、脏、仓没提交过的，由 git 版说清楚，不退成 hash
 *   仓里但被 .gitignore 忽略（node_modules）   hash
 *   不在任何仓里                              hash
 *
 * 核对时不看文件在哪，按**记录的 kind** 转发——记录是当时哪种记忆记的，就让哪个比较器判。
 * 认不得的 kind 当没确认过。
 */

import { createHashComparator, targetKey } from "@god-live-doc/core";
import type { Comparator, Judgement, MemoRecord, Snapshot, Target } from "@god-live-doc/core";
import { hasCommits, isIgnored, locate } from "./git.ts";
import { createGitComparator } from "./git-comparator.ts";

export function createAutoComparator({ root }: { root: string }): Comparator {
  const byGit = createGitComparator({ root });
  const byHash = createHashComparator();

  function pick(file: string): Comparator {
    const at = locate(root, file);
    if (at === null) return byHash;
    if (!hasCommits(at.repo)) return byGit;
    return isIgnored(at) ? byHash : byGit;
  }

  return {
    kind: "auto",

    snapshot(target: Target, text: string[] | null): Snapshot {
      if (text === null) return { problem: `${targetKey(target)} 文件不存在` };
      return pick(target.file).snapshot(target, text);
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      if (record?.kind === "git") return byGit.judge(record, target, text);
      if (record?.kind === "hash") return byHash.judge(record, target, text);
      return byHash.judge(null, target, text);
    },
  };
}
