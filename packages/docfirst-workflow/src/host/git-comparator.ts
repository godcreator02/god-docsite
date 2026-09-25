/**
 * git 比较器：记忆就是那个仓 HEAD 里的 blob，哪儿都不存第二份内容。管行段和整文件两种目标。
 *
 * 被引文件在哪个仓按它自己的位置定（见 git.ts 的 locate）：项目自己的仓、别的仓一视同仁。
 * - **确认**（snapshot）要过几道检查：得在某个仓里、那个仓得有过提交、文件得在 HEAD 里（未跟踪、被忽略、
 *   大小写不符都拒）、工作区得干净。记下 blob、commit、行段、段哈希——不记仓在哪，blob 是内容寻址的，
 *   核对时从文件位置重新找仓。
 * - **核对**（judge）先比哈希：当前内容跟记录一字不差（行段比 blob 名、整文件比整文件哈希）就判绿，
 *   不取旧内容、不起 git。内容变了才从 blob 取旧内容，用 `git diff -U0 旧内容 当前内容` 出 hunk 表，把旧行段映到今天：
 *   整段删光是 vanished，文件没了是 file-missing，内容变了而 blob 不在对象库（浅克隆、历史重写、仓换了）是 blob-missing；
 *   映到的那段哈希等于记录就绿，否则黄——黄带着给人看的 diff 和从 blob 取回的旧段。
 *   **绿只认段哈希**：hunk 说没碰到也再比一次，行映射跟内容对不上时宁可报黄让人复核。
 *   整文件不映行段，只比整文件哈希，黄的 diff 是整份对整份。
 */

import { fileText, hashSpan, lineCount, mapRange, mappedSpan, normalizeLines, renderDiff, sliceSpan, targetKey, wantedSpan } from "../engine/index.ts";
import type { Comparator, Hunk, Judgement, MemoRecord, Snapshot, Span, Target } from "../engine/index.ts";
import { diffHunks, hashText, headBlob, headCommit, isClean, isIgnored, locate, readBlob } from "./git.ts";

/** git 版的记录。lines 是**旧 blob 里**的位置，judge 从那儿出发往今天映 */
export interface GitRecord extends MemoRecord {
  kind: "git";
  blob: string;
  commit: string;
  lines: Span;
  hash: string;
}

export function createGitComparator({ root }: { root: string }): Comparator {
  /** 记录里的旧 blob 的内容；仓找不到、blob 不在对象库里给 null */
  function pinnedText(repo: string | null, record: GitRecord): string | null {
    return repo === null ? null : readBlob(repo, record.blob);
  }

  /** 记录里那段旧内容，从 blob 取回；仓找不到、blob 没了给空 */
  function oldSpan(repo: string | null, record: GitRecord): string[] {
    const old = pinnedText(repo, record);
    if (old === null) return [];
    return sliceSpan(old.split("\n"), record.lines) ?? [];
  }

  return {
    kind: "git",

    snapshot(target: Target, text: string[] | null): Snapshot {
      const where = targetKey(target);
      if (target.kind !== "span" && target.kind !== "file") return { problem: `${where} 不是行段也不是整文件` };
      if (text === null) return { problem: `${where} 文件不存在` };
      const lines = wantedSpan(target, text)!;
      const span = sliceSpan(text, lines);
      if (span === null) return { problem: `${where} 行段超出文件` };
      try {
        const at = locate(root, target.file);
        if (at === null) return { problem: `${where} 不在任何 git 仓里——git 记忆只对仓里的文件做` };
        // 三道检查各问一句 git，一句都不重复：仓有没有提交、文件在不在 HEAD 里（顺带拿到 blob）、工作区干不干净
        const commit = headCommit(at.repo);
        if (commit === null) return { problem: `${where} 所在的仓还没有一次提交——先 commit` };
        const blob = headBlob(at);
        if (blob === null) {
          return {
            problem: isIgnored(at)
              ? `${where} 被 .gitignore 忽略——git 记忆只对已提交的内容做`
              : `${where} 未跟踪（或路径大小写跟 git 记录不符）——钉住只对已提交的内容做，先 commit`,
          };
        }
        if (!isClean(at)) return { problem: `${where} 未提交——钉住只对已提交的内容做，先 commit` };
        const record: GitRecord = { kind: "git", blob, commit, lines, hash: hashSpan(span) };
        return { record };
      } catch (err) {
        return { problem: `${where} 问不了 git：${(err as Error).message.trim().split("\n")[0]}` };
      }
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      if (target.kind !== "span" && target.kind !== "file") return { status: "unconfirmed", lines: [1, 1] };
      // 别家的记录不认，当没确认过——记录格式是各比较器自己的，翻译就是猜
      if (record === null || record.kind !== "git") {
        if (text === null) return { status: "missing", lines: [1, 1], reason: "file-missing" };
        const lines = wantedSpan(target, text)!;
        if (sliceSpan(text, lines) === null) return { status: "missing", lines, reason: "vanished" };
        return { status: "unconfirmed", lines };
      }
      const pinned = record as GitRecord;
      // 文件没了也能定位：从它原来的目录往上找仓，旧内容照样从 blob 取回
      const repo = locate(root, target.file)?.repo ?? null;
      if (text === null) return { status: "missing", lines: pinned.lines, reason: "file-missing", old: oldSpan(repo, pinned) };
      // 记录里的 blob 不在对象库里（或者文件已经不在任何仓里）：旧内容取不回来、diff 也做不了，判红说清楚，让人重新确认
      const blobMissing: Judgement = { status: "missing", lines: pinned.lines, reason: "blob-missing", old: [] };

      if (target.kind === "file") {
        const lines: Span = [1, Math.max(1, lineCount(text))];
        if (hashSpan(text) === pinned.hash) return { status: "fresh", lines };
        const old = pinnedText(repo, pinned);
        if (old === null) return blobMissing;
        const oldLines = normalizeLines(old.split("\n"));
        return { status: "changed", lines, reason: "changed", diff: renderDiff(oldLines, normalizeLines(text)), old: oldLines };
      }

      // 文件整份跟记录里的 blob 一样，行段原地不动：用不着旧内容，也就不去问对象库
      const current = fileText(text);
      let hunks: Hunk[] = [];
      if (hashText(current) !== pinned.blob) {
        const old = pinnedText(repo, pinned);
        if (old === null) return blobMissing;
        hunks = diffHunks(pinned.blob, old, current);
      }
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
