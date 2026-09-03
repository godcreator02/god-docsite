/**
 * hash 比较器：只记段哈希，别的什么都不记。
 *
 * 它不跟行段——记号上写的是哪几行，就一直看那几行。代码往下挪了它只会说「有变动」，
 * 说不出「挪到哪儿了」，也拿不回旧内容（记忆里没存第二份）。
 * 用处两个：没有 git 的目录能用；以及在测试里当第二实现，证明比较器接口真能换。
 */

import { hashSpan, sliceSpan } from "./span.ts";
import type { Comparator, Judgement, MemoRecord, Snapshot, Span, Target } from "./types.ts";

/** hash 版的记录 */
export interface HashRecord extends MemoRecord {
  kind: "hash";
  lines: Span;
  hash: string;
}

export function createHashComparator(): Comparator {
  return {
    kind: "hash",

    snapshot(target: Target, text: string[] | null): Snapshot {
      if (text === null) return { problem: `${target.file}:${target.a}-${target.b} 文件读不到` };
      const span = sliceSpan(text, [target.a, target.b]);
      if (span === null) return { problem: `${target.file}:${target.a}-${target.b} 行段超出文件` };
      const record: HashRecord = { kind: "hash", lines: [target.a, target.b], hash: hashSpan(span) };
      return { record };
    },

    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      const lines: Span = record === null ? [target.a, target.b] : (record as HashRecord).lines;
      if (text === null) return { status: "missing", lines, reason: "file-missing" };
      const span = sliceSpan(text, lines);
      if (span === null) return { status: "missing", lines, reason: "vanished" };
      if (record === null) return { status: "unconfirmed", lines };
      return hashSpan(span) === (record as HashRecord).hash ? { status: "fresh", lines } : { status: "changed", lines, reason: "changed" };
    },
  };
}
