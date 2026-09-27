/**
 * 记号的账。写法本身在 `docfirst-workflow/src/marker/`（载荷、记录属性、已删掉的草稿写法的报错），
 * 外壳是 mdx 的花括号注释——所以两边分开测：
 *   **往返**：`parse(marker(t, r))` 认回 t 与 r，三种目标都过；不带记录的就是未确认（null）
 *   **记录属性**：只写了一半、值不合法、不认识的属性，都报错到行
 *   **写错了报错**：以 @@docfirst 开头的一行、已经删了的 has 记号、长成记号却认不出动作词的注释
 *   **mdx 自己的**：围栏里的不认、未确认的写上记录、写坏了报到行
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mdx from "../packages/docfirst-workflow/src/mdx/index.ts";
import type { MemoRecord, Target } from "../packages/docfirst-pin/src/index.ts";
import type { WrittenReference } from "../packages/docfirst-workflow/src/reference/index.ts";
import { isRemovedDraftLine, parseFormal } from "../packages/docfirst-workflow/src/marker/index.ts";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const ALL: Target[] = [
  T,
  { kind: "file", file: "config.json" },
  { kind: "tree", dir: "src", depth: 1 },
  { kind: "tree", dir: "src", depth: 2, glob: "*.ts" },
];
const UNCONFIRMED = mdx.marker(T, null);
const HASH = "3fa9c2e1b07d";
const BLOB = "2689fa073ac6";

/** 每种目标确认过之后记号上带的记录 */
function recordFor(target: Target): MemoRecord {
  return target.kind === "tree" ? { kind: "tree", hash: HASH } : { kind: "content", hash: HASH, blob: BLOB };
}

const braceShell = (payload: string): string => `{/* ${payload} */}`;

/** 把一篇里认出的引用全按确认过的样子写回 */
const confirmed = (text: string): WrittenReference[] => mdx.parse(text).map((r) => ({ target: r.target, record: recordFor(r.target), at: r.at }));

test("记号：parse(marker(t, r)) 认回 t 与 r，三种目标都过，位置也对", () => {
  for (const target of ALL) {
    const record = recordFor(target);
    const refs = mdx.parse(`${mdx.marker(target, record)}\n`);
    assert.deepEqual(refs.map((r) => [r.target, r.record]), [[target, record]], `记号自己认不回来：${mdx.marker(target, record)}`);
    assert.equal(refs[0]!.at, 0);
  }
});

test("不带记录的正式记号就是未确认：ref 没有 hash、blob，tree 没有 hash，记录是 null", () => {
  assert.equal(UNCONFIRMED, '{/* ref file="src/greet.ts" lines="2-3" */}');
  for (const target of ALL) {
    const refs = mdx.parse(`# 标题\n\n${mdx.marker(target, null)}\n\n尾巴\n`);
    assert.deepEqual(refs.map((r) => [r.target, r.record, r.at]), [[target, null, 2]], `不认未确认的记号：${mdx.marker(target, null)}`);
  }
});

test("记录只写了一半：ref 有 hash 没 blob、有 blob 没 hash，都报错到行", () => {
  const half = /第 1 行：ref 的记录只写了一半/;
  assert.throws(() => mdx.parse(`{/* ref file="a.ts" lines="1-2" hash="${HASH}" */}\n`), half);
  assert.throws(() => mdx.parse(`{/* ref file="a.ts" blob="${BLOB}" */}\n`), half);
});

test("记号里的引号：路径带引号也认得回来", () => {
  const quoted: Target = { kind: "file", file: 'say("hi").ts' };
  assert.deepEqual(mdx.parse(`${mdx.marker(quoted, null)}\n`)[0]!.target, quoted);
});

