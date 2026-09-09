/**
 * hash 比较器：只记段哈希和旧行号，别的什么都不记，也不问 git。管行段和整文件两种目标。
 *
 * 给不在 git 里的文件用（被 .gitignore 忽略的 node_modules、不在任何仓里的目录），也在测试里当第二实现。
 * 行段靠**滑窗**跟：段长固定，先看旧位置，不对就在当前文件里逐行滑一遍找同哈希的窗口——
 * 内容没变、只是挪了位置，照样绿、带新行号。撞车（同样的段出现不止一处）取离旧位置最近的，
 * 并列就不猜。找不到就是「有变动、位置不明」：没有旧内容，给不出 diff，行号停在旧位置，等人重钉。
 * 整文件只比整文件哈希，没有位置这回事。
 */

import { hashSpan, lineCount, sliceSpan } from "./span.ts";
import type { Comparator, Judgement, MemoRecord, Snapshot, Span, Target } from "./types.ts";
import { targetKey } from "./types.ts";

/** hash 版的记录 */
export interface HashRecord extends MemoRecord {
  kind: "hash";
  lines: Span;
  hash: string;
}

/**
 * 在整文件里找哈希等于 hash、长度为 length 的窗口，交回离 near 最近的起始行；
 * 找不到、或者两处离得一样近，都交回 null
 */
export function findSpan(text: string[], length: number, hash: string, near: number): number | null {
  const last = lineCount(text) - length + 1;
  let best: number | null = null;
  let tie = false;
  for (let start = 1; start <= last; start += 1) {
    if (hashSpan(text.slice(start - 1, start - 1 + length)) !== hash) continue;
    const distance = Math.abs(start - near);
    if (best === null || distance < Math.abs(best - near)) {
      best = start;
      tie = false;
    } else if (distance === Math.abs(best - near)) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/** 目标要的行段：行段是记号上那几行，整文件是 [1, 行数] */
export function wantedSpan(target: Target, text: string[]): Span | null {
  if (target.kind === "span") return [target.a, target.b];
  if (target.kind === "file") return [1, Math.max(1, lineCount(text))];
  return null;
}

export function createHashComparator(): Comparator {
  return {
    kind: "hash",

    snapshot(target: Target, text: string[] | null): Snapshot {
      const where = targetKey(target);
      if (text === null) return { problem: `${where} 文件读不到` };
      const lines = wantedSpan(target, text);
      if (lines === null) return { problem: `${where} 不是行段也不是整文件` };
      const span = sliceSpan(text, lines);
      if (span === null) return { problem: `${where} 行段超出文件` };
      const record: HashRecord = { kind: "hash", lines, hash: hashSpan(span) };
      return { record };
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      // 别家的记录不认，当没确认过——记录格式是各比较器自己的，翻译就是猜
      const pinned = record !== null && record.kind === "hash" ? (record as HashRecord) : null;
      if (text === null) return { status: "missing", lines: pinned?.lines ?? [1, 1], reason: "file-missing" };
      if (target.kind === "file") {
        const lines: Span = [1, Math.max(1, lineCount(text))];
        if (pinned === null) return { status: "unconfirmed", lines };
        return hashSpan(text) === pinned.hash ? { status: "fresh", lines } : { status: "changed", lines, reason: "changed" };
      }
      if (target.kind !== "span") return { status: "unconfirmed", lines: [1, 1] };
      const lines: Span = pinned === null ? [target.a, target.b] : pinned.lines;
      const span = sliceSpan(text, lines);
      if (pinned === null) return span === null ? { status: "missing", lines, reason: "vanished" } : { status: "unconfirmed", lines };
      if (span !== null && hashSpan(span) === pinned.hash) return { status: "fresh", lines };

      const length = lines[1] - lines[0] + 1;
      const start = findSpan(text, length, pinned.hash, lines[0]);
      if (start !== null) return { status: "fresh", lines: [start, start + length - 1] };
      // 旧位置已经超出文件：当整段没了；旧位置还在：内容变了但找不到它，位置不明
      if (span === null) return { status: "missing", lines, reason: "vanished" };
      return { status: "changed", lines, reason: "unlocated" };
    },
  };
}
