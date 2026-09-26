/**
 * 记号两态的账。语法本身在 `docfirst-workflow/src/marker/`（草稿的哨兵行、正式记号的载荷与记录属性），
 * 外壳归格式——所以两边分开测：
 *   **跨格式的**（mdx 与假格式两个适配器都过）：`parse(marker(t, r))` 认回 t 与 r，四种目标都过；
 *   草稿记号四种情况：认得出、少一头哨兵不认、写在句子里不认、动作词不认识不认
 *   **记录属性**：写了一半、值不合法、不认识的属性，都报错到行
 *   **mdx 自己的**：围栏里的不认、草稿换正式记号、写坏了报到行
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mdxModule from "../packages/docfirst-workflow/src/mdx/index.ts";
import type { MemoRecord, Target } from "../packages/docfirst-pin/src/index.ts";
import type { DocFormat, Reference } from "../packages/docfirst-workflow/src/format/index.ts";
import { draftOf } from "../packages/docfirst-workflow/src/marker/index.ts";
import { fakeFormat } from "./fake-format.ts";

const mdx = mdxModule as unknown as DocFormat;
const FORMATS: DocFormat[] = [mdx, fakeFormat("fake", ".txt")];
const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const ALL: Array<[string, Target]> = [
  ["@@docfirst ref src/greet.ts:2-3 @@", T],
  ["@@docfirst ref config.json @@", { kind: "file", file: "config.json" }],
  ["@@docfirst tree src @@", { kind: "tree", dir: "src", depth: 1 }],
  ["@@docfirst tree src depth=2 glob=*.ts @@", { kind: "tree", dir: "src", depth: 2, glob: "*.ts" }],
  ['@@docfirst has src/store.ts "export function save" @@', { kind: "has", file: "src/store.ts", text: "export function save" }],
  ["@@docfirst has src/store.ts save @@", { kind: "has", file: "src/store.ts", text: "save" }],
];
const DRAFT = ALL[0]![0];
const HASH = "3fa9c2e1b07d";
const BLOB = "2689fa073ac6";

/** 每种目标确认过之后记号上带的记录 */
function recordFor(target: Target): MemoRecord {
  if (target.kind === "span" || target.kind === "file") return { kind: "content", hash: HASH, blob: BLOB };
  if (target.kind === "tree") return { kind: "tree", hash: HASH };
  return { kind: "has" };
}

/** 把一篇里认出的引用全按确认过的样子写回 */
const confirmed = (format: DocFormat, text: string): Reference[] => format.parse(text).map((r) => ({ ...r, record: recordFor(r.target) }));

test("正式记号：parse(marker(t, r)) 认回 t 与 r，四种目标都过，位置也对", () => {
  for (const format of FORMATS) {
    for (const [, target] of ALL) {
      const record = recordFor(target);
      const refs = format.parse(`${format.marker(target, record)}\n`);
      assert.deepEqual(refs.map((r) => [r.target, r.record]), [[target, record]], `${format.name} 的记号自己认不回来：${format.marker(target, record)}`);
      assert.equal(refs[0]!.at, 0);
      assert.ok(!refs[0]!.draft, `${format.name} 把正式记号当成草稿了`);
    }
  }
});

test("没有记录属性的正式记号是未确认；has 例外，正式记号就是确认过", () => {
  for (const format of FORMATS) {
    for (const [, target] of ALL) {
      const want = target.kind === "has" ? { kind: "has" } : null;
      assert.deepEqual(format.parse(`${format.marker(target, null)}\n`)[0]!.record, want, `${format.name}：${format.marker(target, null)}`);
    }
  }
});

test("只有 hash 没有 blob 的行段记录认得（从 hash 记录迁过来的）", () => {
  const record: MemoRecord = { kind: "content", hash: HASH };
  assert.deepEqual(mdx.parse(`${mdx.marker(T, record)}\n`)[0]!.record, record);
  assert.equal(mdx.marker(T, record), `{/* ref file="src/greet.ts" lines="2-3" hash="${HASH}" */}`);
});

test("正式记号里的引号：has 的 text 带引号也认得回来", () => {
  const quoted: Target = { kind: "has", file: "a.ts", text: 'say("hi")' };
  for (const format of FORMATS) assert.deepEqual(format.parse(`${format.marker(quoted, { kind: "has" })}\n`)[0]!.target, quoted, format.name);
});

test("草稿记号：四种目标的写法都认；少哨兵不认、句子里不认、动作词不认识不认", () => {
  for (const format of FORMATS) {
    for (const [draft, target] of ALL) {
      const refs = format.parse(`# 标题\n\n${draft}\n\n尾巴\n`);
      assert.deepEqual(refs.map((r) => [r.target, r.record, r.at, r.draft]), [[target, null, 2, true]], `${format.name} 不认草稿记号：${draft}`);
    }
    assert.deepEqual(format.parse("@@docfirst ref src/greet.ts:2-3\n"), [], `${format.name} 把少一头哨兵的当记号了`);
    assert.deepEqual(format.parse(`这句话里有 ${DRAFT} 不算\n`), [], `${format.name} 把句子里的当记号了`);
    assert.deepEqual(format.parse("@@docfirst probe src @@\n"), [], `${format.name} 把不认识的动作词当记号了`);
  }
});

