/**
 * 记号写法：**引用怎么写、怎么读**，一处正本。
 *
 * 这儿做的都是「文本 ↔ 目标 + 记录」的翻译，跟目标本身是什么无关：
 *   **语言表** `WORDS` 与每个动作词认的属性 `ATTRS`——`toTarget` / `recordOf` 是唯一的语义校验点
 *   **记号的载荷**（`formalOf` / `parseFormal`）——格式只在外面套自己的注释外壳。
 *   载荷 = 动作词 + 目标属性 + 记录属性；没有记录属性就是还没确认，confirm 时写上
 *   报告里用的目标文本形态（`targetKey`），以及已经删掉的两种写法的报错：草稿 `@@docfirst … @@` 与名字记号 `has`
 */
import type { MemoRecord, Target, TreeTarget } from "@godcreator/code-pin";

/** 记号的动作词：ref / tree */
export function wordOf(target: Target): string {
  return target.kind === "tree" ? "tree" : "ref";
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
  }
}

function recordAttrsOf(record: MemoRecord | null): Attrs {
  if (record === null) return [];
  switch (record.kind) {
    case "content":
      return [["hash", record.hash], ["blob", record.blob]];
    case "tree":
      return [["hash", record.hash]];
  }
}

/** 记号的属性表（有序）：先目标、后记录；还没确认的没有记录属性。格式按 key="value" 摆出来 */
export function attrsOf(target: Target, record: MemoRecord | null): Attrs {
  return [...targetAttrsOf(target), ...recordAttrsOf(record)];
}

/** 记号的载荷：`ref file="…" lines="a-b" hash="…" blob="…"`、`tree dir="…" depth="1" hash="…"`…… 值里的引号写成 &quot; */
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

const WORDS = new Set(["ref", "tree"]);

/** 每个动作词认的属性：目标属性在前，记录属性在后。别的属性一律报错 */
const ATTRS: Record<string, readonly string[]> = {
  ref: ["file", "lines", "hash", "blob"],
  tree: ["dir", "depth", "glob", "hash"],
};

/** 「一个词 + 至少一个 key="value" 属性」：长成记号的样子，词不认识就报错，不当成普通注释 */
const MARKER_SHAPE = /^\w+(?:\s+\w+="[^"]*")+$/s;

/** 记号上的哈希与 blob 名：12 位小写十六进制 */
const HEX12 = /^[0-9a-f]{12}$/;

/** 未确认的记号写法举例：报错时给人照抄 */
const EXAMPLE_PAYLOAD = formalOf({ kind: "span", file: "src/a.ts", a: 2, b: 3 }, null);

/** 以 `@@docfirst` 开头的一行：草稿写法已经删了，格式碰到就报错，不让它悄悄变成普通文字 */
export const isRemovedDraftLine = (line: string): boolean => /^\s*@@docfirst\b/.test(line);

/** 格式的记号外壳：把载荷包成这个格式里的完整记号，报错给改法时用 */
export type MarkerShell = (payload: string) => string;

/** 草稿写法的报错：把举例的载荷包成这个格式里的完整记号 */
export function removedDraftError(where: string, shell: MarkerShell): Error {
  return new Error(
    `${where}：@@docfirst 草稿写法已经删了——改写成不带记录的正式记号，如 ${shell(EXAMPLE_PAYLOAD)}（动作词 ref / tree），confirm 时写上记录`,
  );
}

/** 名字记号 `has` 的报错：改法是钉 text 所在那几行的行段，file 照抄原记号的 */
function removedHasError(where: string, attrs: Record<string, string>, shell: MarkerShell): Error {
  const file = attrs.file !== undefined && attrs.file !== "" ? attrs.file : "…";
  const said = attrs.text !== undefined && attrs.text !== "" ? `「${attrs.text}」所在的那一行` : "要钉的那一行";
  return new Error(
    `${where}：has 已经删了——改成行段记号 ${shell(`ref file="${file.replace(/"/g, "&quot;")}" lines="n-n"`)}，n-n 写${said}` +
      `（钉测试、要看它断言了什么时，从 test( / it( 那行钉到它结束的那行），confirm 时写上记录`,
  );
}

