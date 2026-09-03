/**
 * 外部消费方那头的账：包是 link 进来的构建产物，接线只有 source.config.ts 那两处，
 * 站照样能出带状态点的代码块和压平过的 AI md。
 * 不起 Next：register 把 fumadocs 的 loader 挂进 Node，import 一篇 .mdx 走的就是站构建那条链。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "fumadocs-mdx/node";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProject } from "@god-live-doc/project";
import { DOT_COLOR, whereOf } from "@god-live-doc/format-fumadocs";
import { componentNames } from "../src/components/registry.ts";

register();

const DOC = "content/docs/index.mdx";
const mod = await import(`../${DOC}?collection=docs`);
const project = await loadProject(process.cwd());
const listing = project.service.resolve(DOC, project.read(DOC));
const components = Object.fromEntries(
  componentNames.map((name) => [name, (props) => createElement("div", { "data-component": name }, props.children)]),
);
const html = renderToStaticMarkup(createElement(mod.default, { components }));

test("引用全绿：这个站写下的引用跟它自己的源码没脱节", () => {
  assert.ok(listing.items.length > 0);
  assert.deepEqual(listing.items.map((i) => i.status), listing.items.map(() => "fresh"));
  assert.equal(listing.orphans.length, 0);
});

test("每条引用在页面上都有一个 pre，带着状态点的颜色和写着来源的标题", () => {
  const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
  const pres = [...html.matchAll(/<pre\b[^>]*\bdata-dot="[^"]*"[^>]*>/g)].map(([tag]) => ({
    dot: attr(tag, "data-dot"),
    title: attr(tag, "title"),
  }));
  assert.equal(pres.length, listing.items.length);
  listing.items.forEach((item, i) => {
    assert.equal(pres[i].dot, DOT_COLOR[item.status]);
    assert.ok(pres[i].title?.includes(whereOf(item)));
  });
});

test("站里自己的组件由 React 表画；AI 那份里被名册压平", () => {
  for (const name of componentNames) assert.doesNotMatch(html, new RegExp(`<${name}[\\s>]`), `<${name}> 漏成了裸标签`);
  assert.match(html, /data-component="Tab"/);
  assert.equal(typeof mod._markdown, "string", "postprocess.includeProcessedMarkdown 没开");
  assert.doesNotMatch(mod._markdown, /<Tabs|<Note|<Tab[\s>]/);
  assert.match(mod._markdown, /### pnpm/, "Tab 压平成三级标题");
  // 方括号是 fumadocs 序列化时按 markdown 规矩转义的
  assert.match(mod._markdown, /> \\?\[note\] /, "块级 Note 压平成引用块");
  assert.match(mod._markdown, /<!-- 来源 src\/greet\.ts:2-3 · 新鲜 -->/);
});

test("名册规则可搬：这份规则文件跟 god-live-doc 自己那个站里的逐字节相同", () => {
  const mine = readFileSync("src/components/tabs/tabs.ai.mjs", "utf8");
  const theirs = readFileSync("../../god-live-doc/docs-site/src/components/tabs/tabs.ai.mjs", "utf8");
  assert.equal(mine, theirs, "规则只用 helpers、不碰节点字段，换个项目不该要改");
});
