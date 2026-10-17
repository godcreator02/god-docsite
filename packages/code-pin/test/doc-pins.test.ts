/**
 * 一篇文档的核对与确认：格式认钉、钉码核心判定、结果带回标记所在的行，确认时交给同一个格式写回。
 * 用内存读取器：判定本身由 core.test.ts 检查。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { blobOf, codeMarker, createDocPinning, createPinner, formatOf, hashSpan, mdxMarker, PIN_FORMATS } from "../src/core/index.ts";
import type { History, MemoRecord, Target } from "../src/core/index.ts";

const CODE = ["// greet", "export function greet(name: string): string {", "  return `hello ${name}`;", "}", ""];
const DOC = "d.mdx";
const SPAN: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const plain = { accept: false };
const NO_HISTORY: History = { oldText: () => null };
const refLine = (target: Target): string => mdxMarker(target, null);

function setup(files = new Map<string, string[]>([["src/greet.ts", [...CODE]]])) {
  const pinning = createDocPinning(createPinner({ reader: { read: (file) => files.get(file) ?? null }, history: NO_HISTORY }), PIN_FORMATS);
  return { files, pinning };
}

test("checkDoc：认出的每处按原来的顺序带回所在的行与记录", () => {
  const { pinning } = setup();
  const text = `# 标题\n\n${refLine(SPAN)}\n\n${refLine({ kind: "span", file: "src/nowhere.ts", a: 1, b: 2 })}\n\n${refLine({ kind: "file", file: "src/greet.ts" })}\n`;
  const checked = pinning.checkDoc(DOC, text);
  assert.equal(checked.doc, DOC);
  assert.deepEqual(
    checked.checks.map((c) => [c.pin.line, c.pin.record, c.status]),
    [
      [3, null, "unconfirmed"],
      [5, null, "missing"],
      [7, null, "unconfirmed"],
    ],
  );
  assert.equal(checked.checks[1]!.reason, "file-missing");
  assert.deepEqual(checked.checks[0]!.current, CODE.slice(1, 3));
});

test("checkDoc：标记写坏了的报错补上是哪篇文档", () => {
  const { pinning } = setup();
  assert.throws(() => pinning.checkDoc(DOC, '# 标题\n\n{/* probe dir="src" */}\n'), /^Error: d\.mdx 第 3 行：标记的动作词只有/);
});

test("confirmDoc：未确认的标记写上记录，步骤与核对结果一一对应，写回在标记原来那一行", () => {
  const { pinning } = setup();
  const text = `# 标题\n\n${refLine(SPAN)}\n\n尾巴\n`;
  const done = pinning.confirmDoc(DOC, text, plain);
  assert.equal(done.changed, true);
  done.steps.forEach((step, i) => assert.equal(step.check, done.checks[i]));
  assert.deepEqual(done.steps.map((s) => [s.action, s.check.pin.record, s.check.pin.line]), [["recorded", null, 3]]);
  assert.equal(done.text, `# 标题\n\n{/* ref file="src/greet.ts" lines="2-3" hash="${hashSpan(CODE.slice(1, 3))}" blob="${blobOf(CODE)}" */}\n\n尾巴\n`);
  assert.deepEqual(pinning.checkDoc(DOC, done.text).checks.map((c) => [c.status, c.pin.record === null]), [["fresh", false]]);
});

test("confirmDoc：一处钉不住只是那一处不动，别的照写；什么都不用写时原文不变", () => {
  const { pinning } = setup();
  const bad = refLine({ kind: "span", file: "src/nowhere.ts", a: 1, b: 2 });
  const done = pinning.confirmDoc(DOC, `${refLine(SPAN)}\n\n${bad}\n`, plain);
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded", "refused"]);
  const lines = done.text.split("\n");
  assert.match(lines[0]!, /hash="[0-9a-f]{12}"/, "钉得住的那处写上了记录");
  assert.equal(lines[2], bad, "红的那处一个字没动");
  const again = pinning.confirmDoc(DOC, done.text, plain);
  assert.deepEqual(again.steps.map((s) => s.action), ["unchanged", "refused"]);
  assert.deepEqual([again.changed, again.text], [false, done.text]);
});

test("confirmDoc：黄灯不带 accept 原样不动，带 accept 按今天的内容重新记", () => {
  const { files, pinning } = setup();
  const confirmed = pinning.confirmDoc(DOC, `${refLine(SPAN)}\n`, plain).text;
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  const pending = pinning.confirmDoc(DOC, confirmed, plain);
  assert.deepEqual([pending.steps[0]!.action, pending.changed], ["needs-accept", false]);
  const signed = pinning.confirmDoc(DOC, confirmed, { accept: true });
  assert.equal(signed.steps[0]!.action, "accepted");
  assert.deepEqual(pinning.checkDoc(DOC, signed.text).checks.map((c) => c.status), ["fresh"]);
});

