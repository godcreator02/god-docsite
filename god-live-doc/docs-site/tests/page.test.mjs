/**
 * 页面那头的接线：插件确实挂上了、meta 白名单确实放行了、状态确实落到了 <pre> 上、
 * postprocess 确实带着我们的回调。
 * 不起 Next：fumadocs-mdx/node 的 register 把它的 loader 挂进 Node，import 一篇 .mdx 走的就是站构建那条链。
 * 只断言、不跟命令行比：算状态的是同一个 service，比出来只能相等；跨调用方的比对留给起站抓 .md 路由。
 * 组件表按 registry.ts 的名单造占位 div：只为让渲染不缺组件，不管长相。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "fumadocs-mdx/node";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProject } from "@god-live-doc/project";
import { DOT_COLOR, whereOf } from "@god-live-doc/format-fumadocs";
import { componentNames } from "../src/components/registry.ts";

register();

const project = await loadProject(process.cwd());
const DOCS = project.docs();
/** 占位组件：带上 data- 属性（目录树的状态点挂在 Files 容器上）和 name（文件夹 / 文件名），别的不管长相 */
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

/** 一篇文档：编译产物 + 页面 html + 命令行那头算出来的清单 */
async function pageOf(doc) {
  // ?collection= 告诉 loader 这篇属于哪个集合——集合的 postprocess（processed markdown）才会跑
  const mod = await import(`../${doc}?collection=docs`);
  return {
    mod,
    html: renderToStaticMarkup(createElement(mod.default, { components })),
    listing: project.service.resolve(doc, project.read(doc)),
  };
}

const pages = new Map();
for (const doc of DOCS) pages.set(doc, await pageOf(doc));

/** 一篇文档对钉源码的态度：frontmatter 里 `livedoc: none`（导读页，明说不钉）或 `livedoc: draft`（还没写）；没写就是「必须钉」 */
const stanceOf = (doc) => /^livedoc:\s*(none|draft)\s*$/m.exec(project.read(doc).split("---")[1] ?? "")?.[1];

test("站里得有文档；每篇要么钉了源码，要么 frontmatter 明说 livedoc: none 或 draft", () => {
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
    assert.ok(page.listing.items.length > 0, `${doc} 一处引用都没有：钉源码，或在 frontmatter 写 livedoc: none / draft`);
  }
  if (drafts.length > 0) console.log(`还没写的章（livedoc: draft）：${drafts.join("、")}`);
});

test("每条引用在页面上都有一个带状态点颜色的元素：代码块和芯片是 pre、写着来源的标题；目录树是 Files 容器、根文件夹叫来源", () => {
  // 这里没铺站的 pre 组件（tsx 进不了 Node），验的是 rehypeCode 按白名单放到 pre 上的属性和注入到 Files 上的属性；
  // 状态点本身由 next build 出
  const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
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
        assert.ok(marks[i].title?.includes(where), `${doc} 第 ${i + 1} 块的标题要写来源，实际是 ${marks[i].title}`);
      }
    });
  }
});

test("组件由 React 表画，没有裸 JSX 漏到页面", () => {
  for (const [doc, page] of pages) {
    for (const name of componentNames) {
      assert.doesNotMatch(page.html, new RegExp(`<${name}[\\s>]`), `${doc}：<${name}> 漏成了裸标签`);
    }
    // 正文里反引号包着的 `<Files>` 是在讲它，不算；带属性的真标签才是没压平
    assert.doesNotMatch(page.mod._markdown, /<Files className=|<Folder name=|<File name=/, `${doc}：文件树没被压平`);
  }
  const all = [...pages.values()].map((p) => p.html).join("");
  assert.match(all, /data-component="Note"/);
  assert.match(all, /data-component="Tab"/);
});

test("模块带着 _markdown，且是我们的回调出的：来源行在、组件被压平", () => {
  for (const [doc, page] of pages) {
    assert.equal(typeof page.mod._markdown, "string", `${doc}：postprocess.includeProcessedMarkdown 没开`);
    for (const item of page.listing.items) {
      const where = whereOf(item);
      assert.ok(page.mod._markdown.includes(`<!-- 来源 ${where} · `), `${doc}：来源行不在，说明序列化回调没挂上`);
    }
    assert.doesNotMatch(page.mod._markdown, /<Tabs|<Note|<Tab[\s>]/, `${doc}：组件没被名册压平`);
    assert.doesNotMatch(page.mod._markdown, /\[!code /, `${doc}：AI 那份不该带 shiki 的 diff 标记`);
  }
});

test("这个站自己的文档全是绿的：写下的引用跟源码没脱节", () => {
  for (const [doc, page] of pages) {
    assert.deepEqual(
      page.listing.items.map((i) => i.status),
      page.listing.items.map(() => "fresh"),
      `${doc} 有引用不是新鲜的——跑 pnpm livedoc check 看看`,
    );
    assert.equal(page.listing.orphans.length, 0, `${doc} 有孤儿记录`);
  }
});
