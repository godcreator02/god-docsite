/**
 * 画布层纯函数部分的测试（画布层住 `./disk` 入口那一侧，测试直接读源码，Node 直接运行 .ts）：
 *   theme：两套色板按出现序分配、未分道用中性灰不占色板；mix 对两个 hex 线性插值、非 hex 输出 color-mix。
 *   node-dom：所有卡一样大；实心平涂加细描边、在立卡外加一圈同色细环、最外一圈结论实线孤星虚线、
 *          被取代混灰没有环；连线与箭头同色（取代金黄、转向青）。
 *   label-arbiter：12 点竖线 14px 贪心占位；节点标签按真实文本区间判定、悬停的标签优先占位。
 *   date-rail：滚轮格数结算（不足一格的余量累加、换方向时先清零）；railTOf / dayAtT 正逆互逆、空窗折成折痕。
 * DOM 相关的元素用手写的最小桩（只实现仲裁真读写的 style / textContent），不引 DOM 库。
 */
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import assert from "node:assert/strict";
/* 布局 / 模型也直接读源码：画布层接收的是源码里的 RingsLayout 类型，跟 dist 里那份是两个声明 */
import { BASE_RADIUS, RingsLayout } from "../packages/trajectory-disk/src/layout.ts";
import { buildModel, NO_DOMAIN, spineTipIds } from "../packages/trajectory-disk/src/model/build.ts";
import { scanCardDir } from "../packages/docfirst-workflow/src/cards/card-dir.ts";
import type { Card, TrajectoryModel } from "../packages/trajectory-disk/src/model/types.ts";
import { buildThemes, mix } from "../packages/trajectory-disk/src/canvas/theme.ts";
import {
  buildFilter,
  buildNode,
  DefsFactory,
  type EdgeEl,
  isConclusion,
  type NodeEl,
  outerRingOf,
  recolor,
  supersededColor,
} from "../packages/trajectory-disk/src/canvas/node-dom.ts";
import { LabelArbiter } from "../packages/trajectory-disk/src/canvas/label-arbiter.ts";
import { consumeWheelNotches, dayAtT, railTOf } from "../packages/trajectory-disk/src/canvas/date-rail.ts";
import { SvgStubDocument, type SvgStubElement } from "./svg-stub.ts";

const FIXTURES = fileURLToPath(new URL("./fixtures/trajectory", import.meta.url));
const SVG_NS = "http://www.w3.org/2000/svg";

/* 节点工厂用全局 document 建还没挂进页面的 DOM 元素——Node 里没有 document，放一个桩代替 */
(globalThis as unknown as { document: SvgStubDocument }).document = new SvgStubDocument();

const m: TrajectoryModel = buildModel(await scanCardDir(FIXTURES));

/* ================= theme ================= */

