/**
 * 卡文件的行级解析器——frontmatter、正文关系边、根卡里程碑区块，全在这一份里。
 *
 * frontmatter 一律按行扫、按字符串取值，不引 YAML 库：`born-at: 2026-05-06`（日级存量写法）
 * 是合法的 YAML date，任何 YAML 库默认 schema 都会把它解析成 `Date` 对象，`String()` 之后
 * 得到「Tue May 06 2026 08:00:00 GMT+0800」——born-at 的格式校验全部失败，日级存量卡全部
 * 被判字段病、画不上星轨盘，而且不报错（星轨盘照样画出来，只是少了卡、少了环）。
 *
 * 这里只把值读成字符串，由用到的代码自己取：card.ts 按 CARD_KEYS 与自己要的几个键读，值的形状（单个值还是列表）也由它查。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/parse.ts`（只读参考，本仓不 import 它）。
 */

import type { EdgeKind, Milestone, Relation } from "@godcreator/trajectory-disk";

/** 卡体系字段：frontmatter 里一个都没有的文件不是卡，校验直接跳过。
 * status 不在其列——它是可以随意写的字段，单凭一个 status 不足以认定这是张卡。 */
export const CARD_KEYS = ["type", "born-at", "parent", "label", "domain"] as const;

/** 根卡正文末尾装里程碑的固定 H2 区块名。 */
export const MILESTONE_HEADING = "里程碑";

/** 正文里的关系：一行一条，整行是「字段:: 一条 md 链接」`[文字](卡身份.md)`，链接目标可带百分号编码、`./` 前缀与 `#` 锚。 */
const EDGE_LINE = /^(supersedes|pivots-from)::[ \t]*\[[^\]\n]*\]\(([^()<>\s]*)\)[ \t]*$/;

/** 行头是关系字段：匹配上但整行不合 EDGE_LINE 的，报成格式不对的行。 */
const EDGE_HEAD = /^(supersedes|pivots-from)::/;

/** frontmatter 里的一条标量 / 列表起始行。 */
const KV_LINE = /^([\w-]+):[ \t]*(.*)$/;

/** frontmatter 里的一个块式列表项（缩进 + 短横）。 */
const LIST_ITEM = /^[ \t]+-[ \t]+(.*)$/;

/** 里程碑行：`- 日期｜标题｜描述`，竖线是全角 U+FF5C，描述段可缺。 */
const MILESTONE_LINE = /^-\s+([^｜]+)｜([^｜]+)(?:｜([\s\S]*))?\s*$/;

/** frontmatter 一律解析成字符串或字符串列表，不做类型推断（原因见文件头）。 */
export type Frontmatter = Record<string, string | string[]>;

/** 切行：CRLF 与 LF 混用的行尾在这里统一去掉，后面的正则不用再处理 \r。 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** 剥掉 frontmatter，只留正文。 */
export function stripFrontmatter(src: string): string {
  return src.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, "");
}

/** 剥成对引号：`- "tfix-..."` 这种带引号的列表项是真实写法。 */
function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && (trimmed.startsWith('"') || trimmed.startsWith("'")) && trimmed.endsWith(trimmed[0] as string)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** 流式列表 `[a, b]`：card-format 正本里 parent 就是这个写法。
 * 空串项丢掉——`[]` 解析成空列表而不是一个空串项。 */
function parseFlowList(raw: string): string[] {
  return raw
    .slice(1, -1)
    .split(",")
    .map(unquote)
    .filter((v) => v !== "");
}

/** 行级 frontmatter 解析：BOM / CRLF / 引号 / 块式列表 / 流式列表五种写法都能解析，
 * 值一律留字符串。没有 frontmatter 块返回 null。 */
