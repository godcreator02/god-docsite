/**
 * git 比较器：记忆就是 HEAD 里那个 blob，仓里不存第二份内容。
 *
 * - **确认**（snapshot）守两道门：文件得在 HEAD 里（被 .gitignore 忽略、未跟踪、大小写不符都拒），
 *   工作区得干净。记下 blob、commit、行段、段哈希。
 * - **核对**（judge）用 `git diff -U0 旧blob 当前内容` 出 hunk 表，把旧行段映到今天：
 *   整段删光是 vanished，文件没了是 file-missing，blob 不在对象库（浅克隆、历史重写）是 blob-missing；
 *   映到的那段哈希等于记录就绿，否则黄——黄带着给人看的 diff 和从 blob 取回的旧段。
 *   **绿只认段哈希**：hunk 说没碰到也再比一次，行映射跟内容对不上时宁可报黄让人复核。
 */

import { fileText, hashSpan, mapRange, mappedSpan, normalizeLines, renderDiff, sliceSpan, targetKey } from "@god-live-doc/core";
import type { Comparator, Judgement, MemoRecord, Snapshot, Span, Target } from "@god-live-doc/core";
import { diffHunks, headBlob, headCommit, inHead, isClean, objectExists, readBlob } from "./git.ts";

/** git 版的记录。lines 是**旧 blob 里**的位置，judge 从那儿出发往今天映 */
export interface GitRecord extends MemoRecord {
  kind: "git";
  blob: string;
  commit: string;
  lines: Span;
  hash: string;
}

export function createGitComparator({ root }: { root: string }): Comparator {
  /** 记录里那段旧内容，从 blob 取回；blob 没了给空 */
  function oldSpan(record: GitRecord): string[] {
    if (!objectExists(root, record.blob)) return [];
    const span = sliceSpan(readBlob(root, record.blob).split("\n"), record.lines);
    return span ?? [];
  }

  return {
    kind: "git",

    snapshot(target: Target, text: string[] | null): Snapshot {
      const where = targetKey(target);
      if (text === null) return { problem: `${where} 文件不存在` };
      const span = sliceSpan(text, [target.a, target.b]);
      if (span === null) return { problem: `${where} 行段超出文件` };
      try {
        // 「已提交」这道门问的是「在不在 HEAD 里」：被 .gitignore 忽略的、没跟踪的、路径大小写跟
        // git 记的不一样的，都取不到 blob——先在这儿说清楚，别让后面的 headBlob 炸出一句 git 原文
        if (!inHead(root, target.file)) {
          return { problem: `${where} 不在 HEAD 里（被 .gitignore 忽略、未跟踪、或路径大小写跟 git 记录不符）——钉住只对已提交的内容做` };
        }
        if (!isClean(root, target.file)) return { problem: `${where} 未提交——钉住只对已提交的内容做，先 commit` };
        const record: GitRecord = {
          kind: "git",
          blob: headBlob(root, target.file),
          commit: headCommit(root),
          lines: [target.a, target.b],
          hash: hashSpan(span),
        };
        return { record };
      } catch (err) {
        return { problem: `${where} 问不了 git：${(err as Error).message.trim().split("\n")[0]}` };
      }
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      if (record === null) {
        const lines: Span = [target.a, target.b];
        if (text === null) return { status: "missing", lines, reason: "file-missing" };
        if (sliceSpan(text, lines) === null) return { status: "missing", lines, reason: "vanished" };
        return { status: "unconfirmed", lines };
      }
      const pinned = record as GitRecord;
      if (text === null) return { status: "missing", lines: pinned.lines, reason: "file-missing", old: oldSpan(pinned) };
      // 记录里的 blob 不在对象库里：旧内容取不回来、diff 也做不了，判红说清楚，让人重新确认
      if (!objectExists(root, pinned.blob)) return { status: "missing", lines: pinned.lines, reason: "blob-missing", old: [] };

      const hunks = diffHunks(root, pinned.blob, fileText(text));
      const lines = mappedSpan(mapRange(hunks, pinned.lines[0], pinned.lines[1]));
      if (lines === null) return { status: "missing", lines: pinned.lines, reason: "vanished", old: oldSpan(pinned) };
      const span = sliceSpan(text, lines);
      if (span === null) return { status: "missing", lines: pinned.lines, reason: "vanished", old: oldSpan(pinned) };
      if (hashSpan(span) === pinned.hash) return { status: "fresh", lines };
      const old = oldSpan(pinned);
      return { status: "changed", lines, reason: "changed", diff: renderDiff(old, normalizeLines(span)), old };
    },
  };
}
