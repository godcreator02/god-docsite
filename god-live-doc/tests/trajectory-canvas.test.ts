/**
 * 画布层纯函数部分的测试（画布层住 `./react` 入口那一侧，测试直读源码，Node 直跑 .ts）：
 *   theme：矿彩两套色板按出现序分配、未分道走中性灰不占色板；mix 两 hex 线性插值、非 hex 出 color-mix。
 *   node-dom：在立卡珠光渐变 + 底色描边、孤星不套外环、被取代小一号混灰、结论卡（主干末端在立）
 *          吃放大档、连线不带箭头。
 *   label-arbiter：12 点 / 6 点竖线 14px 贪心占位；节点标签按真实文本区间判定、悬停先占坑。
 *   date-rail：滚轮格数结算（余额累进、反向清账）；railTOf / dayAtT 正逆互逆、空窗折成折痕。
 *   star-thumb：喂 svg-doc 桩文档画 fixture 盘，节点数 = 上盘卡数、扇环框数 = 树数、
 *          边数 = 关系边数、不画里程碑与文字、没有箭头也没有任何交互属性；布局与大图同口径。
 * DOM 相关的元素用手写的最小桩（只实现仲裁真读写的 style / textContent），不引 DOM 库。
 */
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
/* 布局 / 模型也直读源码：画布层吃的是源码里的 RingsLayout 型，跟 dist 里那份是两个声明 */
import { BASE_RADIUS, HUB_RIM, RingsLayout } from "../packages/trajectory/src/layout.ts";
import { buildModel, NO_DOMAIN } from "../packages/trajectory/src/model.ts";
import { scanDir } from "../packages/trajectory/src/scan.ts";
import type { Card, RawCard, TrajectoryModel } from "../packages/trajectory/src/types.ts";
import { buildThemes, DEFAULT_RING_PALETTE, mix } from "../packages/trajectory/src/canvas/theme.ts";
import {
  buildFilter,
  buildNode,
  DefsFactory,
  isConclusion,
  type NodeEl,
  recolor,
  spineTipIds,
} from "../packages/trajectory/src/canvas/node-dom.ts";
import { LabelArbiter } from "../packages/trajectory/src/canvas/label-arbiter.ts";
import { consumeWheelNotches, dayAtT, railTOf } from "../packages/trajectory/src/canvas/date-rail.ts";
import { renderStarThumb, THUMB_PAD } from "../packages/trajectory/src/canvas/star-thumb.ts";
import { DEFAULT_SETTINGS } from "../packages/trajectory/src/canvas/settings.ts";
import { serializeSvg, SvgStubDocument, type SvgStubElement } from "../packages/trajectory/src/canvas/svg-doc.ts";

const FIXTURES = fileURLToPath(new URL("./fixtures/trajectory", import.meta.url));
const ROOT_ID = "tfix-测试项目根卡";
const WORM_ID = "wh01-虫洞子项目根卡";
const SVG_NS = "http://www.w3.org/2000/svg";

/* 节点工厂建的是游离 DOM，走全局 document——Node 里没有，喂个桩顶上 */
(globalThis as unknown as { document: SvgStubDocument }).document = new SvgStubDocument();

const fixtureCards: RawCard[] = (await scanDir(FIXTURES)).cards;
const m: TrajectoryModel = buildModel(fixtureCards, ROOT_ID);

/* ================= theme ================= */