export function parseFrontmatter(raw: string): Frontmatter | null {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  const fm: Frontmatter = {};
  let listKey: string | null = null;
  for (const line of text.slice(4, end).split("\n")) {
    const item = LIST_ITEM.exec(line);
    if (item && listKey) {
      (fm[listKey] as string[]).push(unquote(item[1] as string));
      continue;
    }
    const kv = KV_LINE.exec(line);
    if (!kv) continue;
    const key = kv[1] as string;
    const value = (kv[2] as string).trim();
    if (value === "") {
      /* 键后无值：后续缩进短横行是它的列表项 */
      fm[key] = [];
      listKey = key;
      continue;
    }
    fm[key] = value.startsWith("[") && value.endsWith("]") ? parseFlowList(value) : unquote(value);
    listKey = null;
  }
  return fm;
}

/** 正文关系边提取的结果：解析成功的边与格式不对的行分开放。
 * broken 只放「行头是关系字段、整行格式不对」这一类（文件级病，跟星轨盘上有哪些卡无关）；
 * 「指向的卡不在星轨盘上」要拿星轨盘上的卡集合来判断，归星轨盘建模时的 broken。 */
export interface ExtractedRelations {
  relations: Relation[];
  broken: Array<{ key: string; target: string }>;
}

/** md link 的目标段还原成卡身份：百分号解码 → 剥 `./` 前缀 → 剥 `#` 锚 → 剥 `.md` / `.mdx` 后缀
 * （卡文件两种后缀都认，见 scan.ts 的 CARD_EXT）。关系行与站上的卡链接改写用的是这同一个。
 * 解码失败（目标里有单独的 `%`）按原样用，不抛错——写错的链接应该在结果里显出来，不该让整次扫描卡目录抛错。 */
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
  return target.replace(/\.mdx?$/, "").trim();
}

/** 扫正文收关系边：一行一条，链接目标去掉编码、锚与 `.md` / `.mdx` 后即卡身份。
 * 行头是关系字段、整行格式却不对的收进 broken——以前出过这种行被静默丢掉的问题（CRLF 行尾的关系行全部丢失）。 */
export function extractRelations(body: string): ExtractedRelations {
  const relations: Relation[] = [];
  const broken: Array<{ key: string; target: string }> = [];
  for (const line of splitLines(body)) {
    const match = EDGE_LINE.exec(line);
    if (!match) {
      const head = EDGE_HEAD.exec(line);
      if (head) {
        broken.push({
          key: head[1] as string,
          target: line.slice((head[0] as string).length).trim(),
        });
      }
      continue;
    }
    const kind: EdgeKind = match[1] === "supersedes" ? "supersede" : "pivot";
    const target = cardIdFromHref(match[2] as string);
    /* 目标段为空（`[文字]()` 之类）：算格式不对，不算一条边 */
    if (target === "") {
      broken.push({ key: match[1] as string, target: line.slice(line.indexOf("::") + 2).trim() });
      continue;
    }
    relations.push({ kind, target });
  }
  return { relations, broken };
}

/** 里程碑区块提取的结果：解析成功的里程碑，与以 `- ` 开头却不合 `- 日期｜标题｜说明` 或日期解不出来的行。 */
export interface ExtractedMilestones {
  milestones: Milestone[];
  broken: string[];
}

/** 解析根卡正文的「## 里程碑」固定区块：区块到下一个 H2 或文件尾为止。区块里别的文字（说明、续行）不管；
 * 结果按日期升序。 */
export function extractMilestones(body: string): ExtractedMilestones {
  const items: Milestone[] = [];
  const broken: string[] = [];
  let inBlock = false;
  for (const line of splitLines(body)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      inBlock = h2[1] === MILESTONE_HEADING;
      continue;
    }
    if (!inBlock) continue;
    if (!/^-\s/.test(line)) continue;
    const match = MILESTONE_LINE.exec(line);
    const date = match ? (match[1] as string).trim() : "";
    if (!match || Number.isNaN(Date.parse(`${date.slice(0, 10)}T00:00:00Z`))) {
      broken.push(line.trim());
      continue;
    }
    items.push({ date, name: (match[2] as string).trim(), desc: (match[3] ?? "").trim() });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { milestones: items, broken };
}