test("记录属性写了一半、值不合法、不认识的属性：报错到行", () => {
  assert.throws(() => mdx.parse(`{/* ref file="a.ts" lines="1-2" blob="${BLOB}" */}\n`), /第 1 行：记录属性写了一半——有 blob 没有 hash/);
  assert.throws(() => mdx.parse('{/* ref file="a.ts" lines="1-2" hash="xyz" */}\n'), /第 1 行：hash 要是 12 位小写十六进制/);
  assert.throws(() => mdx.parse(`{/* ref file="a.ts" hash="${"a".repeat(40)}" */}\n`), /hash 要是 12 位/);
  assert.throws(() => mdx.parse(`{/* tree dir="src" blob="${BLOB}" */}\n`), /第 1 行：tree 不认属性 blob/);
  assert.throws(() => mdx.parse('{/* ref file="a.ts" lines=1-2 */}\n'), /认不出的写法/);
});

test("mdx：围栏里的草稿记号不认——围栏内容是 code 节点，讲记号怎么写的段落不该变成一处引用", () => {
  assert.deepEqual(mdx.parse("```md\n" + DRAFT + "\n```\n"), []);
  assert.deepEqual(mdx.parse(`\`\`\`mdx\n{/* ref file="a.ts" lines="1-2" hash="${HASH}" blob="${BLOB}" */}\n\`\`\`\n`), []);
});

test("mdx：草稿换成正式记号（花括号注释、带记录），再写一次一个字不变", () => {
  const draft = `---\ntitle: x\n---\n\n# mdx\n\n${DRAFT}\n\n尾巴\n`;
  const once = mdx.write(draft, confirmed(mdx, draft));
  assert.doesNotMatch(once, /@@docfirst/);
  assert.match(once, new RegExp(`\\{/\\* ref file="src/greet\\.ts" lines="2-3" hash="${HASH}" blob="${BLOB}" \\*/\\}`));
  assert.equal(mdx.write(once, mdx.parse(once)), once, "再写一次文档不该再变");
});

test("mdx：写回保留行尾的 CRLF", () => {
  const draft = `# mdx\r\n\r\n${DRAFT}\r\n\r\n尾巴\r\n`;
  const once = mdx.write(draft, confirmed(mdx, draft));
  assert.match(once, /\*\/\}\r\n/);
});

test("mdx：目录树、名字两种正式记号也认得回来", () => {
  const draft = "# mdx\n\n@@docfirst tree src @@\n\n@@docfirst has src/store.ts save @@\n";
  const refs = confirmed(mdx, draft);
  const once = mdx.write(draft, refs);
  assert.match(once, new RegExp(`\\{/\\* tree dir="src" depth="1" hash="${HASH}" \\*/\\}`));
  assert.match(once, /\{\/\* has file="src\/store\.ts" text="save" \*\/\}/);
  assert.deepEqual(mdx.parse(once).map((r) => [r.target, r.record]), refs.map((r) => [r.target, r.record]));
});

test("记号写坏了报到行：少 file、行号不合理、depth 不是正整数；只有 file 没有 lines 是整文件", () => {
  assert.throws(() => mdx.parse('{/* ref lines="2-3" */}\n'), /第 1 行：引用要有 file/);
  assert.throws(() => mdx.parse('{/* ref file="a.ts" lines="3-2" */}\n'), /第 1 行：行号不合理/);
  assert.throws(() => mdx.parse('{/* tree dir="src" depth="0" */}\n'), /第 1 行：depth 要是正整数/);
  assert.throws(() => mdx.parse("@@docfirst tree src deep=2 @@\n"), /第 1 行：tree 的选项只有/);
  assert.deepEqual(mdx.parse('{/* ref file="a.ts" */}\n')[0]!.target, { kind: "file", file: "a.ts" });
});

test("草稿记号的哨兵：头尾 @@ 都在才算，载荷要过 toTarget", () => {
  const where = "第 1 行";
  assert.deepEqual(draftOf("@@docfirst ref src/greet.ts:2-3 @@", where), { kind: "span", file: "src/greet.ts", a: 2, b: 3 });
  assert.deepEqual(draftOf("   @@docfirst ref src/greet.ts:2-3 @@  ", where), { kind: "span", file: "src/greet.ts", a: 2, b: 3 });
  assert.equal(draftOf("@@docfirst ref src/greet.ts:2-3", where), null, "少尾哨兵");
  assert.equal(draftOf("docfirst ref src/greet.ts:2-3 @@", where), null, "少头哨兵");
  assert.equal(draftOf("这句话里有 @@docfirst ref src/greet.ts:2-3 @@ 不算", where), null);
  assert.throws(() => draftOf("@@docfirst ref src/greet.ts:3-2 @@", where), /行号不合理/);
  assert.equal(draftOf("@@docfirst probe src @@", where), null, "动作词不认识");
});
