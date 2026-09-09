/**
 * 记号语法：**引用怎么写、怎么读**，一处正本。
 *
 * 三样东西住这儿，共同点是它们都在做「文本 ↔ 目标」的翻译，跟目标本身是什么无关：
 *   **语言表** `WORDS`——动作词只有这五个，`toTarget` 是唯一的语义校验点，各格式报错一致
 *   **正式记号的载荷**（`wordOf` / `attrsOf` / `formalOf` / `parseAttrs` / `parseFormal`）——
 *   所有格式共用的那一截，格式只负责在外面套自己的壳（mdx 是花括号注释，md 是 HTML 注释）
 *   **草稿记号**（`draftOf`）与**记录簿的键**（`targetKey` / `keyToTarget`）
 *
 * 从 `types.ts` 里分出来是因为它俩的变化原因不同：接口正本因「引用能指向什么」而变，
 * 这一份因「记号怎么写」而变。域类型只有 `Target` 一族，从 `./types.ts` 借。
 */
import type { Target, TreeTarget } from "./types.ts";

/** 正式记号的动作词：ref / tree / exists / absent / has。格式用它拼自己的外壳 */
export function wordOf(target: Target): string {
  if (target.kind === "span" || target.kind === "file") return "ref";
  if (target.kind === "exists") return target.absent ? "absent" : "exists";
  return target.kind;
}

/** 正式记号的属性表（有序），格式按 key="value" 摆出来 */
export function attrsOf(target: Target): Array<[string, string]> {
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

/** 正式记号的载荷（所有格式共用的那一截）：`ref file="…" lines="a-b"`、`tree dir="…" depth="1"`…… 值里的引号写成 &quot; */
export function formalOf(target: Target): string {
  const attrs = attrsOf(target).map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`);
  return [wordOf(target), ...attrs].join(" ");
}

/** 载荷 → 属性表。跟 formalOf 是一对 */
export function parseAttrs(s: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const m of s.matchAll(/(\w+)="([^"]*)"/g)) table[m[1]!] = m[2]!.replace(/&quot;/g, '"');
  return table;
}

/** 正式记号的载荷 → 目标：`ref file="…" lines="…"` 这种一整串。格式把外壳剥掉后交给它 */
export function parseFormal(payload: string, where: string): Target | null {
  const m = /^(\w+)\s*(.*)$/s.exec(payload.trim());
  if (m === null) return null;
  return toTarget(m[1]!, parseAttrs(m[2]!), where);
}

const WORDS = new Set(["ref", "tree", "exists", "absent", "has"]);

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
 *   @@livedoc ref src/greet.ts:2-3 @@          行段
 *   @@livedoc ref config.json @@               整文件
 *   @@livedoc tree src @@                      目录树；可带 depth=2、glob=*.test.ts
 *   @@livedoc exists src/store.ts @@           在；absent 是「断言不在」
 *   @@livedoc has src/store.ts "export function save" @@   文件里有这个字面量（带空格就用引号包）
 * 在 md、mdx、html 里都是合法的一行普通文字；check 认它、报未确认；confirm 时格式换成自己的正式形态。
 */
const DRAFT = /^\s*@@livedoc\s+(\w+)\s+(.+?)\s+@@\s*$/;

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
 * 目标的文本形态，给报告和记录簿的键用：
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

/** 记录簿的键 → 目标。跟 targetKey 是一对；行段的文件名里有冒号也认得回来（取最后一个冒号） */
export function keyToTarget(key: string): Target {
  const tree = /^tree (.+?) depth=(\d+)(?: glob=(.+))?$/.exec(key);
  if (tree !== null) {
    const t: TreeTarget = { kind: "tree", dir: tree[1]!, depth: Number(tree[2]) };
    if (tree[3] !== undefined) t.glob = tree[3];
    return t;
  }
  const exists = /^(exists|absent) (.+)$/.exec(key);
  if (exists !== null) return { kind: "exists", path: exists[2]!, absent: exists[1] === "absent" };
  const has = /^has (.+?) ("(?:[^"\\]|\\.)*")$/.exec(key);
  if (has !== null) return { kind: "has", file: has[1]!, text: JSON.parse(has[2]!) as string };
  const all = /^(.*):all$/.exec(key);
  if (all !== null) return { kind: "file", file: all[1]! };
  const span = /^(.*):(\d+)-(\d+)$/.exec(key);
  if (span === null) throw new Error(`记录簿里的键不认得：${key}`);
  return { kind: "span", file: span[1]!, a: Number(span[2]), b: Number(span[3]) };
}
