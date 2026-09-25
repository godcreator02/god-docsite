/**
 * 比较器要的旧内容来源（判定层的 `History`），git 版：
 *   oldText   按被引文件自己的位置找仓，从对象库按 blob 名前缀取确认时的整文件内容
 *   hunks     两份内容写成临时文件跑 `git diff --no-index -U0`，hunk 表按内容寻址缓存在内存与系统临时目录
 * 取不到旧内容（文件不在任何仓里、blob 没进对象库、缩写有歧义）给 null，比较器退回滑窗。
 */
import type { History } from "../engine/index.ts";
import { diffHunks, locate, readBlob } from "./git.ts";

export function createGitHistory(root: string): History {
  return {
    oldText(file, blob) {
      const at = locate(root, file);
      return at === null ? null : readBlob(at.repo, blob);
    },
    hunks: diffHunks,
  };
}
