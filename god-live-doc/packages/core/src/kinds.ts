/**
 * 目录树、存在性、名字三种目标的比较器，外加按目标种类分派的 createKindComparator。
 * 都是纯函数：只看读取器给的观察（目录树是名字表，存在性是 ["file"] / ["dir"]，名字是文件的行）。
 *
 *   tree    记忆是名字表本身（几十个名字，不算「第二份内容」）。名字多了少了是黄，带 `- / +`；目录没了是红
 *   exists  记忆是类型。不在、类型变了是红；absent（断言不在）时它出现了是红。没有黄
 *   has     记忆只有「在」。文件里找不到这个字面量是红。没有黄
 */

import { renderDiff } from "./diff.ts";
import type { Comparator, Judgement, MemoRecord, Snapshot, Span, Target } from "./types.ts";
import { targetKey } from "./types.ts";

export interface TreeRecord extends MemoRecord {
  kind: "tree";
  names: string[];
}

export interface ExistsRecord extends MemoRecord {
  kind: "exists";
  /** file / dir，absent 断言时是 "absent" */
  type: string;
}

export interface HasRecord extends MemoRecord {
  kind: "has";
}

const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const count = (names: string[] | null): Span => [1, Math.max(1, names?.length ?? 0)];

export function createTreeComparator(): Comparator {
  return {
    kind: "tree",
    snapshot(target: Target, names: string[] | null): Snapshot {
      if (target.kind !== "tree") return { problem: `${targetKey(target)} 不是目录树` };
      if (names === null) return { problem: `${targetKey(target)} 目录不存在` };
      const record: TreeRecord = { kind: "tree", names: [...names] };
      return { record };
    },
    judge(record: MemoRecord | null, target: Target, names: string[] | null): Judgement {
      const pinned = record !== null && record.kind === "tree" ? (record as TreeRecord) : null;
      if (names === null) return { status: "missing", lines: count(pinned?.names ?? null), reason: "dir-missing", old: pinned?.names ?? [] };
      const lines = count(names);
      if (pinned === null) return { status: "unconfirmed", lines };
      if (same(pinned.names, names)) return { status: "fresh", lines };
      return { status: "changed", lines, reason: "changed", diff: renderDiff(pinned.names, names), old: pinned.names };
    },
  };
}

export function createExistsComparator(): Comparator {
  return {
    kind: "exists",
    snapshot(target: Target, seen: string[] | null): Snapshot {
      if (target.kind !== "exists") return { problem: `${targetKey(target)} 不是存在性引用` };
      const type = seen?.[0] ?? null;
      if (target.absent) {
        if (type !== null) return { problem: `${targetKey(target)} 断言它不在，它却在（${type}）` };
        const record: ExistsRecord = { kind: "exists", type: "absent" };
        return { record };
      }
      if (type === null) return { problem: `${targetKey(target)} 不存在` };
      const record: ExistsRecord = { kind: "exists", type };
      return { record };
    },
    judge(record: MemoRecord | null, target: Target, seen: string[] | null): Judgement {
      const lines: Span = [1, 1];
      if (target.kind !== "exists") return { status: "unconfirmed", lines };
      const pinned = record !== null && record.kind === "exists" ? (record as ExistsRecord) : null;
      const type = seen?.[0] ?? null;
      if (target.absent) {
        if (type !== null) return { status: "missing", lines, reason: "appeared" };
        return { status: pinned === null ? "unconfirmed" : "fresh", lines };
      }
      if (type === null) return { status: "missing", lines, reason: "file-missing" };
      if (pinned === null) return { status: "unconfirmed", lines };
      if (pinned.type !== type) return { status: "missing", lines, reason: "type-changed", old: [pinned.type] };
      return { status: "fresh", lines };
    },
  };
}

/** 文件里第一处含这个字面量的行号（1 起）；没有给 null */
export function findText(text: string[], needle: string): number | null {
  const i = text.findIndex((line) => line.includes(needle));
  return i === -1 ? null : i + 1;
}

export function createHasComparator(): Comparator {
  return {
    kind: "has",
    snapshot(target: Target, text: string[] | null): Snapshot {
      if (target.kind !== "has") return { problem: `${targetKey(target)} 不是名字引用` };
      if (text === null) return { problem: `${targetKey(target)} 文件不存在` };
      if (findText(text, target.text) === null) return { problem: `${targetKey(target)} 文件里没有这个名字` };
      const record: HasRecord = { kind: "has" };
      return { record };
    },
    judge(record: MemoRecord | null, target: Target, text: string[] | null): Judgement {
      if (target.kind !== "has") return { status: "unconfirmed", lines: [1, 1] };
      if (text === null) return { status: "missing", lines: [1, 1], reason: "file-missing" };
      const at = findText(text, target.text);
      if (at === null) return { status: "missing", lines: [1, 1], reason: "text-missing" };
      const lines: Span = [at, at];
      return { status: record !== null && record.kind === "has" ? "fresh" : "unconfirmed", lines };
    },
  };
}

/**
 * 按目标种类分派：行段和整文件走 span 那个（git / hash / auto），目录树、存在性、名字各走各的。
 * 少给的种类用核心的默认实现。
 */
export function createKindComparator(parts: { span: Comparator; tree?: Comparator; exists?: Comparator; has?: Comparator }): Comparator {
  const tree = parts.tree ?? createTreeComparator();
  const exists = parts.exists ?? createExistsComparator();
  const has = parts.has ?? createHasComparator();
  const pick = (target: Target): Comparator =>
    target.kind === "tree" ? tree : target.kind === "exists" ? exists : target.kind === "has" ? has : parts.span;
  return {
    kind: "kinds",
    snapshot: (target, text) => pick(target).snapshot(target, text),
    judge: (record, target, text) => pick(target).judge(record, target, text),
  };
}
