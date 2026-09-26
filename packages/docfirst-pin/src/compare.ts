/**
 * 比较器：四种目标变没变怎么判、确认时记什么，全在这儿。纯函数，只看交进来的观察
 * （行段 / 整文件 / 名字是文件的行，目录树是名字表；取不到是 null），
 * 行段与整文件要的旧内容和 hunk 表从 `History` 取——那是环境层注进来的唯一不纯的两样。
 *
 * 行段的判定按这个顺序，前一步能下结论就不往下走：
 *   1. 记号上那几行的段哈希等于记录：绿，行号不动
 *   2. 当前整文件的 blob 名等于记录：内容没变，旧内容就是当前内容，不必去取
 *   3. 取得到旧内容：用 hunk 表把旧行段映到今天，段哈希对得上是绿（挪了位置），对不上是黄（带 diff 和旧段），
 *      整段删光是红 vanished
 *   4. 取不到旧内容：按段哈希在整个文件里滑窗找，找到是绿，找不到是黄 unlocated
 *   文件不在是红 file-missing
 * 第 4 步是有意设计的降级：记录里的 blob 名是确认时在进程里算的，确认之后、提交之前又改了文件，
 * 或者仓按 CRLF 存，这个 blob 就不会进对象库——少的只是 diff，不是错。
 *
 * 整文件只比整文件的段哈希；目录树只比名字表的哈希（旧表不存，变了是黄、给当前表）；
 * 名字只看字面量还在不在，没有黄。
 */

import { mapRange, mappedSpan, renderDiff } from "./diff.ts";
import { blobOf, fileText, hashNames, hashSpan, lineCount, normalizeLines, sliceSpan } from "./span.ts";
import { targetKey } from "./marker.ts";
import type {
  ContentRecord,
  FileTarget,
  History,
  Judgement,
  MemoRecord,
  Snapshot,
  Span,
  SpanTarget,
  Target,
  TreeRecord,
} from "./types.ts";

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

/** 文件里第一处含这个字面量的行号（1 起）；没有给 null */
export function findText(text: string[], needle: string): number | null {
  const i = text.findIndex((line) => line.includes(needle));
  return i === -1 ? null : i + 1;
}

/** 整文件的行段：[1, 行数]，空文件也算一行 */
const wholeSpan = (text: string[]): Span => [1, Math.max(1, lineCount(text))];

/**
 * 确认时整文件长什么样：blob 名跟当前内容一样就是当前内容，否则问 History；
 * 记录没有 blob（从 hash 记录迁过来的）给 null
 */
function oldTextOf(file: string, record: ContentRecord, text: string[] | null, history: History): { old: string; same: boolean } | null {
  if (record.blob === undefined) return null;
  if (text !== null && blobOf(text) === record.blob) return { old: fileText(text), same: true };
  const old = history.oldText(file, record.blob);
  return old === null ? null : { old, same: false };
}

function judgeSpan(target: SpanTarget, record: ContentRecord | null, text: string[] | null, history: History): Judgement {
  const want: Span = [target.a, target.b];
  if (text === null) {
    const was = record === null ? null : oldTextOf(target.file, record, null, history);
    return { status: "missing", lines: want, reason: "file-missing", ...(was !== null ? { old: sliceSpan(was.old.split("\n"), want) ?? [] } : {}) };
  }
  const here = sliceSpan(text, want);
  if (record === null) return here === null ? { status: "missing", lines: want, reason: "vanished" } : { status: "unconfirmed", lines: want };
  if (here !== null && hashSpan(here) === record.hash) return { status: "fresh", lines: want };

  const was = oldTextOf(target.file, record, text, history);
  if (was !== null) {
    const old = sliceSpan(was.old.split("\n"), want) ?? [];
    const hunks = was.same ? [] : history.hunks(was.old, fileText(text));
    const lines = mappedSpan(mapRange(hunks, target.a, target.b));
    const now = lines === null ? null : sliceSpan(text, lines);
    if (lines === null || now === null) return { status: "missing", lines: want, reason: "vanished", old };
    if (hashSpan(now) === record.hash) return { status: "fresh", lines };
    return { status: "changed", lines, reason: "changed", diff: renderDiff(old, now), old };
  }

  const length = target.b - target.a + 1;
  const start = findSpan(text, length, record.hash, target.a);
  if (start !== null) return { status: "fresh", lines: [start, start + length - 1] };
  if (here === null) return { status: "missing", lines: want, reason: "vanished" };
  return { status: "changed", lines: want, reason: "unlocated" };
}

