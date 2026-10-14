/**
 * 卡之间的引用：正文里的关系行（`supersedes::` / `pivots-from::`），与链接目标怎么还原成卡身份。
 * 关系行、站上卡链接的改写、卡页地址都用这里的同一套认法。
 */

import type { EdgeKind, Relation } from "./model/types.ts";
import { CARD_EXT, cardIdOfFile } from "./card-files.ts";
import { splitLines } from "./lines.ts";

/** 正文里的关系：一行一条，整行是「字段:: 一条 md 链接」`[文字](卡身份.md)`，链接目标可带百分号编码、`./` 前缀与 `#` 锚。 */
const EDGE_LINE = /^(supersedes|pivots-from)::[ \t]*\[[^\]\n]*\]\(([^()<>\s]*)\)[ \t]*$/;

/** 行头是关系字段：匹配上但整行不合 EDGE_LINE 的，报成格式不对的行。 */
export const EDGE_HEAD = /^(supersedes|pivots-from)::/;

/** md link 的目标段还原成卡身份：百分号解码 → 剥 `./` 前缀 → 剥 `#` 锚 → 剥 `.md` / `.mdx` 后缀。
 * 解码失败（目标里有单独的 `%`）按原样用——写错的链接应该在结果里显出来，不该让整次扫描卡目录抛错。 */
export function cardIdFromHref(href: string): string {
  let target = href.trim();
  try {
    target = decodeURIComponent(target);
  } catch {
    /* 不是合法百分号序列：原样用 */
  }
  target = target.replace(/^\.\//, "");
  const hash = target.indexOf("#");
  if (hash >= 0) target = target.slice(0, hash);
  return cardIdOfFile(target).trim();
}

/** 正文关系边提取的结果：解析成功的边与格式不对的行分开放。
 * broken 只放「行头是关系字段、整行格式不对」这一类（文件级病，跟星轨盘上有哪些卡无关）；
 * 「指向的卡不在星轨盘上」要拿星轨盘上的卡集合来判断，归星轨盘建模时的 broken。 */
export interface ExtractedRelations {
  relations: Relation[];
  broken: Array<{ key: string; target: string }>;
}

/** 扫正文收关系边：一行一条，链接目标去掉编码、锚与后缀即卡身份。
 * 行头是关系字段、整行格式却不对的收进 broken——以前出过这种行被静默丢掉的问题（CRLF 行尾的关系行全部丢失）。 */
export function extractRelations(body: string): ExtractedRelations {
  const relations: Relation[] = [];
  const broken: Array<{ key: string; target: string }> = [];
  for (const line of splitLines(body)) {
    const match = EDGE_LINE.exec(line);
    if (!match) {
      const head = EDGE_HEAD.exec(line);
      if (head) broken.push({ key: head[1] as string, target: line.slice((head[0] as string).length).trim() });
      continue;
    }
    const kind: EdgeKind = match[1] === "supersedes" ? "supersede" : "pivot";
    const target = cardIdFromHref(match[2] as string);
    if (target === "") {
      broken.push({ key: match[1] as string, target: line.slice(line.indexOf("::") + 2).trim() });
      continue;
    }
    relations.push({ kind, target });
  }
  return { relations, broken };
}
