/**
 * 页面那一侧的接入：remark 插件确实加上了、meta 白名单确实放行了、状态确实写到了 <pre> 上、
 * postprocess 确实带着我们的回调。
 * 不启动 Next：fumadocs-mdx/node 的 register 把它的 loader 注册进 Node，import 一篇 .mdx 走的就是站构建时的同一条处理链。
 * 只断言、不跟命令行比：算状态的是同一个钉码编排（project.pinning），比出来只能相等；跨调用方的比对要启动站后抓取 .md 路由。
 * 组件表按 registry.ts 的名单生成占位 div：只为让渲染不缺组件，不管外观。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "fumadocs-mdx/node";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProject } from "@godcreator/docfirst-workflow";
import { DOT_COLOR, whereOf } from "@godcreator/docfirst-workflow/fumadocs";
import { componentNames } from "../src/components/registry.ts";

register();

const project = await loadProject(process.cwd());
/** 现状区里的 mdx 页面；讲解组件的源码也在现状区，但不是页面，由最后一条测试单独看 */
const DOCS = project.docs().filter((doc) => doc.endsWith(".mdx"));
const COMPONENT_FILES = project.docs().filter((doc) => !doc.endsWith(".mdx"));
/** 占位组件：带上 data- 属性（目录树的状态点属性加在 Files 容器上）和 name（文件夹 / 文件名），别的不管长相 */
const components = Object.fromEntries(
  componentNames.map((name) => [
    name,
    (props) =>
      createElement(
        "div",
        { "data-component": name, ...Object.fromEntries(Object.entries(props).filter(([key]) => key.startsWith("data-"))) },
        props.name,
        props.children,
      ),
  ]),
);

/** 一篇文档：编译产物 + 页面 html + 命令行那边算出来的清单 */
async function pageOf(doc) {
  // ?macro_id= 告诉 loader 这篇属于哪个集合（写集合的文件 + 变量名）——集合的 mdxOptions 与
  // postprocess（processed markdown）才会用上。进 check 的只有现状区，本站的现状区只有 content/docs 一个集合
  const mod = await import(`../${doc}?macro_id=src/lib/source.ts%23docs`);
  return {
    mod,
    html: renderToStaticMarkup(createElement(mod.default, { components })),
    listing: project.pinning.checkDoc(doc, project.read(doc)),
  };
}

const pages = new Map();
for (const doc of DOCS) pages.set(doc, await pageOf(doc));

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

test("每条引用在页面上都有一个带状态点颜色的元素：代码块和芯片是 pre、写着来源的标题；目录树是 Files 容器、根文件夹叫来源", () => {
  // 这里没用站的 pre 组件（Node 不能直接加载 tsx），验的是 rehypeCode 按白名单放到 pre 上的属性和注入到 Files 上的属性；
  // 状态点本身由 next build 生成
  // 静态 html 里属性值的引号与 & 是转义过的，还原之后才能跟来源原文比
  const unescape = (value) =>
    value?.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const attr = (tag, name) => unescape(new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]);
  for (const [doc, page] of pages) {
    const marks = [...page.html.matchAll(/<(pre|div)\b[^>]*\bdata-dot="[^"]*"[^>]*>/g)].map(([tag, kind]) => ({
      kind,
      dot: attr(tag, "data-dot"),
      title: attr(tag, "title"),
    }));
    assert.equal(marks.length, page.listing.items.length, `${doc}：带状态点的元素要跟清单一样多`);
    page.listing.items.forEach((item, i) => {
      assert.equal(marks[i].dot, DOT_COLOR[item.status], `${doc} 第 ${i + 1} 个状态点的颜色`);
      const where = whereOf(item);
      if (item.reference.target.kind === "tree") {
        assert.equal(marks[i].kind, "div", `${doc} 第 ${i + 1} 处是目录树，该是 Files 容器`);
        assert.ok(page.html.includes(`>${where}<`), `${doc} 第 ${i + 1} 处的根文件夹要叫 ${where}`);
      } else {
        // 标题写在代码块的 meta 串里，放不下双引号，站上换成了单引号
        assert.ok(marks[i].title?.includes(where.replace(/"/g, "'")), `${doc} 第 ${i + 1} 块的标题要写来源，实际是 ${marks[i].title}`);
      }
    });
  }
});

test("组件由 React 表画，没有裸 JSX 漏到页面", () => {
  for (const [doc, page] of pages) {
    for (const name of componentNames) {
      assert.doesNotMatch(page.html, new RegExp(`<${name}[\\s>]`), `${doc}：<${name}> 漏成了裸标签`);
    }
    // 正文里反引号包着的 `<Files>` 是在讲它，不算；带属性的真标签才是没转成机读文字
    assert.doesNotMatch(page.mod._markdown, /<Files className=|<Folder name=|<File name=/, `${doc}：文件树没转成机读文字`);
  }
  const all = [...pages.values()].map((p) => p.html).join("");
  assert.match(all, /data-component="Note"/);
  assert.match(all, /data-component="Tab"/);
});

test("模块带着 _markdown，且是我们的回调出的：来源行在、组件已转成机读文字", () => {
  for (const [doc, page] of pages) {
    assert.equal(typeof page.mod._markdown, "string", `${doc}：postprocess.includeProcessedMarkdown 没开`);
    for (const item of page.listing.items) {
      const where = whereOf(item);
      assert.ok(page.mod._markdown.includes(`<!-- 来源 ${where} · `), `${doc}：来源行不在，说明序列化回调没注册上`);
    }
    assert.doesNotMatch(page.mod._markdown, /<Tabs|<Note|<Tab[\s>]/, `${doc}：组件没按名册转成机读文字`);
    assert.doesNotMatch(page.mod._markdown, /\[!code /, `${doc}：机读版不该带 shiki 的 diff 标记`);
  }
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
