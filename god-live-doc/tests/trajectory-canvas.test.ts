/**
 * 画布层纯函数部分的测试（画布层住 `./react` 入口那一侧，测试直读源码，Node 直跑 .ts）：
 *   theme：领域色按出现序分配、未分道走中性色不占色板；mix 两 hex 线性插值、非 hex 出 color-mix；
 *          cssToHex 吃 hex 与 rgb()。
 *   label-arbiter：12 点 / 6 点竖线 14px 贪心占位；节点标签按真实文本区间判定、悬停先占坑。
 *   date-rail：滚轮格数结算（余额累进、反向清账）；railTOf / dayAtT 正逆互逆、空窗折成折痕。
 *   star-thumb：喂 svg-doc 桩文档画 fixture 盘，节点数 = 上盘卡数、扇环框数 = 树数、
 *          边数 = 关系边数、不画里程碑与文字、没有任何交互属性；布局与大图同口径。
 * DOM 相关的元素用手写的最小桩（只实现仲裁真读写的 style / textContent），不引 DOM 库。
 */
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
/* 布局 / 模型也直读源码：画布层吃的是源码里的 RingsLayout 型，跟 dist 里那份是两个声明 */
import { HUB_RIM, RingsLayout } from "../packages/trajectory/src/layout.ts";
import { buildModel, NO_DOMAIN } from "../packages/trajectory/src/model.ts";
import { scanDir } from "../packages/trajectory/src/scan.ts";
import type { RawCard, TrajectoryModel } from "../packages/trajectory/src/types.ts";
import { buildThemes, cssToHex, DEFAULT_RING_PALETTE, mix } from "../packages/trajectory/src/canvas/theme.ts";
import { LabelArbiter } from "../packages/trajectory/src/canvas/label-arbiter.ts";
import { consumeWheelNotches, dayAtT, railTOf } from "../packages/trajectory/src/canvas/date-rail.ts";
import { renderStarThumb, THUMB_PAD } from "../packages/trajectory/src/canvas/star-thumb.ts";
import { DEFAULT_SETTINGS } from "../packages/trajectory/src/canvas/settings.ts";
import { serializeSvg, SvgStubDocument, type SvgStubElement } from "../packages/trajectory/src/canvas/svg-doc.ts";

const FIXTURES = fileURLToPath(new URL("./fixtures/trajectory", import.meta.url));
const ROOT_ID = "tfix-测试项目根卡";
const WORM_ID = "wh01-虫洞子项目根卡";

const fixtureCards: RawCard[] = (await scanDir(FIXTURES)).cards;
const m: TrajectoryModel = buildModel(fixtureCards, ROOT_ID);

/* ================= theme ================= */

test("buildThemes：领域色按出现序循环分配，未分道走中性色、不占色板位", () => {
  const t = buildThemes(["甲", "乙", NO_DOMAIN, "丙"]);
  assert.equal(t.dark.domain["甲"], "#5ea8ff");
  assert.equal(t.dark.domain["乙"], "#c78bfa");
  assert.equal(t.dark.domain[NO_DOMAIN], t.dark.noDomain);
  assert.equal(t.dark.domain["丙"], "#4ade9e", "哨兵压在中间也不占位，丙拿第三色");
  assert.equal(t.light.domain["丙"], "#0e9e63");
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

test("cssToHex：hex 归一小写，rgb()/rgba() 转 hex，别的格式返回 null", () => {
  assert.equal(cssToHex("#ABCDEF"), "#abcdef");
  assert.equal(cssToHex("rgb(255, 0, 16)"), "#ff0010");
  assert.equal(cssToHex("rgba(1 2 3 / 0.5)"), "#010203");
  assert.equal(cssToHex("hsl(0, 0%, 9%)"), null);
  assert.equal(cssToHex("var(--x)"), null);
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

test("star-thumb：节点数 = 上盘卡数、扇环框数 = 树数、边数 = 关系边数，不画文字与里程碑，没有交互属性", () => {
  const { svg, html } = paint(m);
  assert.ok(m.cards.length > 0 && m.edges.length > 0 && m.trees.length > 0);
  /* 节点 g：每卡一个 + 每虫洞一个（虫洞 g 排最末） */
  const gs = svg.query("g");
  assert.equal(gs.length, m.cards.length + m.wormholes.length);
  /* 扇环框：fill 走 --box-fill 变量的 path，一树一个 */
  const boxes = svg.query("path").filter((p) => p.getAttribute("fill") === "var(--box-fill)");
  assert.equal(boxes.length, m.trees.length);
  /* 边：带 marker-end 的 path / line，一边一条 */
  const edges = [...svg.query("path"), ...svg.query("line")].filter((e) => e.getAttribute("marker-end"));
  assert.equal(edges.length, m.edges.length);
  /* 只画形状：一个字都不画，也不画里程碑（金色细环）、不带任何交互属性 */
  assert.equal(svg.query("text").length, 0);
  assert.doesNotMatch(html, /<text/);
  assert.doesNotMatch(html, /\bon[a-z]+=|href=|cursor|tabindex/i);
  assert.match(html, /^<svg viewBox="-[\d.]+ -[\d.]+ [\d.]+ [\d.]+" class="trajectory-thumb">/);
  /* 虫洞双环：同一 g 里恰好两个根卡家族色的空心环 */
  const T = buildThemes(m.domains).dark;
  const wormGs = gs.filter(
    (g) =>
      g.children.filter(
        (c) => c.tagName === "circle" && c.getAttribute("fill") === "none" && c.getAttribute("stroke") === T.hubStroke,
      ).length === 2,
  );
  assert.equal(wormGs.length, m.wormholes.length);
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
