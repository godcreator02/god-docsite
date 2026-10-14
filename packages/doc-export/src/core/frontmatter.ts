/**
 * 正本的 frontmatter：按 YAML core schema 解析（yaml 库），点名的字段把作者写下的那几行原样抄出来，
 * 生成物头部长什么样作者一眼对得上（块式列表、多行标量的续行一并带上）。
 */
import { isMap, isNode, isScalar, parseDocument } from "yaml";
import type { Node } from "yaml";

/** 正本开头的 frontmatter 块（不含两条 `---`）；没有 frontmatter 给 null。BOM 与 CRLF 先归一 */
function frontmatterBlockOf(source: string): string | null {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 3);
  return end < 0 ? null : text.slice(4, end + 1);
}

/** 点名的字段：按点名的顺序原样成行；源里没有的字段列在 missing。frontmatter 不是合法的 YAML 映射就报错 */
export function pickFrontmatter(source: string, fields: string[]): { lines: string[]; missing: string[] } {
  const block = frontmatterBlockOf(source);
  if (block === null) return { lines: [], missing: [...fields] };
  const doc = parseDocument(block, { schema: "core" });
  if (doc.errors.length > 0) throw new Error(`frontmatter 不是合法的 YAML：${doc.errors.map((e) => e.message).join("；")}`);
  if (doc.contents !== null && !isMap(doc.contents)) throw new Error("frontmatter 要是 键: 值 的映射");
  const pairs = doc.contents?.items ?? [];
  const lines: string[] = [];
  const missing: string[] = [];
  for (const field of fields) {
    const pair = pairs.find((p) => isScalar(p.key) && p.key.value === field);
    if (pair === undefined) {
      missing.push(field);
      continue;
    }
    // 解析出来的节点都带 range：[起点, 值的终点, 节点的终点]，下标是 block 里的字符位置
    const start = (pair.key as Node).range![0];
    const end = isNode(pair.value) ? pair.value.range![2] : (pair.key as Node).range![2];
    lines.push(...block.slice(start, end).trimEnd().split("\n"));
  }
  return { lines, missing };
}

/** 正文加上 frontmatter：没挑出任何字段就是正文本身 */
export function withFrontmatter(body: string, lines: string[]): string {
  if (lines.length === 0) return body;
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}
