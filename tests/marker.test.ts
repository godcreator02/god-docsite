/**
 * 记号两态的账。语法本身住 `engine/marker.ts`（草稿的哨兵行、正式记号的载荷、记录簿的键），
 * 外壳归格式——所以两边分开测：
 *   **跨格式的**（mdx 与假格式两个适配器都过）：`parse(marker(t))` 认回 t，五种目标都过；
 *   草稿记号四种情况：认得出、少一头哨兵不认、写在句子里不认、动作词不认识不认
 *   **mdx 自己的**：围栏里的不认、草稿换正式记号、写坏了报到行
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mdxModule from "../packages/livedoc/src/fumadocs/index.ts";
import type { Fill, Format, Target } from "../packages/livedoc/src/engine/index.ts";
import { fakeFormat } from "./fake-format.ts";

const mdx = mdxModule as unknown as Format;
const FORMATS: Format[] = [mdx, fakeFormat("fake", ".txt")];
const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const ALL: Array<[string, Target]> = [
  ["@@livedoc ref src/greet.ts:2-3 @@", T],
  ["@@livedoc ref config.json @@", { kind: "file", file: "config.json" }],
  ["@@livedoc tree src @@", { kind: "tree", dir: "src", depth: 1 }],
  ["@@livedoc tree src depth=2 glob=*.ts @@", { kind: "tree", dir: "src", depth: 2, glob: "*.ts" }],
  ["@@livedoc exists src/store.ts @@", { kind: "exists", path: "src/store.ts", absent: false }],
  ["@@livedoc absent src/remove.ts @@", { kind: "exists", path: "src/remove.ts", absent: true }],
  ['@@livedoc has src/store.ts "export function save" @@', { kind: "has", file: "src/store.ts", text: "export function save" }],
  ["@@livedoc has src/store.ts save @@", { kind: "has", file: "src/store.ts", text: "save" }],
];
const DRAFT = ALL[0]![0];
const CODE = ["export function greet(name: string): string {", "  return `hello ${name}`;"];
const fillsOf = (format: Format, text: string, current = CODE): Fill[] => format.parse(text).map((reference) => ({ reference, current }));

test("正式记号：parse(marker(t)) 认回 t，五种目标都过，位置也对", () => {
  for (const format of FORMATS) {
    for (const [, target] of ALL) {
      const refs = format.parse(`${format.marker(target)}\n`);
      assert.deepEqual(refs.map((r) => r.target), [target], `${format.name} 的记号自己认不回来：${format.marker(target)}`);
      assert.equal(refs[0]!.at, 0);
      assert.ok(refs[0]!.extra?.draft !== true, `${format.name} 把正式记号当成草稿了`);
    }
  }
});

test("正式记号里的引号：has 的 text 带引号也认得回来", () => {
  const quoted: Target = { kind: "has", file: "a.ts", text: 'say("hi")' };
  for (const format of FORMATS) assert.deepEqual(format.parse(`${format.marker(quoted)}\n`)[0]!.target, quoted, format.name);
});

test("草稿记号：五种目标的写法都认；少哨兵不认、句子里不认、动作词不认识不认", () => {
  for (const format of FORMATS) {
    for (const [draft, target] of ALL) {
      const refs = format.parse(`# 标题\n\n${draft}\n\n尾巴\n`);
      assert.deepEqual(refs.map((r) => [r.target, r.at, r.extra?.draft]), [[target, 2, true]], `${format.name} 不认草稿记号：${draft}`);
    }
    assert.deepEqual(format.parse("@@livedoc ref src/greet.ts:2-3\n"), [], `${format.name} 把少一头哨兵的当记号了`);
    assert.deepEqual(format.parse(`这句话里有 ${DRAFT} 不算\n`), [], `${format.name} 把句子里的当记号了`);
    assert.deepEqual(format.parse("@@livedoc probe src @@\n"), [], `${format.name} 把不认识的动作词当记号了`);
  }
});

test("mdx：围栏里的草稿记号不认——围栏内容是 code 节点，讲记号怎么写的段落不该变成一处引用", () => {
  assert.deepEqual(mdx.parse("```md\n" + DRAFT + "\n```\n"), []);
});

test("mdx：草稿换成正式记号（花括号注释），再写一次一个字不变", () => {
  const draft = `---\ntitle: x\n---\n\n# mdx\n\n${DRAFT}\n\n尾巴\n`;
  const once = mdx.write(draft, fillsOf(mdx, draft));
  assert.doesNotMatch(once, /@@livedoc/);
  assert.match(once, /\{\/\* ref file="src\/greet\.ts" lines="2-3" \*\/\}/);
  assert.equal(mdx.write(once, fillsOf(mdx, once)), once, "再写一次文档不该再变");
});

test("mdx：目录树、存在性、名字三种正式记号也认得回来", () => {
  const draft = "# mdx\n\n@@livedoc tree src @@\n\n@@livedoc absent src/remove.ts @@\n\n@@livedoc has src/store.ts save @@\n";
  const fills = mdx.parse(draft).map((reference) => ({ reference, current: reference.target.kind === "tree" ? ["add.ts", "store.ts"] : [] }));
  const once = mdx.write(draft, fills);
  assert.match(once, /\{\/\* tree dir="src" depth="1" \*\/\}/);
  assert.match(once, /\{\/\* absent path="src\/remove\.ts" \*\/\}/);
  assert.match(once, /\{\/\* has file="src\/store\.ts" text="save" \*\/\}/);
  assert.deepEqual(mdx.parse(once).map((r) => r.target), fills.map((f) => f.reference.target));
});

test("记号写坏了报到行：少 file、行号不合理、depth 不是正整数；只有 file 没有 lines 是整文件", () => {
  assert.throws(() => mdx.parse('{/* ref lines="2-3" */}\n'), /第 1 行：引用要有 file/);
  assert.throws(() => mdx.parse('{/* ref file="a.ts" lines="3-2" */}\n'), /第 1 行：行号不合理/);
  assert.throws(() => mdx.parse('{/* tree dir="src" depth="0" */}\n'), /第 1 行：depth 要是正整数/);
  assert.throws(() => mdx.parse("@@livedoc tree src deep=2 @@\n"), /第 1 行：tree 的选项只有/);
  assert.deepEqual(mdx.parse('{/* ref file="a.ts" */}\n')[0]!.target, { kind: "file", file: "a.ts" });
});
