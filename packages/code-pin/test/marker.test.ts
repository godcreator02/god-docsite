/**
 * 钉码标记：载荷的写法（marker.ts）与 mdx 外壳（mdx.ts）。
 *   往返：parse(mdxMarker(t, r)) 认回 t 与 r，三种目标都过；不带记录的就是未确认（null）
 *   记录属性：只写了一半、值不合法、不认识的属性，都报错并带行号
 *   写错了报错：长成标记却认不出动作词的注释；一篇里写坏好几处一次列全
 *   mdx 自己的：围栏里的不认、未确认的写上记录、写回保留 CRLF
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mdxFormat, mdxMarker, parseFormal } from "../src/core/index.ts";
import type { MemoRecord, Target } from "../src/core/index.ts";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const ALL: Target[] = [
  T,
  { kind: "file", file: "config.json" },
  { kind: "tree", dir: "src", depth: 1 },
  { kind: "tree", dir: "src", depth: 2, glob: "*.ts" },
];
const UNCONFIRMED = mdxMarker(T, null);
const HASH = "3fa9c2e1b07d";
const BLOB = "2689fa073ac6";
const parse = mdxFormat.parse;

/** 每种目标确认过之后标记上带的记录 */
function recordFor(target: Target): MemoRecord {
  return target.kind === "tree" ? { kind: "tree", hash: HASH } : { kind: "content", hash: HASH, blob: BLOB };
}

/** 把一篇里认出的钉全按确认过的样子写回 */
const confirmed = (text: string) => parse(text).map((p) => ({ line: p.line, target: p.target, record: recordFor(p.target) }));

test("标记：parse(mdxMarker(t, r)) 认回 t 与 r，三种目标都过，行号也对", () => {
  for (const target of ALL) {
    const record = recordFor(target);
    const pins = parse(`${mdxMarker(target, record)}\n`);
    assert.deepEqual(pins.map((p) => [p.target, p.record]), [[target, record]], `标记自己认不回来：${mdxMarker(target, record)}`);
    assert.equal(pins[0]!.line, 1);
  }
});

test("不带记录的标记就是未确认：ref 没有 hash、blob，tree 没有 hash，记录是 null", () => {
  assert.equal(UNCONFIRMED, '{/* ref file="src/greet.ts" lines="2-3" */}');
  for (const target of ALL) {
    const pins = parse(`# 标题\n\n${mdxMarker(target, null)}\n\n尾巴\n`);
    assert.deepEqual(pins.map((p) => [p.target, p.record, p.line]), [[target, null, 3]], `不认未确认的标记：${mdxMarker(target, null)}`);
  }
});

test("记录只写了一半：ref 有 hash 没 blob、有 blob 没 hash，都报错到行", () => {
  const half = /第 1 行：ref 的记录只写了一半/;
  assert.throws(() => parse(`{/* ref file="a.ts" lines="1-2" hash="${HASH}" */}\n`), half);
  assert.throws(() => parse(`{/* ref file="a.ts" blob="${BLOB}" */}\n`), half);
});

test("标记里的引号：路径带引号也认得回来", () => {
  const quoted: Target = { kind: "file", file: 'say("hi").ts' };
  assert.deepEqual(parse(`${mdxMarker(quoted, null)}\n`)[0]!.target, quoted);
});

test("长成标记却认不出动作词：一个词 + key=\"value\" 属性就报错，不当普通注释；真普通注释照旧不认", () => {
  assert.throws(() => parse('{/* probe dir="src" */}\n'), /第 1 行：标记的动作词只有 ref \/ tree，不认识 probe/);
  assert.throws(() => parse('{/* rfe file="a.ts" lines="1-2" */}\n'), /不认识 rfe/);
  assert.deepEqual(parse("{/* 普通注释 */}\n"), []);
  assert.deepEqual(parse("{/* TODO 以后再说 */}\n"), []);
  assert.equal(parseFormal("probe", "第 1 行"), null, "只有一个词、没有属性的是普通注释");
});

