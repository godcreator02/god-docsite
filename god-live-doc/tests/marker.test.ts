/**
 * 记号两态的账（md、html 两个格式包）：
 *   parse(marker(t)) 认回 t——正式记号「怎么写」和「怎么认」住同一个包
 *   草稿记号四种情况：认得出、少一头哨兵不认、写在句子里不认、围栏 / script 里不认
 *   写回：草稿换成正式形态并投影，展示区整段重写而不是追加
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as md from "@god-live-doc/format-md";
import * as html from "@god-live-doc/format-html";
import type { Fill, Format, Target } from "@god-live-doc/core";

const FORMATS: Format[] = [md as unknown as Format, html as unknown as Format];
const T: Target = { file: "src/greet.ts", a: 2, b: 3 };
const DRAFT = "@@livedoc ref src/greet.ts:2-3 @@";
const CODE = ["export function greet(name: string): string {", "  return `hello ${name}`;"];
const fillsOf = (format: Format, text: string): Fill[] => format.parse(text).map((reference) => ({ reference, current: CODE }));

test("正式记号：parse(marker(t)) 认回 t，位置也对", () => {
  for (const format of FORMATS) {
    const refs = format.parse(`${format.marker(T)}\n`);
    assert.deepEqual(refs.map((r) => r.target), [T], `${format.name} 的记号自己认不回来`);
    assert.equal(refs[0]!.at, 0);
    assert.equal(refs[0]!.extra?.draft, false);
  }
});

test("草稿记号：四种情况——认、少哨兵不认、句子里不认、围栏 / script 里不认", () => {
  for (const format of FORMATS) {
    const refs = format.parse(`# 标题\n\n${DRAFT}\n\n尾巴\n`);
    assert.deepEqual(refs.map((r) => [r.target, r.at, r.extra?.draft]), [[T, 2, true]], `${format.name} 不认草稿记号`);
    assert.deepEqual(format.parse("@@livedoc ref src/greet.ts:2-3\n"), [], `${format.name} 把少一头哨兵的当记号了`);
    assert.deepEqual(format.parse(`这句话里有 ${DRAFT} 不算\n`), [], `${format.name} 把句子里的当记号了`);
  }
  assert.deepEqual(md.parse("```md\n" + DRAFT + "\n```\n"), [], "md：围栏里的不认");
  assert.deepEqual(html.parse(`<script>\n${DRAFT}\n</script>\n`), [], "html：script 里的不认");
  assert.deepEqual(html.parse('<p>写法是 &lt;pre data-file="src/greet.ts" data-lines="2-3"&gt;&lt;/pre&gt;</p>\n'), [], "html：转义的不认");
});

test("md：草稿换成正式记号并长出展示区；再写一次是整段覆写，不追加", () => {
  const draft = `# md\n\n${DRAFT}\n\n尾巴\n`;
  const once = md.write(draft, fillsOf(md as unknown as Format, draft));
  assert.doesNotMatch(once, /@@livedoc/);
  assert.match(once, /<!-- ref file="src\/greet\.ts" lines="2-3" -->\n```ts\nexport function greet[\s\S]*```\n<!-- \/ref -->\n/);
  const twice = md.write(once, fillsOf(md as unknown as Format, once));
  assert.equal(twice, once, "再写一次文档不该再变");
  assert.equal(once.split("```").length - 1, 2, "只有一对围栏");
});

test("html：草稿行换成元素并投影，缩进和外壳留着；容器不是 pre 就往里放 pre", () => {
  const draft = `<h1>html</h1>\n<figure class="code">\n  <figcaption>签名</figcaption>\n  ${DRAFT}\n</figure>\n`;
  const once = html.write(draft, fillsOf(html as unknown as Format, draft));
  assert.match(once, /\n {2}<pre data-file="src\/greet\.ts" data-lines="2-3"><code class="language-ts">export function greet[\s\S]*<\/code><\/pre>\n<\/figure>/);
  const twice = html.write(once, fillsOf(html as unknown as Format, once));
  assert.equal(twice, once, "再写一次文档不该再变");
  assert.equal(once.split("<code").length, 2, "第二次不该多出一个 <code>");

  const inDiv = '<div data-file="src/greet.ts" data-lines="2-3"></div>\n';
  const filled = html.write(inDiv, fillsOf(html as unknown as Format, inDiv));
  assert.match(filled, /<div data-file="src\/greet\.ts" data-lines="2-3"><pre><code class="language-ts">export function greet/);
});

test("html：开标签拆成多行、没闭合，都报到行号", () => {
  assert.throws(() => html.parse('<p>x</p>\n<pre\n  data-file="src/greet.ts" data-lines="2-3"></pre>\n'), /第 2 行：带 data-file 的开标签要写在一行里/);
  assert.throws(() => html.parse('<div data-file="src/greet.ts" data-lines="2-3">\n<p>x</p>\n'), /第 1 行：<div data-file> 没有闭合/);
});

test("记号写坏了报到行：少 file、行号不合理", () => {
  assert.throws(() => md.parse('<!-- ref lines="2-3" -->\n'), /第 1 行：引用要有 file/);
  assert.throws(() => md.parse('<!-- ref file="a.ts" lines="3-2" -->\n'), /第 1 行：行号不合理/);
  assert.throws(() => html.parse('<pre data-file="a.ts"></pre>\n'), /第 1 行：引用要有 lines/);
});

test("md：展示区不是记忆——手改围栏里的字，parse 认到的还是那条引用", () => {
  const doc = md.write(`${md.marker(T)}\n`, [{ reference: { target: T, at: 0, extra: { close: -1 } }, current: CODE }]);
  const tampered = doc.replace("hello", "手改");
  assert.deepEqual(md.parse(tampered).map((r) => r.target), [T]);
});
