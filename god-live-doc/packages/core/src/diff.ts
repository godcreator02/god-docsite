/**
 * 行段映射与展示。两样都是纯函数，没有 git：
 *   mapRange / parseHunks   吃 hunk 表（谁给的不管，git 比较器给的是 `git diff -U0` 的输出），把旧行段映到新文件
 *   renderDiff              朴素 LCS，把两段文本并排成 `- / +`，只给人看
 */

import type { Span } from "./types.ts";

/** 一个 hunk：旧文件第 oldStart 起 oldLen 行，对应新文件第 newStart 起 newLen 行 */
export interface Hunk {
  oldStart: number;
  oldLen: number;
  newStart: number;
  newLen: number;
}

export type Mapped = { touched: boolean; start: number; end: number } | { touched: true; vanished: true };

/** 解析 `@@ -a[,b] +c[,d] @@`；b / d 省略表示 1 */
export function parseHunks(diffText: string): Hunk[] {
  const hunks: Hunk[] = [];
  for (const m of diffText.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    hunks.push({
      oldStart: Number(m[1]),
      oldLen: m[2] === undefined ? 1 : Number(m[2]),
      newStart: Number(m[3]),
      newLen: m[4] === undefined ? 1 : Number(m[4]),
    });
  }
  return hunks;
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
      // 纯插入：插在 oldStart 之后
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

  // 段内没被 hunk 覆盖的行照常平移——逐行算一遍最稳
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

/** 给人看的 unified 风格文本：` ` 不变、`-` 删、`+` 增。朴素 LCS，段几十行足够 */
export function renderDiff(oldLines: string[], newLines: string[]): string {
  const a = oldLines;
  const b = newLines;
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push(`- ${a[i]}`);
      i += 1;
    } else {
      out.push(`+ ${b[j]}`);
      j += 1;
    }
  }
  while (i < n) out.push(`- ${a[i++]}`);
  while (j < m) out.push(`+ ${b[j++]}`);
  return out.join("\n");
}
