/**
 * 逐行对比，一套算法两种用法，都出自 `diff` 库的 `diffArrays`：
 *   hunksOf     整文件旧内容与当前内容之间的 hunk 表，mapRange 拿它把旧行段映到今天
 *   diffLines   旧段与当前段的逐行对比，给人看
 */

import { diffArrays } from "diff";
import type { DiffLine, Span } from "./types.ts";

/** 一个 hunk，写法同 `git diff -U0`：旧文件第 oldStart 起 oldLen 行，对应新文件第 newStart 起 newLen 行；长度是 0 的一侧，起点是它前面那一行 */
export interface Hunk {
  oldStart: number;
  oldLen: number;
  newStart: number;
  newLen: number;
}

export type Mapped = { touched: boolean; start: number; end: number } | { touched: true; vanished: true };

/** 文件末换行切出来的那个空串不是一行：留着它会被当成一行空行去跟别处的空行对齐 */
const withoutFinalNewline = (lines: string[]): string[] => (lines.length > 0 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines);

/** 两份按行切好的文本之间的 hunk 表：连在一起的删与增合成一个 hunk */
export function hunksOf(oldLines: string[], newLines: string[]): Hunk[] {
  const hunks: Hunk[] = [];
  let oldLine = 1;
  let newLine = 1;
  let open: Hunk | null = null;
  for (const change of diffArrays(withoutFinalNewline(oldLines), withoutFinalNewline(newLines))) {
    if (!change.added && !change.removed) {
      open = null;
      oldLine += change.count;
      newLine += change.count;
      continue;
    }
    if (open === null) {
      open = { oldStart: oldLine, oldLen: 0, newStart: newLine, newLen: 0 };
      hunks.push(open);
    }
    if (change.removed) {
      open.oldLen += change.count;
      oldLine += change.count;
    } else {
      open.newLen += change.count;
      newLine += change.count;
    }
  }
  for (const hunk of hunks) {
    if (hunk.oldLen === 0) hunk.oldStart -= 1;
    if (hunk.newLen === 0) hunk.newStart -= 1;
  }
  return hunks;
}

/** 旧段与当前段的逐行对比：同一处改动先列删掉的旧行，再列加上的新行 */
export function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  return diffArrays(oldLines, newLines).flatMap((change) => {
    const kind: DiffLine["kind"] = change.removed ? "removed" : change.added ? "added" : "same";
    return change.value.map((text) => ({ kind, text }));
  });
}

const DIFF_PREFIX: Record<DiffLine["kind"], string> = { same: "  ", removed: "- ", added: "+ " };

/** 逐行对比写成 unified 风格的文本：`  ` 没动、`- ` 删、`+ ` 增 */
export function diffText(lines: DiffLine[]): string {
  return lines.map(({ kind, text }) => `${DIFF_PREFIX[kind]}${text}`).join("\n");
}

/**
 * 把旧文件的行段 [start, end] 按 hunk 表映到新文件。
 *
 * - 没有 hunk 碰到这段：只是平移，`touched: false`
 * - 有 hunk 碰到：`touched: true`，新行段 = 「段内没动的行映过去」∪「碰到段的 hunk 的新行」
 * - 段内每一行都落在纯删除 hunk 里、且没有任何 hunk 往段里插东西：`vanished`
 *
 * 纯插入 hunk（oldLen 0）的 oldStart 是「插在它后面」的那行：插在段首之前或段尾之后不算碰。
 */
export function mapRange(hunks: Hunk[], start: number, end: number): Mapped {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  let touched = false;
  let offsetBefore = 0;

  for (const h of hunks) {
    const oldEnd = h.oldStart + h.oldLen - 1;
    if (h.oldLen === 0) {
      if (h.oldStart < start || h.oldStart >= end) {
        if (h.oldStart < start) offsetBefore += h.newLen;
        continue;
      }
      touched = true;
      lo = Math.min(lo, h.newStart);
      hi = Math.max(hi, h.newStart + h.newLen - 1);
      continue;
    }
    if (oldEnd < start) {
      offsetBefore += h.newLen - h.oldLen;
      continue;
    }
    if (h.oldStart > end) break;
    touched = true;
    if (h.newLen > 0) {
      lo = Math.min(lo, h.newStart);
      hi = Math.max(hi, h.newStart + h.newLen - 1);
    }
  }

  if (!touched) return { touched: false, start: start + offsetBefore, end: end + offsetBefore };

  for (let line = start; line <= end; line += 1) {
    const mapped = mapLine(hunks, line);
    if (mapped !== null) {
      lo = Math.min(lo, mapped);
      hi = Math.max(hi, mapped);
    }
  }
  if (lo === Number.POSITIVE_INFINITY) return { touched: true, vanished: true };
  return { touched: true, start: lo, end: hi };
}

/** 映射结果 → 行段；整段没了给 null */
export function mappedSpan(mapped: Mapped): Span | null {
  return "vanished" in mapped ? null : [mapped.start, mapped.end];
}

/** 单行映射：落在删除 hunk 里回 null，否则回它在新文件的行号 */
function mapLine(hunks: Hunk[], line: number): number | null {
  let offset = 0;
  for (const h of hunks) {
    const oldEnd = h.oldStart + h.oldLen - 1;
    if (h.oldLen === 0) {
      if (h.oldStart < line) offset += h.newLen;
      continue;
    }
    if (oldEnd < line) {
      offset += h.newLen - h.oldLen;
      continue;
    }
    if (h.oldStart <= line) return null;
    break;
  }
  return line + offset;
}
