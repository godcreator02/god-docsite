/**
 * fumadocs 格式包不接 Next 的那半：识别、树上换节点、meta 白名单、名册压平。
 * 接 fumadocs 管线的那半（loader、_markdown、页面上的状态点）由 docs-site 和 examples 的站测试守。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fumadocs from "@god-live-doc/format-fumadocs";
import { DOT_COLOR, applyListing, defaultRoster, livedocMarkdownOptions, parseMetaString, parseTree, stamp, walk, whereOf } from "@god-live-doc/format-fumadocs";
import type { Roster, TreeNode } from "@god-live-doc/format-fumadocs";
import type { Item, Listing, Target } from "@god-live-doc/core";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const CURRENT = ["export function greet(name: string): string {", "  return `hello ${name}`;"];
const OLD = ["export function greet(name: string): string {", "  return `hi ${name}`;"];

function itemOf(over: Partial<Item>): Item {
  return {
    doc: "a.mdx",
    reference: { target: T, at: 0, extra: { draft: false } },
    current: CURRENT,
    record: null,
    status: "fresh",
    lines: [2, 3],
    ...over,
  } as Item;
}

const listingOf = (items: Item[]): Listing => ({ doc: "a.mdx", items, orphans: [] });
/** 把一篇 mdx 过一遍换节点，交回换出来的代码块 */
function blocksIn(text: string, items: Item[]): TreeNode[] {
  const tree = applyListing(parseTree(text), listingOf(items));
  return (tree.children ?? []).filter((n) => n.type === "code");
}

test("正式记号与草稿记号都换成代码块：meta 写来源、行号、状态点颜色", () => {
  const text = `${fumadocs.marker(T)}\n\n@@livedoc ref src/greet.ts:2-3 @@\n`;
  const items = [itemOf({}), itemOf({ status: "unconfirmed", reference: { target: T, at: 2, extra: { draft: true } } })];
  const blocks = blocksIn(text, items);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.lang, "ts");
  assert.equal(blocks[0]!.meta, 'title="src/greet.ts:2-3" lineNumbers=2 data-dot="green"');
  assert.equal(blocks[0]!.value, CURRENT.join("\n"));
  assert.equal(blocks[1]!.meta, 'title="src/greet.ts:2-3 · 未确认" lineNumbers=2 data-dot="unpinned"');
});

test("标题写今天的位置：行段跟随之后，记号上那几行已经不是这段了", () => {
  const moved = itemOf({ lines: [7, 8] });
  const blocks = blocksIn(`${fumadocs.marker(T)}\n`, [moved]);
  assert.equal(blocks[0]!.meta, 'title="src/greet.ts:7-8" lineNumbers=7 data-dot="green"');
});

test("有变动：diff 渲在同一块里，用 shiki 的 [!code --] / [!code ++]，不带 lineNumbers", () => {
  const changed = itemOf({ status: "changed", reason: "changed", old: OLD, diff: "  export function greet(name: string): string {\n-   return `hi ${name}`;\n+   return `hello ${name}`;" });
  const block = blocksIn(`${fumadocs.marker(T)}\n`, [changed])[0]!;
  assert.equal(block.lang, "ts");
  assert.equal(block.meta, 'title="src/greet.ts:2-3" data-dot="yellow"');
  assert.match(block.value!, /return `hi \$\{name\}`; \/\/ \[!code --\]/);
  assert.match(block.value!, /return `hello \$\{name\}`; \/\/ \[!code \+\+\]/);
  assert.doesNotMatch(block.meta!, /lineNumbers/, "块里夹着已经不存在的旧行，行号对不上源文件");
});

test("没有行注释的语言：diff 退成一块 diff", () => {
  const changed = itemOf({
    status: "changed",
    reference: { target: { kind: "span", file: "data.json", a: 1, b: 2 }, at: 0 },
    diff: "  {\n-   \"a\": 1\n+   \"a\": 2",
  });
  const block = blocksIn('{/* ref file="data.json" lines="1-2" */}\n', [changed])[0]!;
  assert.equal(block.lang, "diff");
});

