/**
 * 卡文件的行级解析器——frontmatter、正文关系边、根卡里程碑区块，全在这一份里。
 *
 * frontmatter 一律按行扫、按字符串取值，不引 YAML 库：`born-at: 2026-05-06`（日级存量写法）
 * 是合法的 YAML date，任何 YAML 库默认 schema 都会把它解析成 `Date` 对象，`String()` 之后
 * 得到「Tue May 06 2026 08:00:00 GMT+0800」——born-at 的格式校验当场全灭，日级存量卡全部
 * 被判字段病并挡在盘外，而且是静默的（盘照出，只是少了卡少了环）。
 *
 * 值读进来谁用谁取，card.ts 只按 CARD_KEYS 与自己要的几个键读。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/parse.ts`（只读参考，本仓不 import 它）。
 */

import type { EdgeKind, Milestone, Relation } from "@godcreator/docfirst-trajectory";

/** 卡体系字段：frontmatter 里一个都不沾的文件不是卡，校验直接跳过。
 * status 不在其列——它是自由槽位，单凭一个 status 不足以认定这是张卡。 */
export const CARD_KEYS = ["type", "born-at", "parent", "label", "domain"] as const;

/** 根卡正文末尾装里程碑的固定 H2 区块名。 */
export const MILESTONE_HEADING = "里程碑";

/** 正文 inline 边：一行一条，值是一条链接，链接目标即卡身份。两种形态都认——
 * 标准 md link `[文字](主干.md)`（现行写法，目标可选 `<>` 包裹、可带百分号编码与 `./` 前缀）
 * 与 wikilink `[[主干]]`（可带 # 锚 / | 别名）。卡是人手写的，两种形态都要容错。 */
const EDGE_LINE =
  /^(supersedes|pivots-from)::[ \t]*(?:\[\[([^\]]+)\]\]|\[[^\]\n]*\]\((?:<([^>\n]*)>|([^()\s]*))\))[ \t]*$/;

/** 行头是关系字段的兜底判定：匹配上但整行不合 EDGE_LINE 的，示众、不静默吞行。 */
const EDGE_HEAD = /^(supersedes|pivots-from)::/;

/** frontmatter 里的一条标量 / 列表起始行。 */
const KV_LINE = /^([\w-]+):[ \t]*(.*)$/;

/** frontmatter 里的一个块式列表项（缩进 + 短横）。 */
const LIST_ITEM = /^[ \t]+-[ \t]+(.*)$/;

/** 里程碑行：`- 日期｜标题｜描述`，竖线是全角 U+FF5C，描述段可缺。 */
const MILESTONE_LINE = /^-\s+([^｜]+)｜([^｜]+)(?:｜([\s\S]*))?\s*$/;

/** frontmatter 一律解析成字符串或字符串列表——不做类型推断是本模块的立身之本。 */
export type Frontmatter = Record<string, string | string[]>;

/** 切行归一：CRLF / LF 混行尾在这里统一吃掉，下游正则永远不必防 \r。 */
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

/** 流式列表 `[a, b]`：card-format 正本里 parent 就是这个写法，必须容错。
 * 空串项丢掉——`[]` 解析成空列表而不是一个空串项。 */
function parseFlowList(raw: string): string[] {
  return raw
    .slice(1, -1)
    .split(",")
    .map(unquote)
    .filter((v) => v !== "");
}

/** 行级 frontmatter 解析：BOM / CRLF / 引号 / 块式列表 / 流式列表五种形态都吃，
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

/** 取标量：列表形态取首项（单值容错的反向），缺省回 null。 */
export function scalarOf(fm: Frontmatter, key: string): string | null {
  const raw = fm[key];
  if (raw === undefined) return null;
  if (Array.isArray(raw)) return raw.length ? (raw[0] as string) : null;
  return raw;
}

/** 取列表：单值也容错成一项。 */
export function listOf(fm: Frontmatter, key: string): string[] {
  const raw = fm[key];
  if (raw === undefined) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((v) => v.trim()).filter((v) => v !== "");
}

/** 正文关系边提取的产物：成形的边与写歪的行分开装。
 * broken 只装「行头对但行形不合」这一类（文件级病，跟盘上有哪些卡无关）；
 * 「指向的卡不在盘上」要对盘上的卡集合求解，归星轨盘建模时的 broken。 */
export interface ExtractedRelations {
  relations: Relation[];
  broken: Array<{ key: string; target: string }>;
}

/** md link 的目标段还原成卡身份：百分号解码 → 剥 `./` 前缀 → 剥 `#` 锚 → 剥 `.md` / `.mdx` 后缀
 * （卡文件两种后缀都认，见 scan.ts 的 CARD_EXT）。关系行与站上的卡链接改写用的是这同一个。
 * 解码失败（目标里有孤零零的 `%`）按原样走，不抛——坏写法该现原形、不该炸整次扫盘。 */
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

/** 扫正文收关系边：一行一条，md link 目标剥编码与 `.md` / `.mdx` 后即卡身份，
 * wikilink 目标剥 # 锚与 | 别名后即卡身份。
 * 行头是关系字段却没匹配上行形的收进 broken 示众——静默吞行有过前科（CRLF 行尾全军覆没）。 */
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
    const wiki = match[2];
    const target =
      wiki !== undefined
        ? (wiki.split(/[|#]/)[0]?.trim() ?? "")
        : cardIdFromHref((match[3] ?? match[4]) as string);
    /* 目标段空掉（`[文字]()` 之类）：算写歪，示众不成边 */
    if (target === "") {
      broken.push({ key: match[1] as string, target: line.slice(line.indexOf("::") + 2).trim() });
      continue;
    }
    relations.push({ kind, target });
  }
  return { relations, broken };
}

/** 解析根卡正文的「## 里程碑」固定区块：区块到下一个 H2 或文件尾为止。
 * 日期解不出天序数的行跳过；结果按日期升序。 */
export function extractMilestones(body: string): Milestone[] {
  const items: Milestone[] = [];
  let inBlock = false;
  for (const line of splitLines(body)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      inBlock = h2[1] === MILESTONE_HEADING;
      continue;
    }
    if (!inBlock) continue;
    const match = MILESTONE_LINE.exec(line);
    if (!match) continue;
    const date = (match[1] as string).trim();
    if (Number.isNaN(Date.parse(`${date.slice(0, 10)}T00:00:00Z`))) continue;
    items.push({ date, name: (match[2] as string).trim(), desc: (match[3] ?? "").trim() });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}