/**
 * 一个文件里写坏的记号一次列全：格式逐处解析时经 attempt 调用，出错的那处记下、交回 null 接着往下认，
 * 认完调 throwIfAny 把全部报错合成一条抛出——只报第一处的话，改一处跑一次才看得到下一处
 */
export function markerErrors(): { attempt<T>(parse: () => T): T | null; throwIfAny(): void } {
  const messages: string[] = [];
  return {
    attempt(parse) {
      try {
        return parse();
      } catch (err) {
        messages.push((err as Error).message);
        return null;
      }
    },
    throwIfAny() {
      if (messages.length > 0) throw new Error(messages.join("\n"));
    },
  };
}

/**
 * 记号的载荷 → 目标与记录（还没确认的记录是 null）。格式把外壳剥掉后交给它，shell 是它的外壳，报错给改法时用。
 * 不是记号（普通注释）给 null；长成「一个词 + key="value" 属性」但词不认识（包括已经删掉的 has）、以 @@docfirst 开头、
 * 属性写成 `key="value"` 之外的样子、出现这个动作词不认的属性，都报错到 where
 */
export function parseFormal(payload: string, where: string, shell: MarkerShell): { target: Target; record: MemoRecord | null } | null {
  const trimmed = payload.trim();
  if (isRemovedDraftLine(trimmed)) throw removedDraftError(where, shell);
  const m = /^(\w+)\s*(.*)$/s.exec(trimmed);
  if (m === null) return null;
  const word = m[1]!;
  if (!WORDS.has(word)) {
    if (!MARKER_SHAPE.test(trimmed)) return null;
    if (word === "has") throw removedHasError(where, parseAttrs(m[2]!), shell);
    throw new Error(`${where}：记号的动作词只有 ref / tree，不认识 ${word}——普通注释别写成 key="value" 属性`);
  }
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
 * 动作词 + 属性表 → 记录。`ref` 没有 hash 与 blob、`tree` 没有 hash 就是还没确认（null）；
 * `ref` 只写了其中一个、值不合法，报错到 where
 */
export function recordOf(word: string, attrs: Record<string, string | undefined>, where: string): MemoRecord | null {
  if (word === "ref") {
    if (attrs.hash === undefined && attrs.blob === undefined) return null;
    if (attrs.hash === undefined || attrs.blob === undefined) {
      throw new Error(`${where}：ref 的记录只写了一半（hash、blob 要一起有）——记录由 confirm 写，删掉剩下那个再 confirm`);
    }
    assertHex(attrs.hash, "hash", where);
    assertHex(attrs.blob, "blob", where);
    return { kind: "content", hash: attrs.hash, blob: attrs.blob };
  }
  if (attrs.hash === undefined) return null;
  assertHex(attrs.hash, "hash", where);
  return { kind: "tree", hash: attrs.hash };
}

/** 动作词 + 属性表 → 目标。语义校验统一在这儿；动作词不认识给 null */
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
  if (attrs.dir === undefined || attrs.dir === "") throw new Error(`${where}：目录树要有 dir="…"`);
  const depth = attrs.depth === undefined ? 1 : Number(attrs.depth);
  if (!Number.isInteger(depth) || depth < 1) throw new Error(`${where}：depth 要是正整数（${attrs.depth}）`);
  const target: TreeTarget = { kind: "tree", dir: attrs.dir.replace(/\/+$/, ""), depth };
  if (attrs.glob !== undefined && attrs.glob !== "") target.glob = attrs.glob;
  return target;
}

/**
 * 目标的文本形态，给报告用：
 *   行段 `file:a-b`、整文件 `file:all`、目录树 `tree dir depth=1[ glob=…]`
 */
export function targetKey(t: Target): string {
  switch (t.kind) {
    case "span":
      return `${t.file}:${t.a}-${t.b}`;
    case "file":
      return `${t.file}:all`;
    case "tree":
      return `tree ${t.dir} depth=${t.depth}${t.glob !== undefined ? ` glob=${t.glob}` : ""}`;
  }
}
