/**
 * mdx 格式与 fumadocs 适配不接 Next 的那半：识别、树上换节点、meta 白名单、名册压平、按原文渲染。
 * 认记号与渲染在 `@godcreator/docfirst-workflow/mdx`，换节点、代码块长相、名册规则在 `@godcreator/docfirst-fumadocs`。
 * 接 fumadocs 管线的那半（loader、_markdown、页面上的状态点）由 docs-site 的站测试守。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mdx from "../packages/docfirst-workflow/src/mdx/index.ts";
import { parseTree, stamp, walk } from "../packages/docfirst-workflow/src/mdx/index.ts";
import type { Roster, TreeNode } from "../packages/docfirst-workflow/src/mdx/index.ts";
import * as fumadocs from "../packages/docfirst-fumadocs/src/index.ts";
import { DOT_COLOR, applyListing, docfirstMarkdownOptions, parseMetaString, whereOf } from "../packages/docfirst-fumadocs/src/index.ts";
import { fumadocsRoster } from "../packages/docfirst-fumadocs/src/roster.ts";
import type { Target } from "../packages/docfirst-pin/src/index.ts";
import type { Item, Listing, Reference } from "../packages/docfirst-workflow/src/format/index.ts";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const CURRENT = ["export function greet(name: string): string {", "  return `hello ${name}`;"];
const OLD = ["export function greet(name: string): string {", "  return `hi ${name}`;"];

/** 测试里只关心目标与位置，记录一律当没有；不说是草稿就是正式记号 */
type Over = Omit<Partial<Item>, "reference"> & { reference?: Omit<Reference, "record" | "draft"> & { draft?: boolean } };

function itemOf(over: Over): Item {
  const { reference, ...rest } = over;
  return {
    doc: "a.mdx",
    reference: { record: null, draft: false, ...(reference ?? { target: T, at: 0 }) },
    current: CURRENT,
    status: "fresh",
    lines: [2, 3],
    ...rest,
  } as Item;
}

const mark = (target: Target): string => mdx.marker(target, null);
const listingOf = (items: Item[]): Listing => ({ doc: "a.mdx", items });
/** 把一篇 mdx 过一遍换节点，交回换出来的代码块 */
function blocksIn(text: string, items: Item[]): TreeNode[] {
  const tree = applyListing(parseTree(text), listingOf(items));
  return (tree.children ?? []).filter((n) => n.type === "code");
}

test("正式记号与草稿记号都换成代码块：meta 写来源、行号、状态点颜色", () => {
  const text = `${mark(T)}\n\n@@docfirst ref src/greet.ts:2-3 @@\n`;
  const items = [itemOf({}), itemOf({ status: "unconfirmed", reference: { target: T, at: 2, draft: true } })];
  const blocks = blocksIn(text, items);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.lang, "ts");
  assert.equal(blocks[0]!.meta, 'title="src/greet.ts:2-3" lineNumbers=2 data-dot="green"');
  assert.equal(blocks[0]!.value, CURRENT.join("\n"));
  assert.equal(blocks[1]!.meta, 'title="src/greet.ts:2-3 · 未确认" lineNumbers=2 data-dot="unpinned"');
});

test("带记录的正式记号照样认、照样换", () => {
  const text = `${mdx.marker(T, { kind: "content", hash: "3fa9c2e1b07d", blob: "2689fa073ac6" })}\n`;
  assert.equal(blocksIn(text, [itemOf({})]).length, 1);
});

test("标题写今天的位置：行段跟随之后，记号上那几行已经不是这段了", () => {
  const moved = itemOf({ lines: [7, 8] });
  const blocks = blocksIn(`${mark(T)}\n`, [moved]);
  assert.equal(blocks[0]!.meta, 'title="src/greet.ts:7-8" lineNumbers=7 data-dot="green"');
});

