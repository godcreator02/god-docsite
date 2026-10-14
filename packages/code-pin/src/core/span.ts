/**
 * 段的归一化与几种哈希。站展示什么就哈希什么：展示前的归一化与哈希前的归一化共用 `normalizeLines`。
 *
 * 归一化只做三件事：换行统一成 LF、去每行行尾空白、去掉末尾的空行。缩进与注释保留（JSDoc 是契约的一部分，改了就该黄）。
 * 记在记号上的哈希一律取前 12 位十六进制（`RECORD_HASH_LENGTH`）。
 */

import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { Span } from "./types.ts";

export const RECORD_HASH_LENGTH = 12;

const shortHex = (bytes: Uint8Array): string => bytesToHex(bytes).slice(0, RECORD_HASH_LENGTH);

/** 一段文本归一化成行数组 */
export function normalizeLines(lines: string[]): string[] {
  const out = lines.map((line) => line.replace(/\r$/, "").replace(/\s+$/, ""));
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

export function normalize(text: string): string {
  return normalizeLines(text.split(/\r?\n/)).join("\n");
}

/** 段哈希：归一化后 sha256 的前 12 位 */
export function hashSpan(lines: string[]): string {
  return shortHex(sha256(utf8ToBytes(normalizeLines(lines).join("\n"))));
}

/** 目录树名字表的哈希：名字按行拼起来 sha256 的前 12 位 */
export function hashNames(names: string[]): string {
  return shortHex(sha256(utf8ToBytes(names.join("\n"))));
}

/** 一段文本的 git blob 名（完整 40 位），只算不写：`sha1("blob " + 字节数 + "\0" + 内容)`，跟 `git hash-object --stdin` 逐字节相同 */
export function hashText(text: string): string {
  const body = utf8ToBytes(text);
  return bytesToHex(sha1(concatBytes(utf8ToBytes(`blob ${body.length}\0`), body)));
}

/** 按行读进来的整文件的 blob 名前缀：换行统一成 LF 再按 git 的算法算。仓按 LF 存时，这就是这份内容提交后的 blob 名 */
export function blobOf(lines: string[]): string {
  return hashText(fileText(lines)).slice(0, RECORD_HASH_LENGTH);
}

/**
 * 取出 [a, b] 这几行（1 起、闭区间）并归一化；行段超出文件就给 null。
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

/** 整文件文本，换行统一成 LF：git 对象库里存的是 LF，工作区是不是 CRLF 不该改变判定 */
export function fileText(lines: string[]): string {
  return lines.map((line) => line.replace(/\r$/, "")).join("\n");
}
