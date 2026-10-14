/**
 * 钉码标记的写法：标记里那一截（载荷）怎么写、怎么读。各种文档格式只在外面套自己的注释外壳。
 *
 * 载荷 = 动作词 + 目标属性 + 记录属性；没有记录属性就是还没确认，确认时写上。
 *   `ref file="…" lines="a-b" hash="…" blob="…"`、`ref file="…"`（整文件）、`tree dir="…" depth="1" glob="…" hash="…"`
 * 值里的引号写成 &quot;。`toTarget` / `recordOf` 是唯一的语义校验点。
 */
import type { MemoRecord, Target, TreeTarget } from "./types.ts";

type Attrs = Array<[string, string]>;

/** 标记的动作词：ref / tree */
function wordOf(target: Target): string {
  return target.kind === "tree" ? "tree" : "ref";
}

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

/** 标记的载荷：先目标、后记录；还没确认的没有记录属性 */
export function formalOf(target: Target, record: MemoRecord | null): string {
  const attrs = [...targetAttrsOf(target), ...recordAttrsOf(record)].map(([k, v]) => `${k}="${v.replace(/"/g, "&quot;")}"`);
  return [wordOf(target), ...attrs].join(" ");
}

const ATTR = /(\w+)="([^"]*)"/g;

function parseAttrs(s: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const m of s.matchAll(ATTR)) table[m[1]!] = m[2]!.replace(/&quot;/g, '"');
  return table;
}

/** 每个动作词认的属性：目标属性在前，记录属性在后。别的属性一律报错 */
const ATTRS: Record<string, readonly string[]> = {
  ref: ["file", "lines", "hash", "blob"],
  tree: ["dir", "depth", "glob", "hash"],
};

/** 「一个词 + 至少一个 key="value" 属性」：长成标记的样子，词不认识就报错，不当成普通注释 */
const MARKER_SHAPE = /^\w+(?:\s+\w+="[^"]*")+$/s;

/** 记录里的哈希与 blob 名：12 位小写十六进制 */
const HEX12 = /^[0-9a-f]{12}$/;

/** 格式的注释外壳：把载荷包成这个格式里的完整标记 */
export type MarkerShell = (payload: string) => string;

/**
 * 一个文件里写坏的标记一次列全：逐处解析时经 attempt 调用，出错的那处记下、交回 null 接着往下认，
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
 * 载荷 → 目标与记录（还没确认的记录是 null）。格式把外壳剥掉后交给它。
 * 不是标记（普通注释）给 null；长成「一个词 + key="value" 属性」但动作词不认识、属性写成 `key="value"` 之外的样子、
 * 出现这个动作词不认的属性，都报错到 where
 */
export function parseFormal(payload: string, where: string): { target: Target; record: MemoRecord | null } | null {
  const trimmed = payload.trim();
  const m = /^(\w+)\s*(.*)$/s.exec(trimmed);
  if (m === null) return null;
  const word = m[1]!;
  const known = ATTRS[word];
  if (known === undefined) {
    if (!MARKER_SHAPE.test(trimmed)) return null;
    throw new Error(`${where}：标记的动作词只有 ref / tree，不认识 ${word}——普通注释别写成 key="value" 属性`);
  }
  const rest = m[2]!;
  const leftover = rest.replace(ATTR, "").trim();
  if (leftover !== "") throw new Error(`${where}：标记里有认不出的写法（${leftover}）——属性一律写成 key="value"`);
  const attrs = parseAttrs(rest);
  const unknown = Object.keys(attrs).filter((key) => !known.includes(key));
  if (unknown.length > 0) throw new Error(`${where}：${word} 不认属性 ${unknown.join("、")}（认的有 ${known.join(" / ")}）`);
  return { target: toTarget(word, attrs, where), record: recordOf(word, attrs, where) };
}

function assertHex(value: string, name: string, where: string): void {
  if (!HEX12.test(value)) throw new Error(`${where}：${name} 要是 12 位小写十六进制（${value}）`);
}

/** `ref` 没有 hash 与 blob、`tree` 没有 hash 就是还没确认（null）；`ref` 只写了其中一个、值不合法，报错到 where */
function recordOf(word: string, attrs: Record<string, string | undefined>, where: string): MemoRecord | null {
  if (word === "ref") {
    if (attrs.hash === undefined && attrs.blob === undefined) return null;
    if (attrs.hash === undefined || attrs.blob === undefined) {
      throw new Error(`${where}：ref 的记录只写了一半（hash、blob 要一起有）——记录由确认写，删掉剩下那个再确认`);
    }
    assertHex(attrs.hash, "hash", where);
    assertHex(attrs.blob, "blob", where);
    return { kind: "content", hash: attrs.hash, blob: attrs.blob };
  }
  if (attrs.hash === undefined) return null;
  assertHex(attrs.hash, "hash", where);
  return { kind: "tree", hash: attrs.hash };
}

function toTarget(word: string, attrs: Record<string, string | undefined>, where: string): Target {
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

/** 目标的文本形态，给报告用：行段 `file:a-b`、整文件 `file:all`、目录树 `tree dir depth=1[ glob=…]` */
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