function judgeFile(target: FileTarget, record: ContentRecord | null, text: string[] | null, history: History): Judgement {
  if (text === null) {
    const was = record === null ? null : oldTextOf(target.file, record, null, history);
    return { status: "missing", lines: [1, 1], reason: "file-missing", ...(was !== null ? { old: normalizeLines(was.old.split("\n")) } : {}) };
  }
  const lines = wholeSpan(text);
  if (record === null) return { status: "unconfirmed", lines };
  if (hashSpan(text) === record.hash) return { status: "fresh", lines };
  const was = oldTextOf(target.file, record, text, history);
  if (was === null) return { status: "changed", lines, reason: "changed" };
  const old = normalizeLines(was.old.split("\n"));
  return { status: "changed", lines, reason: "changed", diff: renderDiff(old, normalizeLines(text)), old };
}

function judgeTree(record: TreeRecord | null, names: string[] | null): Judgement {
  if (names === null) return { status: "missing", lines: [1, 1], reason: "dir-missing" };
  const lines: Span = [1, Math.max(1, names.length)];
  if (record === null) return { status: "unconfirmed", lines };
  if (hashNames(names) === record.hash) return { status: "fresh", lines };
  return { status: "changed", lines, reason: "changed" };
}

function judgeHas(needle: string, record: MemoRecord | null, text: string[] | null): Judgement {
  if (text === null) return { status: "missing", lines: [1, 1], reason: "file-missing" };
  const at = findText(text, needle);
  if (at === null) return { status: "missing", lines: [1, 1], reason: "text-missing" };
  return { status: record === null ? "unconfirmed" : "fresh", lines: [at, at] };
}

/** 核对一处引用：记录是记号上带的那份（null 是未确认），观察由调用方从读取器取好 */
export function judge(target: Target, record: MemoRecord | null, seen: string[] | null, history: History): Judgement {
  switch (target.kind) {
    case "span":
      return judgeSpan(target, record as ContentRecord | null, seen, history);
    case "file":
      return judgeFile(target, record as ContentRecord | null, seen, history);
    case "tree":
      return judgeTree(record as TreeRecord | null, seen);
    case "has":
      return judgeHas(target.text, record, seen);
  }
}

/**
 * 确认时出记录：行段 / 整文件记段哈希与整文件的 blob 名（都在进程里算，不问 git），
 * 目录树记名字表的哈希。钉不住的说清楚为什么
 */
export function snapshot(target: Target, seen: string[] | null): Snapshot {
  const where = targetKey(target);
  switch (target.kind) {
    case "span":
    case "file": {
      if (seen === null) return { problem: `${where} 文件不存在` };
      const span = sliceSpan(seen, target.kind === "span" ? [target.a, target.b] : wholeSpan(seen));
      if (span === null) return { problem: `${where} 行段超出文件` };
      return { record: { kind: "content", hash: hashSpan(span), blob: blobOf(seen) } };
    }
    case "tree":
      if (seen === null) return { problem: `${where} 目录不存在` };
      return { record: { kind: "tree", hash: hashNames(seen) } };
    case "has":
      if (seen === null) return { problem: `${where} 文件不存在` };
      if (findText(seen, target.text) === null) return { problem: `${where} 文件里没有这个名字` };
      return { record: { kind: "has" } };
  }
}
