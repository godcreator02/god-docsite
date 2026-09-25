/**
 * auto 比较器（默认）：先按目标种类分派（目录树、存在性、名字走判定层里那三个），行段和整文件再按被引文件的位置挑记忆，
 * 一个项目里 git 记录和 hash 记录并存。
 *
 *   文件在哪                                  记忆
 *   任何 git 仓里、没被忽略                    git——已提交且干净才钉得住；未跟踪、脏、仓没提交过的，由 git 版说清楚，不退成 hash
 *   仓里但被 .gitignore 忽略（node_modules）   hash
 *   不在任何仓里                              hash
 *
 * 核对时不看文件在哪，按**记录的 kind** 转发——记录是当时哪种记忆记的，就让哪个比较器判。
 * 认不得的 kind 当没确认过。
 */

import { createHashComparator, createKindComparator, fileOf, targetKey } from "../engine/index.ts";
import type { Comparator, Judgement, MemoRecord, Snapshot, Target } from "../engine/index.ts";
import { hasCommits, isIgnored } from "./git.ts";
import { createGitComparator, fileFacts } from "./git-comparator.ts";

/** 行段 / 整文件那一半：按文件位置挑 git 或 hash */
export function createAutoSpanComparator({ root }: { root: string }): Comparator {
  const byGit = createGitComparator({ root });
  const byHash = createHashComparator();

  /** 跟 git 比较器问的是同一份 `fileFacts`：挑完再确认，同一个文件不重问 */
  function pick(file: string, text: string[]): Comparator {
    const { at, head } = fileFacts(root, file, text);
    if (at === null) return byHash;
    // 在 HEAD 里就是已跟踪的，已跟踪的不算忽略
    if (head !== null) return byGit;
    if (!hasCommits(at.repo)) return byGit;
    return isIgnored(at) ? byHash : byGit;
  }

  return {
    kind: "auto",

    snapshot(target: Target, text: string[] | null): Snapshot {
      if (text === null) return { problem: `${targetKey(target)} 文件不存在` };
      const file = fileOf(target);
      if (file === null) return { problem: `${targetKey(target)} 不是文件` };
      return pick(file, text).snapshot(target, text);
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      if (record?.kind === "git") return byGit.judge(record, target, text);
      if (record?.kind === "hash") return byHash.judge(record, target, text);
      return byHash.judge(null, target, text);
    },
  };
}

export function createAutoComparator({ root }: { root: string }): Comparator {
  return createKindComparator({ span: createAutoSpanComparator({ root }) });
}