/* ---------- 组件源码格式 ---------- */

const CT: Target = { kind: "span", file: "../src/greet.ts", a: 2, b: 3 };
const RECORD: MemoRecord = { kind: "content", hash: "3fa9c2e1b07d", blob: "2689fa073ac6" };
const COMPONENT = "content/docs/greet/greet.data.mjs";
const code = formatOf(COMPONENT, PIN_FORMATS);

test("认领：mdx 认 .mdx；组件格式认 .ts / .tsx / .mjs，在哪个目录都一样；别的扩展名都不认", () => {
  assert.equal(code.name, "组件格式");
  for (const file of [COMPONENT, "content/docs/greet/greet.tsx", "content/_components/registry.ts"]) assert.equal(formatOf(file, PIN_FORMATS).name, "组件格式", file);
  assert.equal(formatOf("content/docs/a.mdx", PIN_FORMATS).name, "mdx 格式");
  for (const file of ["content/docs/greet/greet.css", "content/docs/greet/fpga.data.d.mts", "content/docs/notes.md"]) {
    assert.throws(() => formatOf(file, PIN_FORMATS), /没有格式认领这个文件/, file);
  }
});

test("组件格式往返：parse(codeMarker(t, r)) 认回目标与记录；里面那一截跟 mdx 的一字不差", () => {
  const cases: Array<[Target, MemoRecord]> = [
    [CT, RECORD],
    [{ kind: "file", file: "a.json" }, RECORD],
    [{ kind: "tree", dir: "src", depth: 2, glob: "*.ts" }, { kind: "tree", hash: "3fa9c2e1b07d" }],
  ];
  for (const [target, confirmed] of cases) {
    for (const record of [null, confirmed]) {
      const line = codeMarker(target, record);
      assert.deepEqual(code.parse(`const a = 1;\n  ${line}\n`).map((p) => [p.target, p.record, p.line]), [[target, record, 2]], line);
      assert.equal(`{${line}}`, mdxMarker(target, record), "同一条标记在两种载体里只有外壳不同");
    }
  }
});

test("组件格式里不算标记的：JSDoc、行里还有别的代码、一行两个注释、普通注释", () => {
  const lines = [
    '/** ref file="a.ts" */',
    'const x = 1; /* ref file="a.ts" */',
    '/* ref file="a.ts" */ const x = 1;',
    '/* a */ /* ref file="a.ts" */',
    "/* 普通注释 */",
    "/* ── 第 1 步 ── */",
    "/* webpackIgnore: true */",
    ' * /* ref file="a.ts" */ 写在 JSDoc 里的一行',
  ];
  assert.deepEqual(code.parse(lines.join("\n")), []);
});

test("组件格式写错了报错到行，好几处一次列全", () => {
  assert.throws(() => code.parse('x\n/* probe dir="src" */\n'), /第 2 行：标记的动作词只有 ref \/ tree，不认识 probe/);
  assert.throws(() => code.parse('/* ref file="a.ts" hash="3fa9c2e1b07d" */\n'), /第 1 行：ref 的记录只写了一半/);
  assert.throws(
    () => code.parse('/* probe dir="src" */\nx\n/* ref file="a.ts" hash="3fa9c2e1b07d" */\n'),
    (err: Error) => err.message.includes("第 1 行：标记的动作词只有") && err.message.includes("第 3 行：ref 的记录只写了一半"),
  );
});

test("组件格式写回：整行替换，保留缩进与行尾 \\r，别的行一个字节不动；再写一次不变", () => {
  const text = `export const a = [\r\n    ${codeMarker(CT, null)}\r\n  'x',\r\n];\r\n`;
  const written = code.parse(text).map((p) => ({ line: p.line, target: p.target, record: RECORD }));
  const once = code.write(text, written);
  const lines = once.split("\n");
  assert.equal(lines[1], `    ${codeMarker(CT, RECORD)}\r`);
  assert.deepEqual([lines[0], lines[2], lines[3]], text.split("\n").filter((_, i) => i !== 1).slice(0, 3));
  assert.equal(code.write(once, written), once);
});

test("按文件挑格式：组件文件走组件格式写回；没有格式认领的文件报错", () => {
  const { pinning } = setup(new Map([["../src/greet.ts", ["// greet", "export function greet() {", "  return 1;", "}"]]]));
  const text = `export const x = 1;\n${codeMarker(CT, null)}\nexport const y = 2;\n`;
  const done = pinning.confirmDoc(COMPONENT, text, plain);
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded"]);
  assert.match(done.text.split("\n")[1]!, /^\/\* ref file="\.\.\/src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/$/);
  assert.throws(() => pinning.checkDoc("content/docs/greet/greet.css", ""), /没有格式认领/);
});