test("has 记号已经删了：报错到行，给出 mdx 里的行段写法，file 照抄原记号的；长得不像记号的照旧是普通注释", () => {
  assert.throws(
    () => mdx.parse('# 标题\n\n{/* has file="src/store.ts" text="export function save" */}\n'),
    /第 3 行：has 已经删了——改成行段记号 \{\/\* ref file="src\/store\.ts" lines="n-n" \*\/\}，n-n 写「export function save」所在的那一行（钉测试、要看它断言了什么时，从 test\( \/ it\( 那行钉到它结束的那行），confirm 时写上记录/,
  );
  assert.throws(() => mdx.parse('{/* has text="save" */}\n'), /改成行段记号 \{\/\* ref file="…" lines="n-n" \*\/\}/, "没写 file 就给省略号");
  assert.throws(() => parseFormal('has file="a.ts" text="x"', "第 1 行", braceShell), /has 已经删了/);
  assert.deepEqual(mdx.parse("{/* has 待办 */}\n"), [], "没有 key=\"value\" 属性的是普通注释");
});

test("以 @@docfirst 开头的一行：草稿写法已经删了，报错到行并给出正式记号的写法", () => {
  const removed = /第 3 行：@@docfirst 草稿写法已经删了——改写成不带记录的正式记号，如 \{\/\* ref file="src\/a\.ts" lines="2-3" \*\/\}/;
  assert.throws(() => mdx.parse("# 标题\n\n@@docfirst ref src/greet.ts:2-3 @@\n"), removed);
  assert.throws(() => mdx.parse("# 标题\n\n@@docfirst ref src/greet.ts:2-3\n"), removed, "少了尾巴也报");
  assert.throws(() => mdx.parse("# 标题\n\n@@docfirst ref ../py/gwb_hello_py/__main__.py:1-5 @@\n"), removed, "路径被解析成强调也报");
  assert.throws(() => mdx.parse("# 标题\n一句话\n@@docfirst ref src/greet.ts:2-3 @@\n"), removed, "跟上一行并成一段也报");
  assert.throws(() => mdx.parse('{/* @@docfirst ref src/greet.ts:2-3 @@ */}\n'), /第 1 行：@@docfirst 草稿写法已经删了/, "包在注释里也报");
  assert.deepEqual(mdx.parse("这句话里有 @@docfirst ref src/greet.ts:2-3 @@ 不算\n"), [], "句子中间的不算一行的开头");
  assert.deepEqual(mdx.parse("```md\n@@docfirst ref src/greet.ts:2-3 @@\n```\n"), [], "围栏里是讲写法，不报");
  assert.equal(isRemovedDraftLine("  @@docfirst tree src @@"), true);
  assert.equal(isRemovedDraftLine("docfirst ref src/greet.ts:2-3 @@"), false);
});

test("长成记号却认不出动作词：一个词 + key=\"value\" 属性就报错，不当普通注释；真普通注释照旧不认", () => {
  assert.throws(() => mdx.parse('{/* probe dir="src" */}\n'), /第 1 行：记号的动作词只有 ref \/ tree，不认识 probe/);
  assert.throws(() => mdx.parse('{/* rfe file="a.ts" lines="1-2" */}\n'), /不认识 rfe/);
  assert.deepEqual(mdx.parse("{/* 普通注释 */}\n"), []);
  assert.deepEqual(mdx.parse("{/* TODO 以后再说 */}\n"), []);
  assert.equal(parseFormal("probe", "第 1 行", braceShell), null, "只有一个词、没有属性的是普通注释");
});

test("记录属性值不合法、不认识的属性：报错到行", () => {
  assert.throws(() => mdx.parse(`{/* ref file="a.ts" lines="1-2" hash="xyz" blob="${BLOB}" */}\n`), /第 1 行：hash 要是 12 位小写十六进制/);
  assert.throws(() => mdx.parse(`{/* ref file="a.ts" hash="${"a".repeat(40)}" blob="${BLOB}" */}\n`), /hash 要是 12 位/);
  assert.throws(() => mdx.parse(`{/* tree dir="src" blob="${BLOB}" */}\n`), /第 1 行：tree 不认属性 blob/);
  assert.throws(() => mdx.parse('{/* ref file="a.ts" lines=1-2 */}\n'), /认不出的写法/);
});

test("一篇里写坏了好几处：一次列全，不只报第一处", () => {
  const text = `# 标题\n\n@@docfirst ref src/a.ts:1-2 @@\n\n{/* ref file="a.ts" lines="3-2" */}\n\n{/* probe dir="src" */}\n`;
  assert.throws(
    () => mdx.parse(text),
    (err: Error) => ["第 3 行：@@docfirst 草稿写法已经删了", "第 5 行：行号不合理", "第 7 行：记号的动作词只有"].every((piece) => err.message.includes(piece)),
  );
});

test("mdx：围栏里的记号不认——围栏内容是 code 节点，讲记号怎么写的段落不该变成一处引用", () => {
  assert.deepEqual(mdx.parse("```mdx\n" + UNCONFIRMED + "\n```\n"), []);
  assert.deepEqual(mdx.parse(`\`\`\`mdx\n{/* ref file="a.ts" lines="1-2" hash="${HASH}" blob="${BLOB}" */}\n\`\`\`\n`), []);
});

test("mdx：未确认的记号写上记录，再写一次一个字不变", () => {
  const draft = `---\ntitle: x\n---\n\n# mdx\n\n${UNCONFIRMED}\n\n尾巴\n`;
  const once = mdx.write(draft, confirmed(draft));
  assert.match(once, new RegExp(`\\{/\\* ref file="src/greet\\.ts" lines="2-3" hash="${HASH}" blob="${BLOB}" \\*/\\}`));
  assert.equal(mdx.write(once, confirmed(once)), once, "再写一次文档不该再变");
});

test("mdx：写回保留行尾的 CRLF", () => {
  const draft = `# mdx\r\n\r\n${UNCONFIRMED}\r\n\r\n尾巴\r\n`;
  const once = mdx.write(draft, confirmed(draft));
  assert.match(once, /\*\/\}\r\n/);
});

test("mdx：目录树、整文件两种记号写上记录后也认得回来", () => {
  const draft = `# mdx\n\n${mdx.marker({ kind: "tree", dir: "src", depth: 1 }, null)}\n\n${mdx.marker({ kind: "file", file: "src/store.ts" }, null)}\n`;
  const refs = confirmed(draft);
  const once = mdx.write(draft, refs);
  assert.match(once, new RegExp(`\\{/\\* tree dir="src" depth="1" hash="${HASH}" \\*/\\}`));
  assert.match(once, new RegExp(`\\{/\\* ref file="src/store\\.ts" hash="${HASH}" blob="${BLOB}" \\*/\\}`));
  assert.deepEqual(mdx.parse(once).map((r) => [r.target, r.record]), refs.map((r) => [r.target, r.record]));
});

test("记号写坏了报到行：少 file、行号不合理、depth 不是正整数；只有 file 没有 lines 是整文件", () => {
  assert.throws(() => mdx.parse('{/* ref lines="2-3" */}\n'), /第 1 行：引用要有 file/);
  assert.throws(() => mdx.parse('{/* ref file="a.ts" lines="3-2" */}\n'), /第 1 行：行号不合理/);
  assert.throws(() => mdx.parse('{/* tree dir="src" depth="0" */}\n'), /第 1 行：depth 要是正整数/);
  assert.deepEqual(mdx.parse(`{/* ref file="a.ts" hash="${HASH}" blob="${BLOB}" */}\n`)[0]!.target, { kind: "file", file: "a.ts" });
});
