/**
 * StarDisk 客户端组件的壳结构测试：`react-dom/server` 把它渲成静态 html。
 * 壳只当编排者——画布层（六层 SVG）由 canvas/stage.ts 在挂载后建，静态渲染那一趟画布区是空 div；
 * 断言的是壳该有的东西：画布容器、竖轨容器、工具条（三态 home 钮）、无激活遮罩，
 * 以及整页 / 嵌入两种模式的差别。SVG 结构的断言在 trajectory-canvas.test.ts 的 star-thumb 那组。
 * data 用工作区自带的 107 张诗名 fixture 建（tests/fixtures/trajectory），`size` 给死一个数字。
 *
 * 另一条守鱼眼真接上了引擎：帧推进函数 advanceFrame 不碰 DOM，喂 fixture 建的 RingsLayout
 * 就能单测——补间只要没把 focusDay / strength 写回 layout，displayRadius 与 mag 读到的
 * 永远是线性态，盘看着一动不动、却零报错。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { advanceFrame, buildModel, buildTrajectory, RingsLayout, scanDir } from "@godcreator02/livedoc-trajectory";
import type { FrameState } from "@godcreator02/livedoc-trajectory";
import { StarDisk } from "@godcreator02/livedoc-trajectory/react";
import { launcherThumbs, renderThumb } from "@godcreator02/livedoc-trajectory/server";

const ROOT_ID = "tfix-测试项目根卡";

/** 帧态初值：全景、居中，无悬停、无视图补间。 */
function emptyFrame(): FrameState {
  return { view: { k: 1, tx: 0, ty: 0 }, vT: null, hv: new Map(), hover: null, raf: null };
}

test("StarDisk 整页模式：壳结构齐——画布空 div、竖轨容器、工具条与三态 home 钮，无激活遮罩", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  assert.ok(data.models[ROOT_ID], "fixture 里得有 tfix 这张盘");

  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", size: 800, mode: "page", initialDisk: ROOT_ID }),
  );

  assert.match(html, /class="star-disk star-disk-page star-active"/, "容器带整页模式的类，交互态恒真");
  assert.match(html, /<div class="star-canvas" data-disk="tfix-测试项目根卡"[^>]*><\/div>/, "画布区是空 div，svg 由画布层挂载后建");
  assert.doesNotMatch(html, /<svg[^>]*class="star-svg"/, "静态渲染那一趟不该有画布 svg");
  assert.match(html, /class="star-rail"/, "竖轨容器在");
  assert.match(html, /class="star-hud-top"/, "工具条在");
  for (const title of ["搜索卡片（label 与卡身份）", "图例与筛选", "设置", "帮助"]) {
    assert.ok(html.includes(`title="${title}"`), `工具条得有「${title}」钮`);
  }
  assert.match(html, /class="star-mbtn star-home star-idle" data-home="idle" title="已在原点"/, "home 钮初态是 idle");
  assert.doesNotMatch(html, /star-activate-overlay|star-activate-hint/, "整页模式没有激活遮罩也没有提示带");
  assert.doesNotMatch(html, /title="全屏"/, "全屏按钮已退役");
  assert.doesNotMatch(html, /class="star-tab/, "盘页签已退役");
});

test("StarDisk 嵌入模式：默认值不被整页那条分支带跑——提示带在、没有遮罩、方形容器", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  const embed = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", initialDisk: ROOT_ID }),
  );
  assert.match(embed, /class="star-disk"/, "嵌入模式的容器类");
  assert.match(embed, /class="star-activate-hint"/, "嵌入模式保留点击激活的提示带");
  assert.doesNotMatch(embed, /star-activate-overlay/, "不再整片遮罩");
  assert.match(embed, /aspect-ratio:1 \/ 1/, "嵌入是宽随父、高等于宽的方块");
});

test("StarDisk 启动器：?disk 缺失渲项目卡阵——每张盘一张卡、每张卡带服务端渲的静态 svg", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  assert.ok(data.disks.length >= 2, "fixture 有主盘与虫洞子项目两张盘");
  const thumbs = launcherThumbs(data);
  assert.deepEqual(Object.keys(thumbs).sort(), data.disks.map((d) => d.rootId).sort(), "每张盘一份缩略图");

  const html = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", mode: "page", thumbs }),
  );
  assert.match(html, /class="star-launcher"/, "没有当前盘就是启动器");
  assert.doesNotMatch(html, /class="star-canvas"/, "启动器里没有盘的画布");
  const cards = [...html.matchAll(/<button[^>]*class="star-launcher-card"/g)];
  assert.equal(cards.length, data.disks.length, "一张盘一张卡");
  const svgs = [...html.matchAll(/<svg viewBox="[^"]+" class="trajectory-thumb star-thumb-(dark|light)">/g)];
  assert.equal(svgs.length, data.disks.length * 2, "每张卡带亮暗各一份静态 svg");
  assert.match(html, /\d+ 卡<\/span> · <span class="star-launcher-seg">最近活动 \d{4}-\d{2}-\d{2}/, "卡下方是「n 卡 · 最近活动 <日期>」");
  /* 缩略图是静态 markup：盘心与虫洞走色板里的泥金，节点底色缝走宿主变量，没有交互属性 */
  const one = thumbs[ROOT_ID]!;
  assert.match(one.dark, /stroke="#CBB27A"/, "暗色板盘心描边是泥金");
  assert.match(one.light, /stroke="#8A7238"/, "亮色板泥金压深一档");
  assert.match(one.dark, /stroke="var\(--color-fd-background\)"/, "节点底色缝走宿主变量");
  assert.match(one.dark, /stroke="rgb\(132,116,79\)"/, "根节点描边由 mix 出 rgb()");
  assert.doesNotMatch(one.dark, /<text|onclick|href=|marker/i);
  assert.notEqual(one.dark, one.light, "亮暗两份色板不同");
  /* 认不出的 initialDisk 同样回启动器；不传 thumbs 也渲卡阵（缩略图挂载后客户端现画） */
  const unknown = renderToStaticMarkup(
    createElement(StarDisk, { data, hrefBase: "/trajectory", mode: "page", initialDisk: "没有这张盘" }),
  );
  assert.match(unknown, /class="star-launcher"/);
  assert.equal([...unknown.matchAll(/class="star-launcher-card"/g)].length, data.disks.length);
  assert.doesNotMatch(unknown, /<svg/, "没给 thumbs 时静态渲染没有 svg");
});

test("renderThumb：吃序列化模型也吃运行期模型，静态 svg 结构相同", async () => {
  const data = await buildTrajectory("tests/fixtures/trajectory");
  const serialized = data.models[ROOT_ID]!;
  const a = renderThumb(serialized, { theme: "dark" });
  const b = renderThumb({ ...serialized, supersededIds: new Set(serialized.supersededIds) }, { theme: "dark" });
  /* marker id 带工厂序号（每次现渲递增），抹掉再比 */
  const norm = (s: string): string => s.replace(/mk-\d+/g, "mk-N");
  assert.equal(norm(a), norm(b));
  assert.match(a, /^<svg viewBox=/);
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