test("有变动：diff 渲在同一块里，用 shiki 的 [!code --] / [!code ++]，不带 lineNumbers", () => {
  const changed = itemOf({ status: "changed", reason: "changed", old: OLD, diff: "  export function greet(name: string): string {\n-   return `hi ${name}`;\n+   return `hello ${name}`;" });
  const block = blocksIn(`${mark(T)}\n`, [changed])[0]!;
  assert.equal(block.lang, "ts");
  assert.equal(block.meta, 'title="src/greet.ts:2-3" data-dot="yellow"');
  assert.match(block.value!, /return `hi \$\{name\}`; \/\/ \[!code --\]/);
  assert.match(block.value!, /return `hello \$\{name\}`; \/\/ \[!code \+\+\]/);
  assert.doesNotMatch(block.meta!, /lineNumbers/, "块里夹着已经不存在的旧行，行号对不上源文件");
});

test("有变动但取不到旧内容：没有 diff，退成一块当前段，标题说有变动；位置不明的只留一句说明", () => {
  const plain = blocksIn(`${mark(T)}\n`, [itemOf({ status: "changed", reason: "changed" })])[0]!;
  assert.equal(plain.meta, 'title="src/greet.ts:2-3 · 有变动" lineNumbers=2 data-dot="yellow"');
  assert.equal(plain.value, CURRENT.join("\n"));
  const lost = blocksIn(`${mark(T)}\n`, [itemOf({ status: "changed", reason: "unlocated" })])[0]!;
  assert.equal(lost.value, fumadocs.UNLOCATED_NOTE);
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

test("缺失：显示确认时那段；没有旧内容就说没有", () => {
  const gone = itemOf({ status: "missing", reason: "vanished", current: null, old: OLD });
  const block = blocksIn(`${mark(T)}\n`, [gone])[0]!;
  assert.equal(block.meta, 'title="文档写下时这段是（src/greet.ts:2-3）" data-dot="red"');
  assert.equal(block.value, OLD.join("\n"));
  const blank = blocksIn(`${mark(T)}\n`, [itemOf({ status: "missing", current: null })])[0]!;
  assert.equal(blank.value, "（没有旧内容）");
});

test("整文件：标题只写文件名，行号从 1 起", () => {
  const whole: Target = { kind: "file", file: "config.json" };
  const block = blocksIn(`${mark(whole)}\n`, [itemOf({ reference: { target: whole, at: 0 }, lines: [1, 4], current: ["{", "}"] })])[0]!;
  assert.equal(block.meta, 'title="config.json" lineNumbers=1 data-dot="green"');
  assert.equal(block.lang, "json");
});

/** JSX 节点的属性表：值为 null 的裸属性记成 true */
const attrsOf = (node: TreeNode): Record<string, string | true> =>
  Object.fromEntries((node.attributes ?? []).map((a) => [a.name ?? "", a.value === null || a.value === undefined ? true : (a.value as string)]));

test("目录树：换成 fumadocs 的 Files，根是展开的文件夹、名字按路径嵌套，容器带状态点的颜色", () => {
  const tree: Target = { kind: "tree", dir: "src", depth: 2 };
  const names = ["add.ts", "lib/", "lib/deep.ts", "util/"];
  const files = applyListing(parseTree(`${mark(tree)}\n`), listingOf([itemOf({ reference: { target: tree, at: 0 }, current: names, lines: [1, 4] })])).children![0]!;
  assert.equal(files.type, "mdxJsxFlowElement");
  assert.equal(files.name, "Files");
  assert.deepEqual(attrsOf(files), { className: "docfirst-files", "data-docfirst": "tree", "data-dot": "green" });

  const root = files.children![0]!;
  assert.equal(root.name, "Folder");
  assert.deepEqual(attrsOf(root), { name: "src/", defaultOpen: true });
  assert.deepEqual(root.children!.map((n) => [n.name, attrsOf(n).name]), [["File", "add.ts"], ["Folder", "lib"], ["Folder", "util"]]);
  assert.deepEqual(attrsOf(root.children![1]!), { name: "lib", defaultOpen: true }, "有孩子的文件夹展开");
  assert.deepEqual(root.children![1]!.children!.map((n) => attrsOf(n).name), ["deep.ts"]);
  assert.deepEqual(attrsOf(root.children![2]!), { name: "util", disabled: true }, "到深度尽头没孩子的文件夹禁用");

  // AI 那份的标直接打好：来源 + text 清单；stamp 看到就跳过，不去名册里找 Files
  assert.deepEqual(files.data!.docfirst, { source: "src/", label: "新鲜", value: names.join("\n") });
  assert.doesNotThrow(() => stamp({ type: "root", children: [files] }, {}));
  const state = { containerFlow: (box: TreeNode) => "```text\n" + box.children![0]!.value + "\n```", containerPhrasing: () => "", handle: () => "" };
  assert.equal(docfirstMarkdownOptions().stringify(files, undefined, state, {}), "<!-- 来源 src/ · 新鲜 -->\n\n```text\n" + names.join("\n") + "\n```");
});

test("目录树的黄和红：黄摆当前的名字表、容器是黄点；目录没了只剩一个禁用的根", () => {
  const tree: Target = { kind: "tree", dir: "src", depth: 1 };
  const now = ["add.ts", "store.ts", "tag.ts"];
  const changed = applyListing(
    parseTree(`${mark(tree)}\n`),
    listingOf([itemOf({ reference: { target: tree, at: 0 }, status: "changed", reason: "changed", current: now, lines: [1, 3] })]),
  ).children![0]!;
  assert.equal(attrsOf(changed)["data-dot"], "yellow");
  assert.deepEqual(changed.children![0]!.children!.map((n) => attrsOf(n).name), now);
  assert.equal((changed.data!.docfirst as { value: string }).value, now.join("\n"), "AI 那份给当前的名字表");

  const gone = applyListing(
    parseTree(`${mark(tree)}\n`),
    listingOf([itemOf({ reference: { target: tree, at: 0 }, status: "missing", reason: "dir-missing", current: null })]),
  ).children![0]!;
  assert.equal(attrsOf(gone)["data-dot"], "red");
  assert.deepEqual(attrsOf(gone.children![0]!), { name: "src/", disabled: true });
  assert.equal(attrsOf(gone.children![0]!.children![0]!).name, "（目录不在了）");
});

test("作者手写的 Files 走默认名册：压成一行一个名字，文件夹带尾斜杠", () => {
  const doc = '<Files>\n  <Folder name="src" defaultOpen>\n    <File name="add.ts" />\n  </Folder>\n  <File name="package.json" />\n</Files>\n';
  const tree = stamp(parseTree(doc), fumadocsRoster);
  const files = tree.children![0]!;
  assert.deepEqual(files.data!.docfirstAi, files.children, "Files 只留子内容");
  const folder = files.children!.find((n) => n.name === "Folder")!;
  const ai = folder.data!.docfirstAi as TreeNode[];
  assert.equal(ai[0]!.children![0]!.value, "src/");
});

test("名字：一行芯片，meta 带 data-chip，标题就是芯片上的字", () => {
  const kept: Target = { kind: "has", file: "src/greet.ts", text: "greet" };
  const has: Target = { kind: "has", file: "src/store.ts", text: "export function save" };
  const text = `${mark(kept)}\n\n${mark(has)}\n`;
  const blocks = blocksIn(text, [
    itemOf({ reference: { target: kept, at: 0 }, current: [], lines: [2, 2] }),
    itemOf({ reference: { target: has, at: 2 }, status: "missing", reason: "text-missing", current: null, lines: [1, 1] }),
  ]);
  assert.equal(blocks[0]!.meta, 'title="src/greet.ts · 有 greet" data-dot="green" data-chip');
  assert.equal(blocks[1]!.meta, 'title="src/store.ts · 有 export function save · 缺失" data-dot="red" data-chip');
  const state = { containerFlow: () => "", containerPhrasing: () => "", handle: () => "不该到这儿" };
  assert.equal(docfirstMarkdownOptions().stringify(blocks[0], undefined, state, {}), "<!-- 来源 src/greet.ts · 有 greet · 新鲜 -->", "AI 那份只留来源行");
});

test("whereOf：标题和来源行用同一个字符串，四种目标各一种写法", () => {
  const at = (target: Target, lines: [number, number] = [1, 1]) => whereOf(itemOf({ reference: { target, at: 0 }, lines }));
  assert.equal(at(T, [7, 8]), "src/greet.ts:7-8");
  assert.equal(at({ kind: "file", file: "config.json" }), "config.json");
  assert.equal(at({ kind: "tree", dir: "src", depth: 2, glob: "*.ts" }), "src/ *.ts");
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
  const block = blocksIn(`${mark(T)}\n`, [changed])[0]!;
  const state = {
    containerFlow: () => "",
    containerPhrasing: () => "",
    handle: (node: TreeNode) => "```ts\n" + node.value + "\n```",
  };
  const out = docfirstMarkdownOptions().stringify(block, undefined, state, {})!;
  assert.match(out, /^<!-- 来源 src\/greet\.ts:2-3 · 有变动 -->\n\n```ts\n/);
  assert.doesNotMatch(out, /\[!code/, "AI 那份不要 shiki 的 diff 标记");
  assert.ok(out.includes(CURRENT.join("\n")), "AI 那份放的是当前段");
});

test("名册：默认表压平 Note；项目的规则只用 helpers；表外组件报到行", () => {
  const rules: Roster = {
    ...fumadocsRoster,
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
  assert.deepEqual(Object.keys(fumadocsRoster).sort(), ["File", "Files", "Folder", "Note"], "默认表：Note 加 fumadocs 的文件树三件");
  assert.equal((marks[0]!.docfirstAi as TreeNode[])[0]!.type, "blockquote", "块级 Note 变引用块");
  assert.deepEqual(marks[3]!._stringify, { text: "" }, "drop 的组件整个不要");
  assert.throws(() => stamp(parseTree("# x\n\n<Tabs>\n  x\n</Tabs>\n"), fumadocsRoster), /第 3 行：名册外组件 <Tabs>/);
  assert.deepEqual(mdx.lintComponents("# x\n\n<Tabs>\n  x\n</Tabs>\n"), [{ name: "Tabs", line: 3 }]);
});

test("围栏里、行内的假记号认不出来——走语法树的理由", () => {
  assert.deepEqual(mdx.parse("```md\n" + mark(T) + "\n```\n"), []);
  assert.deepEqual(mdx.parse(`行内的 ${mark(T)} 不算\n`), []);
  assert.deepEqual(mdx.parse("```md\n@@docfirst ref src/greet.ts:2-3 @@\n```\n"), []);
});

test("清单里没有的标记：报到行，不静默漏掉", () => {
  assert.throws(() => applyListing(parseTree(`${mark(T)}\n`), listingOf([])), /第 1 行是引用标记，但清单里没有它/);
});

/* ---------- 生成正本按原文渲染 ---------- */

const RECORD = { kind: "content", hash: "3fa9c2e1b07d", blob: "2689fa073ac6" } as const;
/** 一篇正本在清单里的样子：按 parse 认出的引用逐处配上给定的状态与当前内容 */
function renderOf(text: string, over: (ref: Reference) => Over = () => ({})): string {
  const items = mdx.parse(text).map((reference) => ({ ...itemOf({ reference, ...over(reference) }), reference }));
  return mdx.renderAi(text, listingOf(items));
}

test("按原文渲染：去掉 frontmatter，正式记号换成带语言与 title 的代码块，别的文字逐字节不动", () => {
  const prose = "开头一段，带 `代码` 和 **加粗**，还有 [链接](https://example.com)。\n\n| 表 | 头 |\n| --- | --- |\n| 1 | 2 |\n";
  const text = `---\ntitle: x\n---\n\n# 标题\n\n${prose}\n${mdx.marker(T, RECORD)}\n\n尾巴 \\{ 原样 \\}\n`;
  const out = renderOf(text);
  assert.equal(out, `\n# 标题\n\n${prose}\n\`\`\`ts title="src/greet.ts:2-3"\n${CURRENT.join("\n")}\n\`\`\`\n\n尾巴 \\{ 原样 \\}\n`);
});

test("按原文渲染：行内代码后面紧跟以行内代码开头的加粗段，原样不变（不会把反引号转成 &#x60;）", () => {
  const line = "改完跑 `pnpm doc` **`docfirst check` 要绿**，再提交。";
  assert.equal(renderOf(`# x\n\n${line}\n`), `# x\n\n${line}\n`);
});

test("按原文渲染：行段标题写今天的位置；整文件标题是 路径:1-行数；目录树给名字表；名字整行去掉", () => {
  const whole: Target = { kind: "file", file: "config.json" };
  const tree: Target = { kind: "tree", dir: "src", depth: 1 };
  const has: Target = { kind: "has", file: "src/store.ts", text: "save" };
  const text = [mdx.marker(T, RECORD), "", mdx.marker(whole, RECORD), "", "中间", "", mdx.marker(has, { kind: "has" }), "", mdx.marker(tree, { kind: "tree", hash: RECORD.hash }), ""].join("\n");
  const out = renderOf(text, (ref) => {
    if (ref.target.kind === "file") return { lines: [1, 2], current: ["{", "}"] };
    if (ref.target.kind === "tree") return { lines: [1, 2], current: ["a.ts", "lib/"] };
    if (ref.target.kind === "span") return { lines: [7, 8] };
    return { current: [] };
  });
  assert.equal(
    out,
    ['```ts title="src/greet.ts:7-8"', ...CURRENT, "```", "", '```json title="config.json:1-2"', "{", "}", "```", "", "中间", "", '```text title="src/"', "a.ts", "lib/", "```", ""].join("\n"),
  );
});

test("按原文渲染：围栏里的记号是正文，原样不动；内容里有三个反引号时围栏加长", () => {
  const fenced = `\`\`\`mdx\n${mdx.marker(T, RECORD)}\n\`\`\`\n`;
  assert.equal(renderOf(fenced), fenced);
  const out = renderOf(`${mdx.marker(T, RECORD)}\n`, () => ({ current: ["const s = \"```\";"] }));
  assert.equal(out, '````ts title="src/greet.ts:2-3"\nconst s = "```";\n````\n');
});

test("按原文渲染：写在列表项里的记号，代码块的续行带上列表缩进", () => {
  const out = renderOf(`- 一项：\n\n  ${mdx.marker(T, RECORD)}\n`);
  assert.equal(out, `- 一项：\n\n  \`\`\`ts title="src/greet.ts:2-3"\n  ${CURRENT.join("\n  ")}\n  \`\`\`\n`);
});

test("按原文渲染：草稿记号、缺失的引用、组件、mdx 表达式、import 都渲染不了，一次列全、抛 RenderRefusal", () => {
  const text = [
    "import x from 'y';",
    "",
    "@@docfirst ref src/greet.ts:2-3 @@",
    "",
    mdx.marker({ kind: "span", file: "src/gone.ts", a: 1, b: 2 }, RECORD),
    "",
    "<Note>提示</Note>",
    "",
    "{1 + 1}",
    "",
    "{/* 普通注释 */}",
    "",
  ].join("\n");
  assert.throws(
    () => renderOf(text, (ref) => (ref.target.kind === "span" && ref.target.file === "src/gone.ts" ? { status: "missing", reason: "file-missing", current: null } : {})),
    (err: Error) => {
      assert.equal(err.name, "RenderRefusal");
      for (const piece of ["第 1 行有 import / export", "第 3 行是草稿记号", "第 5 行的引用缺失（文件不在了）", "第 7 行有组件 <Note>", "第 9 行有 mdx 表达式 {1 + 1}", "第 11 行有 mdx 表达式 {/* 普通注释 */}"]) {
        assert.ok(err.message.includes(piece), `报错里该有「${piece}」：${err.message}`);
      }
      return true;
    },
  );
});

test("按原文渲染：CRLF 的正本按 LF 出", () => {
  assert.equal(renderOf("# x\r\n\r\n正文\r\n"), "# x\n\n正文\n");
});
