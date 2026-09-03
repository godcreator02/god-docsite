/**
 * 段的归一化与哈希。规矩一条：**站展示什么就哈希什么**——展示前做的归一化就是哈希前做的归一化，
 * 两处共用这一个函数，比较器之间也共用。
 *
 * 归一化只做三件事：换行统一成 LF、去每行行尾空白、去掉末尾的空行。缩进保留、注释保留
 * （JSDoc 是契约的一部分，改了就该黄）。
 */

import { createHash } from "node:crypto";
import type { Span } from "./types.ts";

/** 一段文本归一化成行数组 */
export function normalizeLines(lines: string[]): string[] {
  const out = lines.map((line) => line.replace(/\r$/, "").replace(/\s+$/, ""));
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

export function normalize(text: string): string {
  return normalizeLines(text.split(/\r?\n/)).join("\n");
}

export function hashSpan(lines: string[]): string {
  return createHash("sha256").update(normalizeLines(lines).join("\n"), "utf8").digest("hex");
}

/**
 * 取出 [a, b] 这几行（1 起、闭区间）并归一化；行段超出文件就给 null——引用指向空气。
 * 整文件按行读进来的最后一个元素常常是文件末换行留下的空串，它不算一行内容。
 */
export function sliceSpan(lines: string[] | null, [a, b]: Span): string[] | null {
  if (lines === null) return null;
  const n = lineCount(lines);
  if (a < 1 || b < a || b > n) return null;
  return normalizeLines(lines.slice(a - 1, b));
}

/** 文件有多少行：末尾换行留下的那个空串不算 */
export function lineCount(lines: string[]): number {
  return lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

/** 整文件文本，换行统一成 LF——git 对象库里存的是 LF，工作区是不是 CRLF 不该改变判定 */
export function fileText(lines: string[]): string {
  return lines.map((line) => line.replace(/\r$/, "")).join("\n");
}
