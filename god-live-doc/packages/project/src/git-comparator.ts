/**
 * git 比较器：记忆就是那个仓 HEAD 里的 blob，哪儿都不存第二份内容。
 *
 * 被引文件在哪个仓按它自己的位置定（见 git.ts 的 locate）：项目自己的仓、别的仓一视同仁。
 * - **确认**（snapshot）守几道门：得在某个仓里、那个仓得有过提交、文件得在 HEAD 里（未跟踪、被忽略、
 *   大小写不符都拒）、工作区得干净。记下 blob、commit、行段、段哈希——不记仓在哪，blob 是内容寻址的，
 *   核对时从文件位置重新找仓。
 * - **核对**（judge）用 `git diff -U0 旧内容 当前内容` 出 hunk 表，把旧行段映到今天：
 *   整段删光是 vanished，文件没了是 file-missing，blob 不在对象库（浅克隆、历史重写、仓换了）是 blob-missing；
 *   映到的那段哈希等于记录就绿，否则黄——黄带着给人看的 diff 和从 blob 取回的旧段。
 *   **绿只认段哈希**：hunk 说没碰到也再比一次，行映射跟内容对不上时宁可报黄让人复核。
 */

import { fileText, hashSpan, mapRange, mappedSpan, normalizeLines, renderDiff, sliceSpan, targetKey } from "@god-live-doc/core";
import type { Comparator, Judgement, MemoRecord, Snapshot, Span, Target } from "@god-live-doc/core";
import { diffHunks, hasCommits, headBlob, headCommit, inHead, isClean, isIgnored, locate, objectExists, readBlob } from "./git.ts";

/** git 版的记录。lines 是**旧 blob 里**的位置，judge 从那儿出发往今天映 */
export interface GitRecord extends MemoRecord {
  kind: "git";
  blob: string;
  commit: string;
  lines: Span;
  hash: string;
}

export function createGitComparator({ root }: { root: string }): Comparator {
  /** 记录里那段旧内容，从 blob 取回；仓找不到、blob 没了给空 */
  function oldSpan(repo: string | null, record: GitRecord): string[] {
    if (repo === null || !objectExists(repo, record.blob)) return [];
    const span = sliceSpan(readBlob(repo, record.blob).split("\n"), record.lines);
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
        const at = locate(root, target.file);
        if (at === null) return { problem: `${where} 不在任何 git 仓里——git 记忆只对仓里的文件做` };
        if (!hasCommits(at.repo)) return { problem: `${where} 所在的仓还没有一次提交——先 commit` };
        // 「已提交」这道门问的是「在不在 HEAD 里」：先在这儿说清楚是哪一种，别让后面的 headBlob 炸出一句 git 原文
        if (!inHead(at)) {
          return {
            problem: isIgnored(at)
              ? `${where} 被 .gitignore 忽略——git 记忆只对已提交的内容做`
              : `${where} 未跟踪（或路径大小写跟 git 记录不符）——钉住只对已提交的内容做，先 commit`,
          };
        }
        if (!isClean(at)) return { problem: `${where} 未提交——钉住只对已提交的内容做，先 commit` };
        const record: GitRecord = {
          kind: "git",
          blob: headBlob(at),
          commit: headCommit(at.repo),
          lines: [target.a, target.b],
          hash: hashSpan(span),
        };
        return { record };
      } catch (err) {
        return { problem: `${where} 问不了 git：${(err as Error).message.trim().split("\n")[0]}` };
      }
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      // 别家的记录不认，当没确认过——记录格式是各比较器自己的，翻译就是猜
      if (record === null || record.kind !== "git") {
        const lines: Span = [target.a, target.b];
        if (text === null) return { status: "missing", lines, reason: "file-missing" };
        if (sliceSpan(text, lines) === null) return { status: "missing", lines, reason: "vanished" };
        return { status: "unconfirmed", lines };
      }
      const pinned = record as GitRecord;
      // 文件没了也能定位：从它原来的目录往上找仓，旧内容照样从 blob 取回
      const repo = locate(root, target.file)?.repo ?? null;
      if (text === null) return { status: "missing", lines: pinned.lines, reason: "file-missing", old: oldSpan(repo, pinned) };
      // 记录里的 blob 不在对象库里（或者文件已经不在任何仓里）：旧内容取不回来、diff 也做不了，判红说清楚，让人重新确认
      if (repo === null || !objectExists(repo, pinned.blob)) return { status: "missing", lines: pinned.lines, reason: "blob-missing", old: [] };

      const hunks = diffHunks(repo, pinned.blob, fileText(text));
      const lines = mappedSpan(mapRange(hunks, pinned.lines[0], pinned.lines[1]));
      if (lines === null) return { status: "missing", lines: pinned.lines, reason: "vanished", old: oldSpan(repo, pinned) };
      const span = sliceSpan(text, lines);
      if (span === null) return { status: "missing", lines: pinned.lines, reason: "vanished", old: oldSpan(repo, pinned) };
      if (hashSpan(span) === pinned.hash) return { status: "fresh", lines };
      const old = oldSpan(repo, pinned);
      return { status: "changed", lines, reason: "changed", diff: renderDiff(old, normalizeLines(span)), old };
    },
  };
}