test("缺失：显示文档写下时那段；没有旧内容就说没有", () => {
  const gone = itemOf({ status: "missing", reason: "vanished", current: null, old: OLD });
  const block = blocksIn(`${fumadocs.marker(T)}\n`, [gone])[0]!;
  assert.equal(block.meta, 'title="文档写下时这段是（src/greet.ts:2-3）" data-dot="red"');
  assert.equal(block.value, OLD.join("\n"));
  const blank = blocksIn(`${fumadocs.marker(T)}\n`, [itemOf({ status: "missing", current: null })])[0]!;
  assert.equal(blank.value, "（没有旧内容）");
});

test("整文件：标题只写文件名，行号从 1 起", () => {
  const whole: Target = { kind: "file", file: "config.json" };
  const block = blocksIn(`${fumadocs.marker(whole)}\n`, [itemOf({ reference: { target: whole, at: 0 }, lines: [1, 4], current: ["{", "}"] })])[0]!;
  assert.equal(block.meta, 'title="config.json" lineNumbers=1 data-dot="green"');
  assert.equal(block.lang, "json");
});

test("目录树：一块 text 清单、标题写几项；黄退成 diff 块；红说目录不在了", () => {
  const tree: Target = { kind: "tree", dir: "src", depth: 1 };
  const names = ["add.ts", "index.ts", "store.ts"];
  const fresh = blocksIn(`${fumadocs.marker(tree)}\n`, [itemOf({ reference: { target: tree, at: 0 }, current: names, lines: [1, 3] })])[0]!;
  assert.equal(fresh.lang, "text");
  assert.equal(fresh.meta, 'title="src/ · 目录树 · 3 项" data-dot="green"');
  assert.equal(fresh.value, names.join("\n"));

  const changed = blocksIn(`${fumadocs.marker(tree)}\n`, [
    itemOf({ reference: { target: tree, at: 0 }, status: "changed", current: [...names, "tag.ts"], lines: [1, 4], diff: "  add.ts\n  index.ts\n  store.ts\n+ tag.ts", old: names }),
  ])[0]!;
  assert.equal(changed.lang, "diff", "text 没有行注释语法，退成 diff 块");
  assert.match(changed.value!, /^\+ tag\.ts$/m);

  const gone = blocksIn(`${fumadocs.marker(tree)}\n`, [itemOf({ reference: { target: tree, at: 0 }, status: "missing", reason: "dir-missing", current: null })])[0]!;
  assert.equal(gone.meta, 'title="src/ · 目录树 · 缺失" data-dot="red"');
  assert.equal(gone.value, "（目录不在了）");
});

test("存在性和名字：一行芯片，meta 带 data-chip，标题就是芯片上的字", () => {
  const absent: Target = { kind: "exists", path: "src/remove.ts", absent: true };
  const has: Target = { kind: "has", file: "src/store.ts", text: "export function save" };
  const text = `${fumadocs.marker(absent)}\n\n${fumadocs.marker(has)}\n`;
  const blocks = blocksIn(text, [
    itemOf({ reference: { target: absent, at: 0 }, current: [], lines: [1, 1] }),
    itemOf({ reference: { target: has, at: 2 }, status: "missing", reason: "text-missing", current: null, lines: [1, 1] }),
  ]);
  assert.equal(blocks[0]!.meta, 'title="src/remove.ts · 不存在" data-dot="green" data-chip');
  assert.equal(blocks[1]!.meta, 'title="src/store.ts · 有 export function save · 缺失" data-dot="red" data-chip');
  const state = { containerFlow: () => "", containerPhrasing: () => "", handle: () => "不该到这儿" };
  assert.equal(livedocMarkdownOptions().stringify(blocks[0], undefined, state, {}), "<!-- 来源 src/remove.ts · 不存在 · 新鲜 -->", "AI 那份只留来源行");
});

test("whereOf：标题和来源行用同一个字符串，五种目标各一种写法", () => {
  const at = (target: Target, lines: [number, number] = [1, 1]) => whereOf(itemOf({ reference: { target, at: 0 }, lines }));
  assert.equal(at(T, [7, 8]), "src/greet.ts:7-8");
  assert.equal(at({ kind: "file", file: "config.json" }), "config.json");
  assert.equal(at({ kind: "tree", dir: "src", depth: 2, glob: "*.ts" }), "src/ *.ts");
  assert.equal(at({ kind: "exists", path: "a.ts", absent: false }), "a.ts · 存在");
  assert.equal(at({ kind: "has", file: "a.ts", text: "x" }), "a.ts · 有 x");
});

