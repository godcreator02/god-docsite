/**
 * 页面那一侧：功能包 @godcreator/docfirst-site 的 remark 插件把每条引用投影成带状态点的元素，页面里用到的组件都有来处。
 * 不启动站点：用 @mdx-js/mdx 编译现状区的每一篇，remark 插件就是站点构建页面时用的那一份（功能包的 ./content 出口），
 * 编译时取下插件前后的语法树来核对。状态与命令行算的是同一个钉码编排（project.pinning），这里只看投影对不对得上清单。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import content from "@godcreator/docfirst-site/content";
import { loadProject } from "@godcreator/docfirst-workflow";
import { DOT_COLOR, whereOf } from "@godcreator/docfirst-workflow/fumadocs";

const project = await loadProject(process.cwd());
/** 现状区里的 mdx 页面；讲解组件的源码也在现状区，但不是页面，由最后一条测试单独看 */
const DOCS = project.docs().filter((doc) => doc.endsWith(".mdx"));
const COMPONENT_FILES = project.docs().filter((doc) => !doc.endsWith(".mdx"));
/** 功能包的 mdxComponents：页面里不用 import 就能写 */
const FEATURE_COMPONENTS = new Set(["Term", "Files", "Folder", "File"]);

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

const attributeOf = (node, name) => node.attributes?.find((attribute) => attribute.name === name)?.value;

/** 编译一篇：作者写下的树（插件之前）与站点构建页面时的树（功能包的插件之后） */
async function treesOf(doc) {
  const trees = {};
  const capture = (key) => () => (tree) => {
    trees[key] = structuredClone(tree);
  };
  await compile({ value: project.read(doc), path: join(project.root, doc) }, { remarkPlugins: [capture("written"), ...content.remarkPlugins, capture("built")] });
  return trees;
}

const pages = new Map();
for (const doc of DOCS) pages.set(doc, { ...(await treesOf(doc)), listing: project.pinning.checkDoc(doc, project.read(doc)) });

/** 一篇文档对钉源码的态度：frontmatter 里 `docfirst: none`（导读页，明说不钉）或 `docfirst: draft`（还没写）；没写就是「必须钉」 */
const stanceOf = (doc) => /^docfirst:\s*(none|draft)\s*$/m.exec(project.read(doc).split("---")[1] ?? "")?.[1];

test("站里得有文档；每篇要么钉了源码，要么 frontmatter 明说 docfirst: none 或 draft", () => {
  assert.ok(DOCS.length >= 3, `至少三篇，实际 ${DOCS.length}`);
  const drafts = [];
  for (const [doc, page] of pages) {
    const stance = stanceOf(doc);
    if (stance === "draft") {
      drafts.push(doc);
      continue;
    }
    if (stance === "none") {
      assert.equal(page.listing.items.length, 0, `${doc} 说自己不钉源码，却有引用`);
      continue;
    }
    assert.ok(page.listing.items.length > 0, `${doc} 一处引用都没有：钉源码，或在 frontmatter 写 docfirst: none / draft`);
  }
  if (drafts.length > 0) console.log(`还没写的章（docfirst: draft）：${drafts.join("、")}`);
});

test("每条引用投影成一个带状态点颜色的元素：代码块包在 docfirst-pin 里、标题写着来源；目录树是 Files 容器、根文件夹叫来源", () => {
  for (const [doc, page] of pages) {
    const marks = nodesOf(page.built).flatMap((node) => {
      if (node.type === "mdxJsxFlowElement" && attributeOf(node, "className") === "docfirst-pin") {
        return [{ kind: "code", dot: attributeOf(node, "data-dot"), meta: node.children[0]?.meta ?? "" }];
      }
      if (node.type === "mdxJsxFlowElement" && node.name === "Files" && attributeOf(node, "data-docfirst") === "tree") {
        return [{ kind: "tree", dot: attributeOf(node, "data-dot"), root: attributeOf(node.children[0], "name") }];
      }
      return [];
    });
    assert.equal(marks.length, page.listing.items.length, `${doc}：带状态点的元素要跟清单一样多`);
    page.listing.items.forEach((item, index) => {
      const mark = marks[index];
      assert.equal(mark.dot, DOT_COLOR[item.status], `${doc} 第 ${index + 1} 个状态点的颜色`);
      const where = whereOf(item);
      if (item.reference.target.kind === "tree") {
        assert.equal(mark.kind, "tree", `${doc} 第 ${index + 1} 处是目录树，该是 Files 容器`);
        assert.equal(mark.root, where, `${doc} 第 ${index + 1} 处的根文件夹要叫来源`);
      } else {
        // 标题写在代码块的 meta 里，放不下双引号，换成了单引号
        const title = /\btitle="([^"]*)"/.exec(mark.meta)?.[1] ?? "";
        assert.ok(title.includes(where.replace(/"/g, "'")), `${doc} 第 ${index + 1} 块的标题要写来源，实际 meta 是 ${mark.meta}`);
      }
    });
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

test("页面里写的组件都有来处：站内组件在页面开头 import，Term 与文件树由功能包提供", () => {
  const missing = [];
  for (const [doc, page] of pages) {
    const imported = importedNames(page.written);
    for (const node of nodesOf(page.written)) {
      if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") continue;
      const name = node.name ?? "";
      if (!/^[A-Z]/.test(name) || imported.has(name) || FEATURE_COMPONENTS.has(name)) continue;
      missing.push(`${doc}：<${name}>`);
    }
  }
  assert.deepEqual(missing, [], "这些组件既没 import，功能包也不提供，页面渲染时会报组件未定义");
});

test("这个站自己的文档全是绿的：写下的引用跟源码没脱节", () => {
  for (const [doc, page] of pages) {
    assert.deepEqual(
      page.listing.items.map((i) => i.status),
      page.listing.items.map(() => "fresh"),
      `${doc} 有引用不是新鲜的——运行 pnpm docfirst check 看看`,
    );
  }
});

test("讲解组件的源码也进现状区，里面写的引用全是绿的", () => {
  assert.ok(COMPONENT_FILES.every((file) => file.startsWith("src/components/")), `现状区里有 src/components/ 之外的代码文件：${COMPONENT_FILES.join("、")}`);
  for (const file of COMPONENT_FILES) {
    const { items } = project.pinning.checkDoc(file, project.read(file));
    assert.deepEqual(items.map((i) => i.status), items.map(() => "fresh"), `${file} 有引用不是新鲜的——运行 pnpm docfirst check 看看`);
  }
});
