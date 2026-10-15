/**
 * 页面那一侧：code-pin 功能的 remark 插件把每处钉码换成带状态的钉码外框，页面里用到的组件都有来处。
 * 不启动站点：用 @mdx-js/mdx 编译现状区的每一篇，插件与站点构建时同一个（code-pin 的 ./site），钉码核心与命令行 docfirst 装配的是同一个，
 * 编译时取下插件前后的语法树来核对。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import { remarkCodePin } from "@godcreator/code-pin/site";
import { assembleProject, loadConfig } from "@godcreator/docfirst";
import { mdxComponents } from "../app/lib/mdx-components.tsx";

const project = assembleProject(process.cwd(), await loadConfig(process.cwd()));
/** 现状区里的 mdx 页面；讲解组件的源码也在现状区，但不是页面，由最后一条测试单独看 */
const DOCS = project.docs.filter((doc) => doc.endsWith(".mdx"));
const COMPONENT_FILES = project.docs.filter((doc) => !doc.endsWith(".mdx"));
/** 不用 import 就能写的组件：站点 MDX 组件表里的（fumadocs 默认的、平台的 Term 与文件树、各功能的） */
const SITE_COMPONENTS = new Set(Object.keys(mdxComponents));

/** 深度优先列出树上的节点 */
function nodesOf(tree) {
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return nodes;
}

/** 编译一篇：作者写下的树（插件之前）与站点构建页面时的树（钉码插件之后） */
async function treesOf(doc) {
  const trees = {};
  const capture = (key) => () => (tree) => {
    trees[key] = structuredClone(tree);
  };
  const codePin = () => remarkCodePin({ pinner: project.pins.pinner });
  await compile({ value: project.read(doc), path: join(project.root, doc) }, { remarkPlugins: [remarkMath, capture("written"), codePin, capture("built")] });
  return trees;
}

const pages = new Map();
for (const doc of DOCS) pages.set(doc, { ...(await treesOf(doc)), listing: project.pins.check(doc) });

/** 一篇文档对钉源码的态度：frontmatter 里 `docfirst: none`（导读页，明说不钉）或 `docfirst: draft`（还没写）；没写就是「必须钉」 */
const stanceOf = (doc) => /^docfirst:\s*(none|draft)\s*$/m.exec(project.read(doc).split("---")[1] ?? "")?.[1];

test("站里得有文档；每篇要么钉了源码，要么 frontmatter 明说 docfirst: none 或 draft", () => {
  assert.ok(DOCS.length >= 3, `至少三篇，实际 ${DOCS.length}`);
  for (const [doc, page] of pages) {
    const stance = stanceOf(doc);
    if (stance === "draft") continue;
    if (stance === "none") {
      assert.equal(page.listing.checks.length, 0, `${doc} 说自己不钉源码，却有钉码`);
      continue;
    }
    assert.ok(page.listing.checks.length > 0, `${doc} 一处钉码都没有：钉源码，或在 frontmatter 写 docfirst: none / draft`);
  }
});

test("每处钉码换成一个钉码外框：外框的状态跟核对结果一致、顺序一致", () => {
  for (const [doc, page] of pages) {
    const frames = nodesOf(page.built).filter((node) => node.type === "codePin");
    assert.deepEqual(
      frames.map((frame) => frame.data?.hProperties?.dataPinStatus),
      page.listing.checks.map((check) => check.status),
      `${doc}：钉码外框要跟核对清单一一对应`,
    );
  }
});

/** 页面开头 import 进来的名字 */
function importedNames(tree) {
  return new Set(
    nodesOf(tree)
      .filter((node) => node.type === "mdxjsEsm")
      .flatMap((node) => node.data.estree.body.filter((statement) => statement.type === "ImportDeclaration"))
      .flatMap((statement) => statement.specifiers.map((specifier) => specifier.local.name)),
  );
}

test("页面里写的组件都有来处：站内组件在页面开头 import，其余在站点的 MDX 组件表里", () => {
  const missing = [];
  for (const [doc, page] of pages) {
    const imported = importedNames(page.written);
    for (const node of nodesOf(page.written)) {
      if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") continue;
      const name = node.name ?? "";
      if (!/^[A-Z]/.test(name) || imported.has(name) || SITE_COMPONENTS.has(name)) continue;
      missing.push(`${doc}：<${name}>`);
    }
  }
  assert.deepEqual(missing, [], "这些组件既没 import，站点的组件表里也没有，页面渲染时会报组件未定义");
});

test("这个站自己的文档全是绿的：写下的钉码跟源码没脱节", () => {
  for (const [doc, page] of pages) {
    assert.deepEqual(
      page.listing.checks.map((check) => check.status),
      page.listing.checks.map(() => "fresh"),
      `${doc} 有钉码不是新鲜的——运行 pnpm doc 看看`,
    );
  }
});

test("讲解组件的源码也进现状区，里面写的钉码全是绿的", () => {
  assert.ok(COMPONENT_FILES.every((file) => file.startsWith("content/") || file.startsWith("app/components/")), `现状区里有 content/ 与 app/components/ 之外的代码文件：${COMPONENT_FILES.join("、")}`);
  for (const file of COMPONENT_FILES) {
    const { checks } = project.pins.check(file);
    assert.deepEqual(checks.map((check) => check.status), checks.map(() => "fresh"), `${file} 有钉码不是新鲜的——运行 pnpm doc 看看`);
  }
});