test("buildThemes：矿彩两套按出现序循环分配，未分道走中性灰、不占色板位", () => {
  const t = buildThemes(["甲", "乙", NO_DOMAIN, "丙"]);
  assert.equal(t.dark.domain["甲"], "#6C9BD2", "石青");
  assert.equal(t.dark.domain["乙"], "#D08A5B", "赭石");
  assert.equal(t.dark.domain[NO_DOMAIN], t.dark.noDomain);
  assert.equal(t.dark.domain["丙"], "#8FBF8A", "哨兵压在中间也不占位，丙拿第三色松绿");
  assert.equal(t.light.domain["丙"], "#4F8A4A");
  /* 泥金：盘心描边与里程碑同色，亮色板压深一档 */
  assert.equal(t.dark.hubStroke, "#CBB27A");
  assert.equal(t.dark.milestone, t.dark.hubStroke);
  assert.equal(t.light.hubStroke, "#8A7238");
  assert.equal(t.light.milestone, t.light.hubStroke);
  /* 转向线铜绿；底色缝走宿主变量，亮暗共用一份 */
  assert.equal(t.dark.pivot, "#6FB8AE");
  assert.equal(t.light.pivot, "#2F8C82");
  assert.equal(t.dark.bg, "var(--color-fd-background)");
  assert.equal(t.light.bg, t.dark.bg);
  /* 每次调用出新副本：改一份不污染另一份 */
  const t2 = buildThemes(["甲"]);
  t2.dark.hubStroke = "#123456";
  assert.notEqual(buildThemes(["甲"]).dark.hubStroke, "#123456");
});

test("mix：两 hex 线性插值出 rgb()，任一边不是 hex 就出 color-mix()", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "rgb(128,128,128)");
  assert.equal(mix("#ff0000", "#0000ff", 0), "rgb(255,0,0)");
  assert.equal(mix("#ff0000", "#0000ff", 1), "rgb(0,0,255)");
  assert.equal(
    mix("var(--color-fd-primary)", "#000000", 0.35),
    "color-mix(in srgb, var(--color-fd-primary) 65.0%, #000000)",
  );
});

/* ================= node-dom：节点工厂与着色 ================= */

const THEME = buildThemes(["甲"]).dark;

/** 一张最小卡（工厂只读这几个字段）。 */
function fakeCard(id: string, domain = "甲"): Card {
  return { id, title: id, domain, bornAt: "2026-01-01T09:00", label: id, path: `${id}.md` };
}

/** 给一组节点刷一遍色：defs 挂在现建的桩 svg 上，一并交回好查渐变。 */
function paintNodes(nodes: NodeEl[]): SvgStubElement {
  const root = new SvgStubDocument().createElementNS(SVG_NS, "svg");
  const defs = new DefsFactory(root as unknown as Element);
  recolor(nodes, [], THEME, buildFilter(), () => true, defs);
  return root;
}

/** 桩元素视图：工厂返回的句柄名义上是 SVGElement，实际是桩。 */
const stub = (e: SVGElement | null): SvgStubElement => e as unknown as SvgStubElement;

