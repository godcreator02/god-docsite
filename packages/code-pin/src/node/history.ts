import type { History } from "../core/index.ts";
import { locate, readBlob } from "./git.ts";

/** 旧内容的 git 来源：按被钉文件自己的位置找仓，从对象库按 blob 名前缀取确认时的整文件内容；不在任何仓里给 null */
export function createGitHistory(root: string): History {
  return {
    oldText(file, blob) {
      const at = locate(root, file);
      return at === null ? null : readBlob(at.repo, blob);
    },
  };
}
