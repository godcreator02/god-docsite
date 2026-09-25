/**
 * 术语标注：纯匹配那一层（建索引的三种拒收、长词优先、词边界、一篇只标第一次），
 * 加 remark 半在树上换节点的行为（哪些地方不标、换出来的形状）。
 * 站上长什么样由 docs-site 的构建守，这里不碰 React。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTermIndex, findTerms, remarkGlossary } from "../packages/docfirst-fumadocs/src/index.ts";
import type { TermEntry } from "../packages/docfirst-fumadocs/src/index.ts";
import type { TreeNode } from "../packages/docfirst-workflow/src/mdx/index.ts";

const BUS: TermEntry = { term: "命令总线", def: "件把能力挂上去、界面和 agent 从同一张表调" };
const SVC: TermEntry = { term: "总线", def: "泛指一条把多方接到一起的通道" };
const PANE: TermEntry = { term: "pane", aliases: ["窗格"], def: "外壳里的一格", href: "/docs/shell" };

const textOf = (node: TreeNode): string =>
  node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");

test("建索引：空词、单字词、抢同一个表面词，三种当场拒", () => {
  assert.throws(() => buildTermIndex([{ term: "件", def: "x" }]), /只有一个字/);
  assert.throws(() => buildTermIndex([{ term: "总线", def: "a" }, { term: "总线", def: "b" }]), /只能属于一条术语/);
  assert.throws(() => buildTermIndex([{ term: "窗格", aliases: ["  "], def: "x" }]), /空的表面词/);
});

test("长词优先：命令总线不会被总线切碎", () => {
  const index = buildTermIndex([SVC, BUS]);
  const spans = findTerms("能力挂到命令总线上", index, new Set());
  assert.equal(spans.length, 1);
  assert.equal(spans[0]?.entry.term, "命令总线");
});

test("西文要词边界：pane 不命中 panel", () => {
  const index = buildTermIndex([PANE]);
  assert.equal(findTerms("这是一个 panel 组件", index, new Set()).length, 0);
  assert.equal(findTerms("这是一个 pane 组件", index, new Set()).length, 1);
});

test("别名跟本名一样参与匹配，交回的还是那一条术语", () => {
  const index = buildTermIndex([PANE]);
  const spans = findTerms("外壳里开一个窗格", index, new Set());
  assert.equal(spans[0]?.entry.term, "pane");
  assert.equal(spans[0]?.entry.href, "/docs/shell");
});

test("一篇只标第一次；不传 taken 就每处都标", () => {
  const index = buildTermIndex([SVC]);
  const taken = new Set<string>();
  assert.equal(findTerms("总线在这儿，总线也在那儿", index, taken).length, 1);
  assert.equal(findTerms("又一处总线", index, taken).length, 0);
  assert.equal(findTerms("总线在这儿，总线也在那儿", index, undefined).length, 2);
});

test("命中的地方换成 Term 组件，定义与详解写在属性上", () => {
  const tree: TreeNode = {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: "外壳里开一个窗格看东西" }] }],
  };
  remarkGlossary({ terms: [PANE] })(tree, { path: "a.mdx" });
  const kids = tree.children?.[0]?.children ?? [];
  assert.equal(kids.length, 3);
  assert.equal(kids[1]?.type, "mdxJsxTextElement");
  assert.equal(kids[1]?.name, "Term");
  assert.equal(textOf(kids[1]!), "窗格");
  const attrs = kids[1]?.attributes ?? [];
  assert.equal(attrs.find((a) => a.name === "def")?.value, PANE.def);
  assert.equal(attrs.find((a) => a.name === "href")?.value, "/docs/shell");
  assert.equal(textOf(tree), "外壳里开一个窗格看东西");
});

test("代码、标题、链接、注入的投影，一处都不标", () => {
  const prose = (value: string): TreeNode => ({ type: "text", value });
  const tree: TreeNode = {
    type: "root",
    children: [
      { type: "code", value: "const 窗格 = 1", lang: "ts" },
      { type: "heading", depth: 2, children: [prose("窗格这一节")] },
      { type: "paragraph", children: [{ type: "inlineCode", value: "窗格" }] },
      { type: "link", children: [prose("窗格")] },
      { type: "paragraph", data: { docfirstAi: [] }, children: [prose("窗格")] },
    ],
  };
  remarkGlossary({ terms: [PANE] })(tree, { path: "a.mdx" });
  let found = 0;
  const count = (node: TreeNode): void => {
    if (node.type === "mdxJsxTextElement") found += 1;
    for (const kid of node.children ?? []) count(kid);
  };
  count(tree);
  assert.equal(found, 0);
});

test("skipFile 命中的文件整篇不标——术语页自己走这条", () => {
  const tree: TreeNode = { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: "窗格" }] }] };
  remarkGlossary({ terms: [PANE], skipFile: (p) => p.endsWith("glossary.mdx") })(tree, { path: "x/glossary.mdx" });
  assert.equal(tree.children?.[0]?.children?.[0]?.type, "text");
});

test("已经是 Term 的地方不往里再嵌一层", () => {
  const tree: TreeNode = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [{ type: "mdxJsxTextElement", name: "Term", attributes: [], children: [{ type: "text", value: "窗格" }] }],
      },
    ],
  };
  remarkGlossary({ terms: [PANE] })(tree, { path: "a.mdx" });
  const inner = tree.children?.[0]?.children?.[0]?.children ?? [];
  assert.equal(inner.length, 1);
  assert.equal(inner[0]?.type, "text");
});