test("buildThemes：两套按出现序循环分配，未分道走中性灰、不占色板位", () => {
  const t = buildThemes(["甲", "乙", NO_DOMAIN, "丙"]);
  assert.equal(t.dark.domain["甲"], "#5ea8ff");
  assert.equal(t.dark.domain["乙"], "#c78bfa");
  assert.equal(t.dark.domain[NO_DOMAIN], t.dark.noDomain);
  assert.equal(t.dark.domain["丙"], "#4ade9e", "哨兵压在中间也不占位，丙拿第三色");
  assert.equal(t.light.domain["丙"], "#0e9e63");
  /* 里程碑与取代边同一金黄，亮色板用深一档的颜色 */
  assert.equal(t.dark.milestone, t.dark.supersede);
  assert.equal(t.light.milestone, t.light.supersede);
  assert.notEqual(t.light.supersede, t.dark.supersede);
  /* 每次调用返回新副本：改一份不影响另一份 */
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
  return { id, domain, bornAt: "2026-01-01T09:00", label: id, kind: null };
}

/** 给一组节点重新着色一遍。 */
function paintNodes(nodes: NodeEl[]): void {
  recolor(nodes, [], THEME, buildFilter(), () => true);
}

/** 桩元素视图：工厂返回的句柄名义上是 SVGElement，实际是桩。 */
const stub = (e: SVGElement | null): SvgStubElement => e as unknown as SvgStubElement;

test("buildNode：在立卡平涂领域色加细描边，外套一圈同色细环；最外一圈结论实线、孤星虚线", () => {
  const alive = buildNode(fakeCard("a"), "alive", false, false, null);
  const tip = buildNode(fakeCard("t"), "alive", false, true, null);
  const iso = buildNode(fakeCard("b"), "alive", true, false, null);
  paintNodes([alive, tip, iso]);
  const core = stub(alive.core);
  assert.equal(core.getAttribute("fill"), "#5ea8ff", "平涂，不用渐变");
  assert.equal(core.getAttribute("stroke"), THEME.nodeStroke);
  assert.equal(core.getAttribute("r"), String(BASE_RADIUS));
  /* 细环：同一形状、半径大 3、只描不填 */
  const crown = stub(alive.crown);
  assert.equal(crown.getAttribute("r"), String(BASE_RADIUS + 3));
  assert.equal(crown.getAttribute("fill"), "none");
  assert.equal(crown.getAttribute("stroke"), "#5ea8ff");
  assert.equal(alive.outerRing, null, "既不是结论也不是孤星，没有最外一圈");
  /* 结论：最外一圈实线 */
  const tipRing = stub(tip.outerRing);
  assert.equal(tipRing.getAttribute("r"), String(BASE_RADIUS + 5.5));
  assert.equal(tipRing.getAttribute("stroke-dasharray"), null);
  assert.equal(tipRing.getAttribute("stroke"), "#5ea8ff");
  /* 孤星：最外一圈虚线 */
  const isoRing = stub(iso.outerRing);
  assert.ok(iso.crown);
  assert.equal(isoRing.getAttribute("stroke-dasharray"), "3 4");
  assert.equal(isoRing.getAttribute("stroke"), "#5ea8ff");
});

test("outerRingOf：孤星虚线、结论（主干末端且在立）实线，其余没有", () => {
  assert.equal(outerRingOf("alive", true, false), "isolated");
  assert.equal(outerRingOf("alive", false, true), "conclusion");
  assert.equal(outerRingOf("superseded", false, true), null, "末端被取代了不算结论");
  assert.equal(outerRingOf("alive", false, false), null);
});

test("buildNode：所有卡一样大；被取代的领域色混灰、没有环", () => {
  const sup = buildNode(fakeCard("c"), "superseded", false, false, null);
  paintNodes([sup]);
  const core = stub(sup.core);
  assert.equal(core.getAttribute("r"), String(BASE_RADIUS));
  assert.equal(core.getAttribute("fill"), supersededColor("#5ea8ff", THEME));
  assert.notEqual(core.getAttribute("fill"), "#5ea8ff");
  assert.equal(core.getAttribute("stroke"), THEME.nodeStroke);
  assert.equal(sup.crown, null, "被取代没有细环");
  assert.equal(sup.outerRing, null);
});

test("recolor：连线描自己那支渐变，旧卡端淡、新卡端亮；取代金黄、转向青；两端有一张被筛掉就整条退灰", () => {
  const a = buildNode(fakeCard("a"), "alive", false, false, null);
  const b = buildNode(fakeCard("b", "乙"), "alive", false, false, null);
  const defs = new DefsFactory(new SvgStubDocument().createElementNS(SVG_NS, "svg") as unknown as Element);
  const edge = (isPivot: boolean): EdgeEl => ({
    kind: "line",
    source: a.card,
    target: b.card,
    node: new SvgStubDocument().createElementNS(SVG_NS, "line") as unknown as SVGElement,
    gradient: defs.edgeGradient(),
    isPivot,
    baseOpacity: 0.9,
  });
  const sup = edge(false);
  const piv = edge(true);
  recolor([a, b], [sup, piv], THEME, buildFilter(), () => true);
  assert.equal(stub(sup.node).getAttribute("stroke"), `url(#${sup.gradient.id})`);
  assert.equal(stub(sup.gradient.from).getAttribute("stop-color"), THEME.supersede);
  assert.equal(stub(sup.gradient.to).getAttribute("stop-color"), THEME.supersede);
  assert.ok(Number(stub(sup.gradient.from).getAttribute("stop-opacity")) < 0.5, "旧卡那端淡");
  assert.equal(stub(sup.gradient.to).getAttribute("stop-opacity"), null, "新卡那端全亮");
  assert.equal(stub(piv.gradient.to).getAttribute("stop-color"), THEME.pivot);
  assert.notEqual(sup.gradient.id, piv.gradient.id, "一条边一支渐变");
  recolor([a, b], [sup], THEME, buildFilter(), (c) => c.id !== "b");
  assert.equal(stub(sup.gradient.from).getAttribute("stop-color"), THEME.mute);
  assert.equal(stub(sup.gradient.to).getAttribute("stop-color"), THEME.mute);
});

test("结论卡放大档：判定 = 主干末端那张且在立，乘数走布局的 tierMult", () => {
  assert.equal(isConclusion("alive", true), true);
  assert.equal(isConclusion("alive", false), false, "不是主干末端就不放大");
  assert.equal(isConclusion("superseded", true), false, "末端被取代了也不放大");
  assert.equal(new RingsLayout(m).tierMult, 1, "默认不放大，所有卡一样大；设置里可调");
  /* 主干末端集从模型的树里来，一树一张 */
  const tips = spineTipIds(m.trees);
  assert.ok(m.trees.length > 0);
  assert.equal(tips.size, m.trees.length);
  for (const t of m.trees) assert.ok(tips.has(t.spine.at(-1) as string));
});

test("快照是唯一的空心：只描领域色边、不填；细环跟着方形走；缺省形态跟抉择同款实心", () => {
  const snap = buildNode(fakeCard("d"), "alive", false, false, "snapshot");
  const plain = buildNode(fakeCard("e"), "alive", false, false, null);
  paintNodes([snap, plain]);
  assert.ok(snap.hollow);
  assert.equal(stub(snap.core).getAttribute("fill"), "none");
  assert.equal(stub(snap.core).getAttribute("stroke"), "#5ea8ff");
  assert.equal(stub(snap.core).getAttribute("stroke-width"), "2");
  assert.equal(stub(snap.crown).tagName, "rect", "细环跟本体同一个形状");
  assert.equal(plain.hollow, false);
  assert.equal(stub(plain.core).getAttribute("fill"), "#5ea8ff");
});

/* ================= label-arbiter ================= */

/** 最小标签桩：仲裁只读 style.display / textContent，没有 getComputedTextLength 时按字符数估算宽度。 */
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
  /* 缩放深一倍（pxToWorld = 0.5）：世界间距 8 = 屏幕 16px，够 14 了，128 也能显示 */
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

  /* 悬停强制显示：排在后面也优先占位，把排在前面的挤掉 */
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
  /* 正逆互逆：密集区每一天正算再逆算都回到同一天 */
  for (let d = m.day0; d <= m.dayMax; d += 3) {
    const t = railTOf(L, span, d);
    assert.ok(t >= 0 && t <= 1);
    if (!L.gapBands().some((b) => d > b.d0 && d < b.d1)) assert.equal(dayAtT(L, span, t), d);
  }
  /* 空窗中段在日期轨上折成窄条：折痕的高度远小于按日历线性该占的高度 */
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
