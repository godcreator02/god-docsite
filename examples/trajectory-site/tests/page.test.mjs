/**
 * 卡集合渲染测试：register() 把 fumadocs-mdx 的 loader 挂进 Node，import 一张卡
 * （?collection=trajectory）走的就是站构建那条链——remarkTrajectoryLinks 挂在
 * source.config.ts 里 trajectory 集合自己的 mdxOptions 上，这里验它真的跑了：
 * 关系边段落变成 trajectory-edge 的 div，`.md` 链接改写成卡页路由。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "fumadocs-mdx/node";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

register();

test("关系边段落渲成 trajectory-edge 的 div，data-kind 认得出取代", async () => {
  const mod = await import("../cards/tc02-清明时节雨纷纷，路上行人欲断魂.md?collection=trajectory");
  const html = renderToStaticMarkup(createElement(mod.default, { components: {} }));
  assert.match(html, /class="trajectory-edge" data-kind="supersede"/);
});

test(".md 链接改写成卡页路由（/trajectory/<卡身份>），行内链接也不例外；引材料的原样留着", async () => {
  const mod = await import("../cards/re01-春眠不觉晓，处处闻啼鸟.md?collection=trajectory");
  const html = renderToStaticMarkup(createElement(mod.default, { components: {} }));
  // 序列化成 html 时非 ASCII 字符会被转成百分号编码，用同一个 encodeURIComponent 还原比对
  const want = `/trajectory/${encodeURIComponent("re02-白日依山尽，黄河入海流")}`;
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(hrefs.filter((h) => h === want).length, 2, "两处引用同一张卡的链接都要改写到位");
  // 引材料那条带路径（../assets/…），没有卡身份语义——改写成 /trajectory/../… 就是死链，
  // remarkTrajectoryLinks 只改主干像卡身份的那些，这条得原样留着交给站自己解析
  assert.ok(
    hrefs.includes("../assets/re01-probe/README.md"),
    "引材料的 .md 链接不该被改写成卡页路由",
  );
  assert.ok(
    hrefs.every((h) => !h.startsWith("/trajectory/..")),
    "卡页路由前缀底下不该冒出 .. 这种越界路径",
  );
});
