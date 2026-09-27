/**
 * StarDisk 客户端组件的壳结构测试：`react-dom/server` 把它渲成静态 html。
 * 壳只当编排者——画布层（六层 SVG）由 canvas/stage.ts 在挂载后建，静态渲染那一趟画布区是空 div；
 * 断言的是壳该有的东西：吃满父元素的容器、画布容器、日期轨容器、工具条（三态 home 钮），
 * 以及空盘提示。data 用工作区自带的诗名 fixture 建（tests/fixtures/trajectory）。
 *
 * 另一条守鱼眼真接上了引擎：帧推进 RingsLayout.step 不碰 DOM，喂 fixture 建的 RingsLayout
 * 就能单测——补间只要没把 focusDay / strength 写回 layout，displayRadius 与 mag 读到的
 * 永远是线性态，盘看着一动不动、却零报错。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildModel, buildTrajectory, RingsLayout, scanCards } from "@godcreator/docfirst-trajectory";
import { StarDisk } from "@godcreator/docfirst-trajectory/disk";
import { scanCardDir } from "@godcreator/docfirst-workflow";
import { renderCard, root } from "./trajectory-helpers.ts";

test("StarDisk：壳结构齐——吃满父元素的容器、盘区、画布空 div、日期轨容器、工具条与三态 home 钮，侧栏初始关着", async () => {
  const data = buildTrajectory(await scanCardDir("tests/fixtures/trajectory"));
  assert.equal(data.model.root?.id, "tfix-测试项目根卡", "fixture 里唯一那张根卡认主");

  const html = renderToStaticMarkup(createElement(StarDisk, { data, hrefBase: "/trajectory", bodies: {} }));

  assert.match(
    html,
    /^<div class="star-disk" style="position:relative;width:100%;height:100%;overflow:hidden;display:flex"><div class="star-main">/,
    "容器吃满父元素，盘区在里面横排（侧栏打开时排在它右边）",
  );
  assert.doesNotMatch(html, /class="star-side"/, "没点卡时侧栏不在");
  assert.match(html, /<div class="star-canvas" aria-label="测试项目"><\/div>/, "画布区是空 div，svg 由画布层挂载后建");
  assert.doesNotMatch(html, /<svg[^>]*class="star-svg"/, "静态渲染那一趟不该有画布 svg");
  assert.match(html, /class="star-rail"/, "日期轨容器在");
  assert.match(html, /class="star-hud-top"/, "工具条在");
  for (const title of ["搜索卡片（label 与卡身份）", "图例与筛选", "设置", "帮助"]) {
    assert.ok(html.includes(`title="${title}"`), `工具条得有「${title}」钮`);
  }
  assert.match(html, /class="star-mbtn star-home star-idle" data-home="idle" title="已在原点"/, "home 钮初态是 idle");
  assert.doesNotMatch(html, /class="star-empty"/, "有卡的盘没有空盘提示");
});

test("StarDisk：没有上盘卡时照旧显示「这张盘还没有记录」", () => {
  const data = buildTrajectory(scanCards([{ name: "pj01.md", text: renderCard(root("pj01", "2026-01-01T08:00")), mtime: 0 }]));
  assert.equal(data.model.cards.length, 0);
  const html = renderToStaticMarkup(createElement(StarDisk, { data, hrefBase: "/trajectory", bodies: {} }));
  assert.match(html, /<div class="star-empty">这张盘还没有记录<\/div>/);
});

test("step：focusOn 后推帧，强度趋近 1、显示半径真被鱼眼改写", async () => {
  const cards = (await scanCardDir("tests/fixtures/trajectory")).cards;
  const m = buildModel(cards);
  const layout = new RingsLayout(m);

  // 取最内那张卡（离焦点带最远、进压缩区最深，形变最确定）当样本
  const radii = [...layout.places.values()].map((p) => p.rLin);
  assert.ok(radii.length > 0, "fixture 得摆得出卡");
  const rLin = Math.min(...radii);
  // 全景基线：strength 恒 0 时 displayRadius 就是线性半径
  assert.equal(layout.strength, 0);
  assert.equal(layout.displayRadius(rLin), rLin);

  layout.focusOn(m.dayMax, true);
  assert.equal(layout.strengthTarget, 1);
  let live = true;
  for (let i = 0; i < 200 && live; i++) live = layout.step(0.16);

  assert.equal(live, false, "补间该收敛，200 帧内停下来");
  assert.equal(layout.strength, 1, "强度该到位");
  assert.equal(layout.focusDay, m.dayMax, "焦点日该钉在最新");
  assert.notEqual(layout.displayRadius(rLin), rLin, "鱼眼态的显示半径不该还等于线性半径");
  assert.notEqual(layout.mag(rLin), 1, "局部放大率也该离开 1");

  // 退回全景：强度回 0，显示半径复原
  layout.unfocus();
  live = true;
  for (let i = 0; i < 200 && live; i++) live = layout.step(0.16);
  assert.equal(layout.strength, 0);
  assert.equal(layout.displayRadius(rLin), rLin, "退回全景该逐位复原线性半径");
});
