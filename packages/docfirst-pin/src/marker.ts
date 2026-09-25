/**
 * 记号语法：**引用怎么写、怎么读**，一处正本。
 *
 * 这儿做的都是「文本 ↔ 目标 + 记录」的翻译，跟目标本身是什么无关：
 *   **语言表** `WORDS` 与每个动作词认的属性 `ATTRS`——`toTarget` / `recordOf` 是唯一的语义校验点，各格式报错一致
 *   **正式记号的载荷**（`formalOf` / `parseFormal`）——所有格式共用的那一截，格式只负责在外面套自己的壳
 *   （mdx 是花括号注释）。载荷 = 动作词 + 目标属性 + 记录属性，记录属性只在确认过的记号上出现
 *   **草稿记号**（`draftOf`）与报告里用的目标文本形态（`targetKey`）
 */
import type { MemoRecord, Target, TreeTarget } from "./types.ts";

/** 正式记号的动作词：ref / tree / exists / absent / has。格式用它拼自己的外壳 */
export function wordOf(target: Target): string {
  if (target.kind === "span" || target.kind === "file") return "ref";
  if (target.kind === "exists") return target.absent ? "absent" : "exists";
  return target.kind;
}

type Attrs = Array<[string, string]>;

function targetAttrsOf(target: Target): Attrs {
  switch (target.kind) {
    case "span":
      return [["file", target.file], ["lines", `${target.a}-${target.b}`]];
    case "file":
      return [["file", target.file]];
    case "tree":
      return [["dir", target.dir], ["depth", String(target.depth)], ...(target.glob !== undefined ? [["glob", target.glob] as [string, string]] : [])];
    case "exists":
      return [["path", target.path]];
    case "has":
      return [["file", target.file], ["text", target.text]];
  }
}

function recordAttrsOf(record: MemoRecord | null): Attrs {
  if (record === null) return [];
  switch (record.kind) {
    case "content":
      return [["hash", record.hash], ...(record.blob !== undefined ? [["blob", record.blob] as [string, string]] : [])];
    case "tree":
      return [["hash", record.hash]];
    case "exists":
      return [["type", record.type]];
    case "has":
      return [];
  }
}

/** 正式记号的属性表（有序）：先目标、后记录，格式按 key="value" 摆出来 */
export function attrsOf(target: Target, record: MemoRecord | null): Attrs {
  return [...targetAttrsOf(target), ...recordAttrsOf(record)];
}