test("记录属性值不合法、不认识的属性：报错到行", () => {
  assert.throws(() => parse(`{/* ref file="a.ts" lines="1-2" hash="xyz" blob="${BLOB}" */}\n`), /第 1 行：hash 要是 12 位小写十六进制/);
  assert.throws(() => parse(`{/* ref file="a.ts" hash="${"a".repeat(40)}" blob="${BLOB}" */}\n`), /hash 要是 12 位/);
  assert.throws(() => parse(`{/* tree dir="src" blob="${BLOB}" */}\n`), /第 1 行：tree 不认属性 blob/);
  assert.throws(() => parse('{/* ref file="a.ts" lines=1-2 */}\n'), /认不出的写法/);
});

test("一篇里写坏了好几处：一次列全，不只报第一处", () => {
  const text = `# 标题\n\n{/* ref file="a.ts" lines="3-2" */}\n\n{/* probe dir="src" */}\n`;
  assert.throws(
    () => parse(text),
    (err: Error) => ["第 3 行：行号不合理", "第 5 行：标记的动作词只有"].every((piece) => err.message.includes(piece)),
  );
});

test("围栏里、行内的标记不认：围栏内容是 code 节点，行内是 mdxTextExpression", () => {
  assert.deepEqual(parse("```mdx\n" + UNCONFIRMED + "\n```\n"), []);
  assert.deepEqual(parse(`\`\`\`mdx\n{/* ref file="a.ts" lines="1-2" hash="${HASH}" blob="${BLOB}" */}\n\`\`\`\n`), []);
  assert.deepEqual(parse(`行内的 ${UNCONFIRMED} 不算\n`), []);
});

test("公式里的花括号不是 mdx 表达式：带公式的页照样认标记", () => {
  const text = `状态 $x = [\\,i,\\ v_c\\,]^{\\mathsf T}$。\n\n$$\nS \\in \\{-1,\\ 0\\}\n$$\n\n${UNCONFIRMED}\n`;
  assert.deepEqual(parse(text).map((p) => p.line), [7]);
});

test("mdx：未确认的标记写上记录，再写一次一个字不变", () => {
  const draft = `---\ntitle: x\n---\n\n# mdx\n\n${UNCONFIRMED}\n\n尾巴\n`;
  const once = mdxFormat.write(draft, confirmed(draft));
  assert.match(once, new RegExp(`\\{/\\* ref file="src/greet\\.ts" lines="2-3" hash="${HASH}" blob="${BLOB}" \\*/\\}`));
  assert.equal(mdxFormat.write(once, confirmed(once)), once, "再写一次文档不该再变");
});

test("mdx：写回保留行尾的 CRLF", () => {
  const draft = `# mdx\r\n\r\n${UNCONFIRMED}\r\n\r\n尾巴\r\n`;
  assert.match(mdxFormat.write(draft, confirmed(draft)), /\*\/\}\r\n/);
});

test("mdx：目录树、整文件两种标记写上记录后也认得回来", () => {
  const draft = `# mdx\n\n${mdxMarker({ kind: "tree", dir: "src", depth: 1 }, null)}\n\n${mdxMarker({ kind: "file", file: "src/store.ts" }, null)}\n`;
  const written = confirmed(draft);
  const once = mdxFormat.write(draft, written);
  assert.match(once, new RegExp(`\\{/\\* tree dir="src" depth="1" hash="${HASH}" \\*/\\}`));
  assert.match(once, new RegExp(`\\{/\\* ref file="src/store\\.ts" hash="${HASH}" blob="${BLOB}" \\*/\\}`));
  assert.deepEqual(parse(once).map((p) => [p.target, p.record]), written.map((w) => [w.target, w.record]));
});

test("标记写坏了报到行：少 file、行号不合理、depth 不是正整数；只有 file 没有 lines 是整文件", () => {
  assert.throws(() => parse('{/* ref lines="2-3" */}\n'), /第 1 行：引用要有 file/);
  assert.throws(() => parse('{/* ref file="a.ts" lines="3-2" */}\n'), /第 1 行：行号不合理/);
  assert.throws(() => parse('{/* tree dir="src" depth="0" */}\n'), /第 1 行：depth 要是正整数/);
  assert.deepEqual(parse(`{/* ref file="a.ts" hash="${HASH}" blob="${BLOB}" */}\n`)[0]!.target, { kind: "file", file: "a.ts" });
});