test("四种状态各一种颜色：新鲜绿、有变动实心黄、未确认空心黄、缺失红", () => {
  assert.deepEqual(DOT_COLOR, { fresh: "green", changed: "yellow", unconfirmed: "unpinned", missing: "red" });
});

test("meta 白名单：认 title / lineNumbers / data-dot / data-chip，别的一律不放行", () => {
  assert.deepEqual(parseMetaString('title="来源" lineNumbers=7 data-dot="green"'), {
    title: "来源",
    "data-line-numbers": true,
    "data-line-numbers-start": 7,
    "data-dot": "green",
  });
  assert.deepEqual(parseMetaString('onclick="alert(1)" data-dot="red"'), { "data-dot": "red" });
  assert.deepEqual(parseMetaString("noCopy"), { allowCopy: "false" });
  assert.deepEqual(parseMetaString('title="x" data-dot="green" data-chip'), { title: "x", "data-dot": "green", "data-chip": true });
});

test("md 那头：来源行 + 一块干净的代码，diff 标记不漏进 AI 那份", () => {
  const changed = itemOf({ status: "changed", diff: "-   a\n+   b", old: OLD });
  const block = blocksIn(`${fumadocs.marker(T)}\n`, [changed])[0]!;
  const state = {
    containerFlow: () => "",
    containerPhrasing: () => "",
    handle: (node: TreeNode) => "```ts\n" + node.value + "\n```",
  };
  const out = livedocMarkdownOptions().stringify(block, undefined, state, {})!;
  assert.match(out, /^<!-- 来源 src\/greet\.ts:2-3 · 有变动 -->\n\n```ts\n/);
  assert.doesNotMatch(out, /\[!code/, "AI 那份不要 shiki 的 diff 标记");
  assert.ok(out.includes(CURRENT.join("\n")), "AI 那份放的是当前段");
});

test("名册：默认表压平 Note；项目的规则只用 helpers；表外组件报到行", () => {
  const rules: Roster = {
    ...defaultRoster,
    Tabs: "children",
    Tab: (node, h) => [h.heading(3, h.attr(node, "title") ?? "标签"), ...h.children()],
    Hidden: "drop",
  };
  const doc = [
    "# 装",
    "",
    "<Note>",
    "  提示",
    "</Note>",
    "",
    "<Tabs>",
    '  <Tab title="pnpm">',
    "    `pnpm add greet`",
    "  </Tab>",
    "</Tabs>",
    "",
    "<Hidden>不进 AI 那份</Hidden>",
    "",
  ].join("\n");
  const tree = stamp(parseTree(doc), rules);
  const marks: Array<Record<string, unknown>> = [];
  walk(tree, (n) => {
    if (n.data !== undefined) marks.push(n.data);
  });
  // Note、Tabs、Tab、Hidden 四个组件各一个标；Hidden 写在一行里，是段落底下的行内组件
  assert.equal(marks.length, 4);
  assert.equal((marks[0]!.livedocAi as TreeNode[])[0]!.type, "blockquote", "块级 Note 变引用块");
  assert.deepEqual(marks[3]!._stringify, { text: "" }, "drop 的组件整个不要");
  assert.throws(() => stamp(parseTree("# x\n\n<Tabs>\n  x\n</Tabs>\n")), /第 3 行：名册外组件 <Tabs>/);
  assert.deepEqual(fumadocs.lintComponents("# x\n\n<Tabs>\n  x\n</Tabs>\n"), [{ name: "Tabs", line: 3 }]);
});

test("围栏里、行内的假记号认不出来——走语法树的理由", () => {
  assert.deepEqual(fumadocs.parse("```md\n" + fumadocs.marker(T) + "\n```\n"), []);
  assert.deepEqual(fumadocs.parse(`行内的 ${fumadocs.marker(T)} 不算\n`), []);
  assert.deepEqual(fumadocs.parse("```md\n@@livedoc ref src/greet.ts:2-3 @@\n```\n"), []);
});

test("清单里没有的标记：报到行，不静默漏掉", () => {
  assert.throws(() => applyListing(parseTree(`${fumadocs.marker(T)}\n`), listingOf([])), /第 1 行是引用标记，但清单里没有它/);
});
