/**
 * 组件格式（`docfirst-workflow/src/code/`）的账：讲解组件源码里单独一行的块注释是记号。
 *   **认领**：只认站的 src/components/ 下的 .ts / .tsx / .mjs
 *   **往返**：`parse(marker(t, r))` 认回 t 与 r；里面那一截跟 mdx 的一字不差
 *   **不算记号的**：JSDoc、行里还有别的代码、一行两个注释、普通注释
 *   **写错了报错**：认不出动作词、以 @@docfirst 开头、记录只写了一半
 *   **写回**：整行替换，保留缩进与行尾 \r，别的行一个字节不动
 * 再走一遍钉码编排按文件挑格式、项目装配把组件文件列进现状区、命令行照常核对与确认。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as code from "../packages/docfirst-workflow/src/code/index.ts";
import * as mdx from "../packages/docfirst-workflow/src/mdx/index.ts";
import { createPinner } from "../packages/docfirst-pin/src/index.ts";
import type { MemoRecord, Target } from "../packages/docfirst-pin/src/index.ts";
import { createPinning, formatOf } from "../packages/docfirst-workflow/src/pinning/index.ts";
import { setupProject } from "./cli-project.ts";
import { NO_HISTORY } from "./repo.ts";

const T: Target = { kind: "span", file: "../src/greet.ts", a: 2, b: 3 };
const RECORD: MemoRecord = { kind: "content", hash: "3fa9c2e1b07d", blob: "2689fa073ac6" };
const FILE = "src/components/greet/greet.data.mjs";

test("认领：站的 src/components/ 下的 .ts / .tsx / .mjs，别的都不认", () => {
  for (const file of [FILE, "src/components/a/a.tsx", "src/components/registry.ts"]) assert.equal(code.claims(file), true, file);
  for (const file of ["src/components/a/a.css", "src/lib/source.ts", "content/docs/a.mdx", "scripts/x.mjs"]) assert.equal(code.claims(file), false, file);
});

test("往返：parse(marker(t, r)) 认回目标与记录，四种目标、确认前后都过；里面那一截跟 mdx 的一字不差", () => {
  const cases: Array<[Target, MemoRecord]> = [
    [T, RECORD],
    [{ kind: "file", file: "a.json" }, RECORD],
    [{ kind: "tree", dir: "src", depth: 2, glob: "*.ts" }, { kind: "tree", hash: "3fa9c2e1b07d" }],
    [{ kind: "has", file: "a.ts", text: 'say("hi")' }, { kind: "has" }],
  ];
  for (const [target, confirmed] of cases) {
    // has 的记号本身就是记录，不带记录属性写下也是确认过的
    for (const [record, expected] of [[null, target.kind === "has" ? confirmed : null], [confirmed, confirmed]] as const) {
      const line = code.marker(target, record);
      assert.deepEqual(code.parse(`const a = 1;\n  ${line}\n`).map((r) => [r.target, r.record, r.at]), [[target, expected, 1]], line);
      assert.equal(`{${line}}`, mdx.marker(target, record), "同一条引用在两种载体里只有外壳不同");
    }
  }
});

test("不算记号的：JSDoc、行里还有别的代码、一行两个注释、普通注释", () => {
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

test("写错了报错到行：认不出动作词、以 @@docfirst 开头、记录只写了一半", () => {
  assert.throws(() => code.parse('x\n/* probe dir="src" */\n'), /第 2 行：记号的动作词只有 ref \/ tree \/ has，不认识 probe/);
  assert.throws(() => code.parse("/* @@docfirst ref a.ts:1-2 @@ */\n"), /第 1 行：@@docfirst 草稿写法已经删了/);
  assert.throws(() => code.parse('/* ref file="a.ts" hash="3fa9c2e1b07d" */\n'), /第 1 行：ref 的记录只写了一半/);
  assert.throws(
    () => code.parse('/* probe dir="src" */\nx\n/* ref file="a.ts" hash="3fa9c2e1b07d" */\n'),
    (err: Error) => err.message.includes("第 1 行：记号的动作词只有") && err.message.includes("第 3 行：ref 的记录只写了一半"),
    "写坏了好几处一次列全",
  );
});

test("写回：整行替换，保留缩进与行尾 \\r，别的行一个字节不动；再写一次不变", () => {
  const text = `export const a = [\r\n    ${code.marker(T, null)}\r\n  'x',\r\n];\r\n`;
  const written = code.parse(text).map((r) => ({ target: r.target, record: RECORD, at: r.at }));
  const once = code.write(text, written);
  const lines = once.split("\n");
  assert.equal(lines[1], `    ${code.marker(T, RECORD)}\r`);
  assert.deepEqual([lines[0], lines[2], lines[3]], text.split("\n").filter((_, i) => i !== 1).slice(0, 3));
  assert.equal(code.write(once, written), once);
});

test("钉码编排按文件挑格式：组件文件走组件格式写回；没有格式认领的文件报错", () => {
  const files = new Map([["../src/greet.ts", ["// greet", "export function greet() {", "  return 1;", "}"]]]);
  const pinning = createPinning(createPinner({ reader: { read: (file) => files.get(file) ?? null }, history: NO_HISTORY }));
  const text = `export const x = 1;\n${code.marker(T, null)}\nexport const y = 2;\n`;
  const done = pinning.confirmDoc(FILE, text, { accept: false });
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded"]);
  assert.match(done.text.split("\n")[1]!, /^\/\* ref file="\.\.\/src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/$/);
  assert.equal(formatOf(FILE).name, "组件格式");
  assert.equal(formatOf("content/docs/a.mdx").name, "mdx 格式");
  assert.throws(() => formatOf("src/lib/source.ts"), /src\/lib\/source\.ts：没有格式认领这个文件/);
  assert.throws(() => pinning.checkDoc("src/lib/source.ts", ""), /没有格式认领/);
});

test("现状区加上 src/components/ 下的代码文件：命令行照常核对与确认，名册检查与摆放只对 mdx", async () => {
  const p = setupProject();
  try {
    mkdirSync(join(p.root, "src", "components", "greet"), { recursive: true });
    const component = "src/components/greet/greet.data.mjs";
    writeFileSync(join(p.root, component), `/* ref file="src/greet.ts" lines="2-3" */\nexport const lines = ['<Callout>不是组件</Callout>'];\n`);
    writeFileSync(join(p.root, "src", "components", "greet", "greet.css"), '/* ref file="nowhere.ts" */\n');
    const first = await p.cli("check", "--json");
    assert.equal(first.code, 0, first.out);
    const report = JSON.parse(first.out) as { docs: Array<{ doc: string; items: Array<{ status: string }>; components: unknown[] }> };
    assert.deepEqual(report.docs.map((d) => d.doc), ["docs/a.mdx", "docs/b.mdx", component], "css 没有格式认领，不进现状区");
    const entry = report.docs.find((d) => d.doc === component)!;
    assert.deepEqual([entry.items.map((i) => i.status), entry.components], [["unconfirmed"], []]);

    const done = await p.cli("confirm", component);
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ src\/components\/greet\/greet\.data\.mjs {2}src\/greet\.ts:2-3 {2}已确认，写上了记录/);
    assert.match(p.read(component), /^\/\* ref file="src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/\n/);
    assert.match((await p.cli("check")).out, /🟢 src\/components\/greet\/greet\.data\.mjs {2}src\/greet\.ts:2-3 {2}新鲜/);
  } finally {
    p.teardown();
  }
});