test("buildNode：在立卡填珠光渐变、外圈底色描边，孤星不套外环", () => {
  const alive = buildNode(fakeCard("a"), "alive", false, false, null);
  const iso = buildNode(fakeCard("b"), "alive", true, false, null);
  const root = paintNodes([alive, iso]);
  const core = stub(alive.core);
  assert.match(core.getAttribute("fill") ?? "", /^url\(#mk-\d+-pl-\d+\)$/, "在立卡填渐变引用");
  assert.equal(core.getAttribute("stroke"), "var(--color-fd-background)", "外圈是底色缝");
  assert.equal(core.getAttribute("stroke-width"), "1.8");
  assert.equal(core.getAttribute("r"), String(BASE_RADIUS));
  /* 渐变真建在 defs 里：中心领域色向白混 22%、边缘本色 */
  const stops = root.query("stop");
  assert.equal(stops.length, 2, "一个领域色一支渐变，两个 stop");
  assert.equal(stops[0]?.getAttribute("stop-color"), mix("#6C9BD2", "#ffffff", 0.22));
  assert.equal(stops[1]?.getAttribute("stop-color"), "#6C9BD2");
  /* 孤星：跟普通在立卡一模一样，没有虚线外环 */
  assert.equal(iso.seam, null);
  assert.equal(
    stub(iso.group).children.filter((c) => c.getAttribute("stroke-dasharray")).length,
    0,
    "孤星外环已退役",
  );
  assert.equal(stub(iso.group).children.length, stub(alive.group).children.length);
});

test("buildNode：被取代实心无渐变、半径 0.7、领域色混灰 40%", () => {
  const sup = buildNode(fakeCard("c"), "superseded", false, false, null);
  paintNodes([sup]);
  const core = stub(sup.core);
  assert.equal(core.getAttribute("r"), String(BASE_RADIUS * 0.7));
  assert.equal(core.getAttribute("fill"), mix("#6C9BD2", THEME.deadMix, 0.4));
  assert.doesNotMatch(core.getAttribute("fill") ?? "", /url\(/, "被取代不吃渐变");
  assert.equal(core.getAttribute("stroke"), "var(--color-fd-background)");
  assert.equal(core.getAttribute("stroke-width"), "1.2", "缝也细一档");
});

test("结论卡放大档：判定 = 主干末端那张且在立，乘数走布局的 tierMult", () => {
  assert.equal(isConclusion("alive", true), true);
  assert.equal(isConclusion("alive", false), false, "不是主干末端就不放大");
  assert.equal(isConclusion("superseded", true), false, "末端被取代了也不放大");
  assert.equal(new RingsLayout(m).tierMult, 1.3);
  /* 主干末端集从模型的树里来，一树一张 */
  const tips = spineTipIds(m.trees);
  assert.ok(m.trees.length > 0);
  assert.equal(tips.size, m.trees.length);
  for (const t of m.trees) assert.ok(tips.has(t.spine.at(-1) as string));
});

test("快照是唯一的空心：底色缝垫在领域色边下面；缺省形态跟抉择同款实心", () => {
  const snap = buildNode(fakeCard("d"), "alive", false, false, "snapshot");
  const plain = buildNode(fakeCard("e"), "alive", false, false, null);
  paintNodes([snap, plain]);
  assert.ok(snap.hollow && snap.seam);
  assert.equal(stub(snap.core).getAttribute("fill"), "none");
  assert.equal(stub(snap.core).getAttribute("stroke"), "#6C9BD2");
  assert.equal(stub(snap.seam).getAttribute("stroke"), "var(--color-fd-background)");
  assert.ok(
    Math.abs(Number(stub(snap.seam).getAttribute("stroke-width")) - 3.4) < 1e-9,
    "缝宽 = 缝 1.8 + 边 1.6",
  );
  assert.equal(plain.hollow, false);
  assert.match(stub(plain.core).getAttribute("fill") ?? "", /^url\(#/);
});

/* ================= label-arbiter ================= */

/** 最小标签桩：仲裁只读 style.display / textContent，getComputedTextLength 缺席走字符估宽。 */
function stubLabel(text = "标签"): SVGElement {
  return { style: { display: "" }, textContent: text } as unknown as SVGElement;
}

test("LabelArbiter.arbitrate：同一条竖线上贪心占位，屏幕间距不足 14px 的后来者让隐", () => {
  const a = new LabelArbiter();
  const claims = [
    { r: 100, prio: 4, label: stubLabel() },
    { r: 105, prio: 3, label: stubLabel() },
    { r: 120, prio: 2, label: stubLabel() },
    { r: 128, prio: 1, label: stubLabel() },
  ];
  /* pxToWorld = 1：世界单位即像素 */
  a.arbitrate(claims, 1);
  assert.deepEqual(
    claims.map((c) => c.label.style.display),
    ["", "none", "", "none"],
    "100 占位后 105 让隐；120 离 100 够远占位，128 离 120 只差 8 让隐",
  );
  /* 缩放深一倍（pxToWorld = 0.5）：世界间距 8 = 屏幕 16px，够 14 了，128 也能显 */
  a.arbitrate(claims, 0.5);
  assert.deepEqual(claims.map((c) => c.label.style.display), ["", "none", "", ""]);
});

test("LabelArbiter.arbitrateNodeLabels：按真实文本区间判定，悬停先占坑，同行区间相交的让隐", () => {
  const a = new LabelArbiter();
  /* 全角四字 ≈ 42px 宽；middle 锚法区间 [x−21, x+21] */
  const first = { x: 0, y: 0, anchor: "middle", force: false, label: stubLabel("四个汉字") };
  const overlap = { x: 30, y: 5, anchor: "middle", force: false, label: stubLabel("四个汉字") };
  const apart = { x: 200, y: 0, anchor: "middle", force: false, label: stubLabel("四个汉字") };
  const otherRow = { x: 0, y: 40, anchor: "middle", force: false, label: stubLabel("四个汉字") };
  a.arbitrateNodeLabels([first, overlap, apart, otherRow]);
  assert.equal(first.label.style.display, "");
  assert.equal(overlap.label.style.display, "none", "同行区间相交、报名晚的让隐");
  assert.equal(apart.label.style.display, "", "横向拉开就不冲突");
  assert.equal(otherRow.label.style.display, "", "行距够 14px 就不冲突");

  /* 悬停强制：报名晚也先占坑，把先报名的挤掉 */
  const hovered = { ...overlap, force: true, label: stubLabel("四个汉字") };
  const plain = { ...first, label: stubLabel("四个汉字") };
  a.arbitrateNodeLabels([plain, hovered]);
  assert.equal(hovered.label.style.display, "");
  assert.equal(plain.label.style.display, "none");

  /* 锚法展开方向：start 从锚点向右、end 向左——两者不相交 */
  const left = { x: 100, y: 0, anchor: "end", force: false, label: stubLabel("四个汉字") };
  const right = { x: 100, y: 0, anchor: "start", force: false, label: stubLabel("四个汉字") };
  a.arbitrateNodeLabels([left, right]);
  assert.equal(left.label.style.display, "");
  assert.equal(right.label.style.display, "none", "end 区间 [58,100] 与 start 区间 [100,142] 只差 3px 松量之内，算相交");
});

/* ================= date-rail ================= */

test("consumeWheelNotches：余额累进每满 120 出一步，方向反转先清余额", () => {
  let r = consumeWheelNotches(0, 120);
  assert.deepEqual(r, { notches: 1, remainder: 0 });
  r = consumeWheelNotches(0, 50);
  assert.deepEqual(r, { notches: 0, remainder: 50 });
  r = consumeWheelNotches(r.remainder, 80);
  assert.deepEqual(r, { notches: 1, remainder: 10 }, "50 + 80 = 130：出一步、余 10");
  r = consumeWheelNotches(r.remainder, -130);
  assert.deepEqual(r, { notches: -1, remainder: -10 }, "反向：先清掉旧余额再算，-130 出一步、余 -10");
  r = consumeWheelNotches(0, 250);
  assert.deepEqual(r, { notches: 2, remainder: 10 });
});

test("railTOf / dayAtT：顶 = d0 归 0、底 = d1 归 1，正逆互逆，空窗中段只占折痕", () => {
  const L = new RingsLayout(m);
  const span = { d0: m.day0, d1: m.dayMax };
  assert.equal(railTOf(L, span, m.day0), 0);
  assert.equal(railTOf(L, span, m.dayMax), 1);
  assert.equal(dayAtT(L, span, 0), m.day0);
  assert.equal(dayAtT(L, span, 1), m.dayMax);
  /* 正逆互逆：密集区每一天来回都落回自己 */
  for (let d = m.day0; d <= m.dayMax; d += 3) {
    const t = railTOf(L, span, d);
    assert.ok(t >= 0 && t <= 1);
    if (!L.gapBands().some((b) => d > b.d0 && d < b.d1)) assert.equal(dayAtT(L, span, t), d);
  }
  /* 空窗中段在轨上折成窄条：折痕高远小于按日历线性该占的高 */
  const band = L.gapBands()[0];
  assert.ok(band, "fixture 得有空窗");
  const railH = railTOf(L, span, band!.d1) - railTOf(L, span, band!.d0);
  const linearH = (band!.d1 - band!.d0) / (m.dayMax - m.day0);
  assert.ok(railH < linearH * 0.5, `空窗 ${band!.days} 天在轨上占 ${railH}，线性该占 ${linearH}`);
  /* 单日盘：折算跨度为 0，正解恒 0、逆解恒 d0 */
  const oneDay = { d0: m.dayMax, d1: m.dayMax };
  assert.equal(railTOf(L, oneDay, m.dayMax), 0);
  assert.equal(dayAtT(L, oneDay, 0.7), m.dayMax);
});

/* ================= star-thumb ================= */

/** 用桩文档画一张定妆照，交回根元素与序列化 markup。 */
function paint(model: TrajectoryModel, settings = DEFAULT_SETTINGS): { svg: SvgStubElement; html: string } {
  const doc = new SvgStubDocument();
  const theme = buildThemes(model.domains).dark;
  const svg = renderStarThumb(model, theme, settings, DEFAULT_RING_PALETTE, doc) as unknown as SvgStubElement;
  return { svg, html: serializeSvg(svg) };
}

/** 定妆照里的边：path / line 里带 opacity 的那些（扇环框不带，环是 circle）。 */
function thumbEdges(svg: SvgStubElement): SvgStubElement[] {
  return [...svg.query("path"), ...svg.query("line")].filter((e) => e.getAttribute("opacity"));
}

test("star-thumb：节点数 = 上盘卡数、扇环框数 = 树数、边数 = 关系边数，不画文字与里程碑，没有交互属性", () => {
  const { svg, html } = paint(m);
  assert.ok(m.cards.length > 0 && m.edges.length > 0 && m.trees.length > 0);
  /* 节点 g：每卡一个 + 每虫洞一个（虫洞 g 排最末） */
  const gs = svg.query("g");
  assert.equal(gs.length, m.cards.length + m.wormholes.length);
  /* 扇环框：fill 走 --box-fill 变量的 path，一树一个 */
  const boxes = svg.query("path").filter((p) => p.getAttribute("fill") === "var(--box-fill)");
  assert.equal(boxes.length, m.trees.length);
  /* 边：一边一条，都不带箭头 */
  const edges = thumbEdges(svg);
  assert.equal(edges.length, m.edges.length);
  assert.doesNotMatch(html, /marker/i, "箭头 marker 整个退役");
  /* 取代边取旧卡领域色的实线、转向边铜绿点线 */
  const T0 = buildThemes(m.domains).dark;
  const pivots = edges.filter((e) => e.getAttribute("stroke") === T0.pivot);
  assert.equal(pivots.length, m.edges.filter((e) => e.kind === "pivot").length);
  for (const e of pivots) assert.ok(e.getAttribute("stroke-dasharray"));
  const supersede = edges.filter((e) => e.getAttribute("stroke") !== T0.pivot);
  assert.ok(supersede.length > 0);
  for (const e of supersede) assert.equal(e.getAttribute("stroke-dasharray"), null, "取代边是实线");
  const firstSup = m.edges.find((e) => e.kind === "supersede") as { from: string };
  const oldCard = m.byId[firstSup.from] as Card;
  assert.ok(
    supersede.some((e) => e.getAttribute("stroke") === (T0.domain[oldCard.domain] ?? T0.noDomain)),
    "取代边着旧卡的领域色",
  );
  /* 只画形状：一个字都不画，也不画里程碑（泥金细环）、不带任何交互属性 */
  assert.equal(svg.query("text").length, 0);
  assert.doesNotMatch(html, /<text/);
  assert.doesNotMatch(html, /\bon[a-z]+=|href=|cursor|tabindex/i);
  assert.match(html, /^<svg viewBox="-[\d.]+ -[\d.]+ [\d.]+ [\d.]+" class="trajectory-thumb">/);
  /* 虫洞双环：同一 g 里恰好两个根卡家族色的空心环 */
  const wormGs = gs.filter(
    (g) =>
      g.children.filter(
        (c) => c.tagName === "circle" && c.getAttribute("fill") === "none" && c.getAttribute("stroke") === T0.hubStroke,
      ).length === 2,
  );
  assert.equal(wormGs.length, m.wormholes.length);
});

test("star-thumb：节点实心 + 底色缝，被取代小一号、结论卡（主干末端在立）大一号", () => {
  const { svg } = paint(m);
  const ref = new RingsLayout(m);
  const base = Math.min(18, Math.max(4, (ref.maxR + THUMB_PAD) * 0.02));
  const tips = spineTipIds(m.trees);
  const gs = svg.query("g");
  const radiusOf = (i: number): number => Number(gs[i]?.children[0]?.getAttribute("r"));
  let bigs = 0;
  m.cards.forEach((c, i) => {
    const superseded = m.supersededIds.has(c.id);
    const tier = !superseded && tips.has(c.id) ? 1.3 : 1;
    if (tier > 1) bigs++;
    const want = (base * (superseded ? BASE_RADIUS * 0.7 : BASE_RADIUS) * tier) / BASE_RADIUS;
    assert.ok(Math.abs(radiusOf(i) - want) < 1e-9, `${c.id} 的节点半径该是 ${want}`);
    /* 实心 + 一圈底色缝，没有渐变 */
    assert.equal(gs[i]?.children[0]?.getAttribute("stroke"), "var(--color-fd-background)");
    assert.doesNotMatch(gs[i]?.children[0]?.getAttribute("fill") ?? "", /url\(/);
  });
  assert.ok(bigs > 0, "fixture 里得有在立的结论卡");
});

test("star-thumb：布局与大图同口径——节点角度 = 同模型同设置的 places，盘心 r = innerR − HUB_RIM", () => {
  const settings = { ...DEFAULT_SETTINGS, hubSize: 130, gapFree: 31 };
  const { svg } = paint(m, settings);
  const ref = new RingsLayout(m);
  ref.configure({ gapFree: settings.gapFree, gapWide: settings.gapWide, hubBase: settings.hubSize });
  const gs = svg.query("g");
  const angDiff = (a: number, b: number): number => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  m.cards.forEach((c, i) => {
    const tr = gs[i]!.getAttribute("transform") ?? "";
    const mm = /translate\((-?[\d.e+-]+),(-?[\d.e+-]+)\)/.exec(tr);
    assert.ok(mm, `第 ${i} 个节点得有 translate`);
    const ang = (Math.atan2(Number(mm![1]), -Number(mm![2])) * 180) / Math.PI;
    const pl = ref.places.get(c.id);
    assert.ok(pl);
    assert.ok(angDiff(ang, pl!.angBase + pl!.spreadOff) < 1e-9);
  });
  const T = buildThemes(m.domains).dark;
  const hub = svg.query("circle").filter((x) => x.getAttribute("fill") === T.hubFill);
  assert.equal(hub.length, 1);
  assert.ok(Math.abs(Number(hub[0]!.getAttribute("r")) - (ref.innerR - HUB_RIM)) < 1e-9);
  /* 根节点：家族色实心，半径 = nodeR × ROOT_RADIUS / BASE_RADIUS */
  const B = ref.maxR + THUMB_PAD;
  const nodeR = Math.min(18, Math.max(4, B * 0.02));
  const root = svg.query("circle").filter(
    (x) => x.getAttribute("fill") === T.hubStroke && Math.abs(Number(x.getAttribute("r")) - (nodeR * 10) / 6) < 1e-9,
  );
  assert.equal(root.length, 1);
});

test("star-thumb：空盘（虫洞子项目）也画得出——盘心在、没有节点与边", () => {
  const mw = buildModel(fixtureCards, WORM_ID);
  assert.equal(mw.cards.length, 0);
  const { svg, html } = paint(mw);
  assert.equal(svg.query("g").length, 0);
  assert.match(html, /<circle/, "盘心与环在");
  assert.doesNotMatch(html, /marker-end/);
});

test("star-thumb：手感设置灌进布局——同模型不同 gapFree，节点落点必变", () => {
  const a = paint(m, { ...DEFAULT_SETTINGS, gapFree: 14 }).svg.query("g").map((g) => g.getAttribute("transform")).join("|");
  const b = paint(m, { ...DEFAULT_SETTINGS, gapFree: 31 }).svg.query("g").map((g) => g.getAttribute("transform")).join("|");
  assert.notEqual(a, b);
});
