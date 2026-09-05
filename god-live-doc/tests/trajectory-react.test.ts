/**
 * StarDisk 客户端组件的结构测试：`react-dom/server` 把它渲成静态 html，断言 SVG 的
 * 骨架数量——节点的 `a[target=_blank]` 数、扇环框数、里程碑环数分别等于模型的卡数、树数、
 * 范围内里程碑数。data 用工作区自带的 107 张诗名 fixture 建（tests/fixtures/trajectory），
 * `size` 给死一个数字，绕开 ResizeObserver（SSR / 测试环境没有它）。
 *
 * 盘心状态行那条测的是它背后的纯函数 hubStatusLine：盘心文字整块由 rAF 里的 place() 逐帧写，
 * 静态渲染那一趟拿到的是个空 `<text>`，从 SVG 上断言不到。
 *
 * 另一条守鱼眼真接上了引擎：帧推进函数 advanceFrame 不碰 DOM，喂 fixture 建的 RingsLayout
 * 就能单测——补间只要没把 focusDay / strength 写回 layout，displayRadius 与 mag 读到的
 * 永远是线性态，盘看着一动不动、却零报错。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  advanceFrame,
  buildModel,
  buildTrajectory,
  formatDay,
  inRange,
  RingsLayout,
  scanDir,
} from "@godcreator02/live-doc-trajectory";
import type { FrameState } from "@godcreator02/live-doc-trajectory";
import { hubStatusLine, StarDisk } from "@godcreator02/live-doc-trajectory/react";

const ROOT_ID = "tfix-测试项目根卡";

/** 帧态初值：全景、居中，无悬停、无视图补间。 */
function emptyFrame(): FrameState {
  return { view: { k: 1, tx: 0, ty: 0 }, vT: null, hv: new Map(), hover: null, raf: null };
}

test("StarDisk：SVG 骨架数量对得上模型——节点链接数、扇环框数、里程碑环数", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  const model = data.models[ROOT_ID];
  assert.ok(model, "fixture 里得有 tfix 这张盘");
  const root = data.cards.find((c) => c.id === ROOT_ID);
  assert.ok(root?.milestones);

  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800 }),
  );

  assert.match(html, /<svg/, "得有 svg 画布");
  const links = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)];
  assert.equal(links.length, model!.cards.length, "节点链接数该等于上盘卡数（虫洞不算）");

  const boxes = [...html.matchAll(/class="star-treebox(?: star-isobox)?"/g)];
  // treebox 类同时覆盖树的扇环框与孤星/虫洞带（isobox 变体），只数不带 isobox 的那部分即树扇环
  const treeBoxes = boxes.filter((m) => !m[0].includes("star-isobox"));
  assert.equal(treeBoxes.length, model!.trees.length, "扇环框数该等于树数");

  const msRings = [...html.matchAll(/class="star-ring-milestone"/g)];
  const expectedMs = inRange(root!.milestones!, model!.day0, model!.dayMax).length;
  assert.equal(msRings.length, expectedMs, "里程碑环数该等于根卡范围内的里程碑数");
});

test("StarDisk mode=page：SVG 照常出，激活遮罩与全屏按钮都没有", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  const model = data.models[ROOT_ID];

  const page = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800, mode: "page" }),
  );
  assert.match(page, /<svg/, "整页模式照样出画布");
  assert.match(page, /class="star-disk star-disk-page"/, "容器带整页模式的类");
  const links = [...page.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)];
  assert.equal(links.length, model!.cards.length, "节点链接照旧");
  assert.doesNotMatch(page, /star-activate-overlay/, "整页模式没有激活遮罩，滚轮直接生效");
  assert.doesNotMatch(page, /title="全屏"/, "整页模式没有全屏按钮");

  // 嵌入模式两样都在：默认值没被整页那条分支带跑
  const embed = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800 }),
  );
  assert.match(embed, /star-activate-overlay/, "嵌入模式保留点击激活遮罩");
  assert.match(embed, /title="全屏"/, "嵌入模式保留全屏按钮");
});

test("盘心状态行：全景态是「起 → 止 · 模式名」，切模式换字样，空盘换成一句话", async () => {
  // 盘心文字整块由 rAF 里的 place() 逐帧写（React 不碰它没渲染过的子树），
  // 静态渲染那一趟拿到的是个空 <text>——所以这一条测的是它背后那个纯函数，不测 SVG
  const cards = (await scanDir("tests/fixtures/trajectory")).cards;
  const m = buildModel(cards, ROOT_ID);
  const line = hubStatusLine(m.day0, m.dayMax, "fisheye", false);
  assert.match(line, /→/, "起止之间得有箭头");
  assert.match(line, /鱼眼穿梭$/, "尾巴是当前模式名");
  assert.equal(line.startsWith(formatDay(m.day0)), true);
  assert.ok(line.includes(formatDay(m.dayMax)));
  assert.match(hubStatusLine(m.day0, m.dayMax, "zoom", false), /自由缩放$/, "切模式即见反馈");
  assert.equal(hubStatusLine(m.day0, m.dayMax, "fisheye", true), "还没有记录", "空盘不摆日期");
});

test("advanceFrame：focusOn 后推帧，强度趋近 1、显示半径真被鱼眼改写", async () => {
  const cards = (await scanDir("tests/fixtures/trajectory")).cards;
  const m = buildModel(cards, ROOT_ID);
  const layout = new RingsLayout(m);
  const fr = emptyFrame();

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
  for (let i = 0; i < 200 && live; i++) live = advanceFrame(layout, fr, 0.16);

  assert.equal(live, false, "补间该收敛，200 帧内停下来");
  assert.equal(layout.strength, 1, "强度该到位");
  assert.equal(layout.focusDay, m.dayMax, "焦点日该钉在最新");
  assert.notEqual(layout.displayRadius(rLin), rLin, "鱼眼态的显示半径不该还等于线性半径");
  assert.notEqual(layout.mag(rLin), 1, "局部放大率也该离开 1");

  // 退回全景：强度回 0，显示半径复原
  layout.unfocus();
  live = true;
  for (let i = 0; i < 200 && live; i++) live = advanceFrame(layout, fr, 0.16);
  assert.equal(layout.strength, 0);
  assert.equal(layout.displayRadius(rLin), rLin, "退回全景该逐位复原线性半径");
});