/** 正式记号的载荷：`ref file="…" lines="a-b" hash="…" blob="…"`、`tree dir="…" depth="1" hash="…"`…… 值里的引号写成 &quot; */
export function formalOf(target: Target, record: MemoRecord | null): string {
  const attrs = attrsOf(target, record).map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`);
  return [wordOf(target), ...attrs].join(" ");
}

const ATTR = /(\w+)="([^"]*)"/g;

/** 载荷 → 属性表。跟 formalOf 是一对 */
export function parseAttrs(s: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const m of s.matchAll(ATTR)) table[m[1]!] = m[2]!.replace(/&quot;/g, '"');
  return table;
}

const WORDS = new Set(["ref", "tree", "exists", "absent", "has"]);

/** 每个动作词认的属性：目标属性在前，记录属性在后。别的属性一律报错 */
const ATTRS: Record<string, readonly string[]> = {
  ref: ["file", "lines", "hash", "blob"],
  tree: ["dir", "depth", "glob", "hash"],
  exists: ["path", "type"],
  absent: ["path", "type"],
  has: ["file", "text"],
};

/** 记号上的哈希与 blob 名：12 位小写十六进制 */
const HEX12 = /^[0-9a-f]{12}$/;

/**
 * 正式记号的载荷 → 目标与记录。格式把外壳剥掉后交给它；动作词不认识给 null。
 * 属性写成 `key="value"` 之外的样子、出现这个动作词不认的属性，都报错到 where
 */
export function parseFormal(payload: string, where: string): { target: Target; record: MemoRecord | null } | null {
  const m = /^(\w+)\s*(.*)$/s.exec(payload.trim());
  if (m === null || !WORDS.has(m[1]!)) return null;
  const word = m[1]!;
  const rest = m[2]!;
  const leftover = rest.replace(ATTR, "").trim();
  if (leftover !== "") throw new Error(`${where}：记号里有认不出的写法（${leftover}）——属性一律写成 key="value"`);
  const attrs = parseAttrs(rest);
  const unknown = Object.keys(attrs).filter((key) => !ATTRS[word]!.includes(key));
  if (unknown.length > 0) throw new Error(`${where}：${word} 不认属性 ${unknown.join("、")}（认的有 ${ATTRS[word]!.join(" / ")}）`);
  const target = toTarget(word, attrs, where)!;
  return { target, record: recordOf(word, attrs, where) };
}

function assertHex(value: string, name: string, where: string): void {
  if (!HEX12.test(value)) throw new Error(`${where}：${name} 要是 12 位小写十六进制（${value}）`);
}

/**
 * 动作词 + 属性表 → 记录。没写任何记录属性给 null（未确认）；`has` 的正式记号本身就是确认过。
 * 记录属性写了一半（行段有 blob 没有 hash）、值不合法，报错到 where
 */
export function recordOf(word: string, attrs: Record<string, string | undefined>, where: string): MemoRecord | null {
  if (word === "has") return { kind: "has" };
  if (word === "ref") {
    if (attrs.hash === undefined) {
      if (attrs.blob !== undefined) throw new Error(`${where}：记录属性写了一半——有 blob 没有 hash`);
      return null;
    }
    assertHex(attrs.hash, "hash", where);
    if (attrs.blob === undefined) return { kind: "content", hash: attrs.hash };
    assertHex(attrs.blob, "blob", where);
    return { kind: "content", hash: attrs.hash, blob: attrs.blob };
  }
  if (word === "tree") {
    if (attrs.hash === undefined) return null;
    assertHex(attrs.hash, "hash", where);
    return { kind: "tree", hash: attrs.hash };
  }
  if (attrs.type === undefined) return null;
  const allowed = word === "absent" ? ["absent"] : ["file", "dir"];
  if (!allowed.includes(attrs.type)) throw new Error(`${where}：${word} 的 type 只能是 ${allowed.join(" / ")}（${attrs.type}）`);
  return { kind: "exists", type: attrs.type as "file" | "dir" | "absent" };
}

/** 动作词 + 属性表 → 目标。语义校验统一住这儿，各格式报错一致；动作词不认识给 null */
export function toTarget(word: string, attrs: Record<string, string | undefined>, where: string): Target | null {
  if (!WORDS.has(word)) return null;
  if (word === "ref") {
    if (attrs.file === undefined || attrs.file === "") throw new Error(`${where}：引用要有 file="…"`);
    if (attrs.lines === undefined) return { kind: "file", file: attrs.file };
    if (!/^\d+-\d+$/.test(attrs.lines)) throw new Error(`${where}：lines 要写成 "起-止"（${attrs.lines}）`);
    const [a, b] = attrs.lines.split("-").map(Number) as [number, number];
    if (a < 1 || b < a) throw new Error(`${where}：行号不合理（${attrs.lines}）`);
    return { kind: "span", file: attrs.file, a, b };
  }
  if (word === "tree") {
    if (attrs.dir === undefined || attrs.dir === "") throw new Error(`${where}：目录树要有 dir="…"`);
    const depth = attrs.depth === undefined ? 1 : Number(attrs.depth);
    if (!Number.isInteger(depth) || depth < 1) throw new Error(`${where}：depth 要是正整数（${attrs.depth}）`);
    const target: TreeTarget = { kind: "tree", dir: attrs.dir.replace(/\/+$/, ""), depth };
    if (attrs.glob !== undefined && attrs.glob !== "") target.glob = attrs.glob;
    return target;
  }
  if (word === "exists" || word === "absent") {
    if (attrs.path === undefined || attrs.path === "") throw new Error(`${where}：${word} 要有 path="…"`);
    return { kind: "exists", path: attrs.path, absent: word === "absent" };
  }
  if (attrs.file === undefined || attrs.file === "") throw new Error(`${where}：has 要有 file="…"`);
  if (attrs.text === undefined || attrs.text === "") throw new Error(`${where}：has 要有 text="…"`);
  return { kind: "has", file: attrs.file, text: attrs.text };
}

/**
 * 草稿记号——所有格式通用的写法，独立一行，头尾 @@ 是哨兵，少一头就是普通文字，不报错：
 *   @@docfirst ref src/greet.ts:2-3 @@          行段
 *   @@docfirst ref config.json @@               整文件
 *   @@docfirst tree src @@                      目录树；可带 depth=2、glob=*.test.ts
 *   @@docfirst exists src/store.ts @@           在；absent 是「断言不在」
 *   @@docfirst has src/store.ts "export function save" @@   文件里有这个字面量（带空格就用引号包）
 * 在 md、mdx、html 里都是合法的一行普通文字；check 认它、报未确认；confirm 时格式换成自己的正式记号。
 */
const DRAFT = /^\s*@@docfirst\s+(\w+)\s+(.+?)\s+@@\s*$/;

/** 这一行是不是草稿记号；是就交目标（经 toTarget 校验），不是给 null */
export function draftOf(line: string, where: string): Target | null {
  const m = DRAFT.exec(line);
  if (m === null) return null;
  const word = m[1]!;
  const payload = m[2]!;
  if (word === "ref") {
    const span = /^(.+):(\d+)-(\d+)$/.exec(payload);
    return span === null ? toTarget("ref", { file: payload }, where) : toTarget("ref", { file: span[1]!, lines: `${span[2]}-${span[3]}` }, where);
  }
  if (word === "tree") {
    const [dir, ...opts] = payload.split(/\s+/);
    const attrs: Record<string, string> = { dir: dir! };
    for (const opt of opts) {
      const kv = /^(depth|glob)=(.+)$/.exec(opt);
      if (kv === null) throw new Error(`${where}：tree 的选项只有 depth= 和 glob=（${opt}）`);
      attrs[kv[1]!] = kv[2]!;
    }
    return toTarget("tree", attrs, where);
  }
  if (word === "exists" || word === "absent") return toTarget(word, { path: payload }, where);
  if (word === "has") {
    const m2 = /^(\S+)\s+(.+)$/.exec(payload);
    if (m2 === null) throw new Error(`${where}：has 要写成 has 文件 名字`);
    const raw = m2[2]!;
    const text = /^"(.*)"$/.exec(raw)?.[1] ?? raw;
    return toTarget("has", { file: m2[1]!, text }, where);
  }
  return null;
}

/**
 * 目标的文本形态，给报告用：
 *   行段 `file:a-b`、整文件 `file:all`、目录树 `tree dir depth=1[ glob=…]`、存在性 `exists path` / `absent path`、
 *   名字 `has file "text"`（text 按 JSON 转义）
 */
export function targetKey(t: Target): string {
  switch (t.kind) {
    case "span":
      return `${t.file}:${t.a}-${t.b}`;
    case "file":
      return `${t.file}:all`;
    case "tree":
      return `tree ${t.dir} depth=${t.depth}${t.glob !== undefined ? ` glob=${t.glob}` : ""}`;
    case "exists":
      return `${t.absent ? "absent" : "exists"} ${t.path}`;
    case "has":
      return `has ${t.file} ${JSON.stringify(t.text)}`;
  }
}
