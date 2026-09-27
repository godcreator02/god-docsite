/**
 * 布局引擎的数学不变量——黄金样本（诗名 fixture，覆盖长空窗 / 爆发簇）。
 * 布局是一整块连续几何：改错一个常量或一处正负号，盘照样画出来、只是「看着不太对」，
 * 零报错——没有这份样本等于没护栏。
 *
 * 对基线不对数字，对的是引擎自身的数学自洽：折算正逆互逆、显示半径单调、局部放大率
 * 与映射本体的数值导数一致、装箱后跨域扇环角向互斥、每张卡都有落点。
 */
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AXIS_SPAN,
  buildModel,
  HUB_RIM,
  RingsLayout,
  gapDots,
  SPREAD_DEG,
} from "@godcreator/docfirst-trajectory";
import { scanCardDir } from "@godcreator/docfirst-workflow";
import type { GapDot, RawCard, TrajectoryModel } from "@godcreator/docfirst-trajectory";
import { memCards } from "./trajectory-helpers.ts";

/** 数值近似相等，模仿 jest 的 toBeCloseTo(expected, digits)。 */
function closeTo(actual: number, expected: number, digits = 2): void {
  const diff = Math.abs(actual - expected);
  assert.ok(diff < Math.pow(10, -digits) / 2, `期望 ${actual} 接近 ${expected}（差 ${diff}）`);
}

/** 合成一个最小项目：根卡与首张卡同日，后续卡按给定天序落点——用于外锚定不变量测试，
 * 不依赖 fixture 目录。 */
function buildSynthetic(id: string, days: number[]): TrajectoryModel {
  const day = (d: number): string => `2026-01-${String(d).padStart(2, "0")}T08:00`;
  const specs = [
    { name: id, fm: { type: "root", label: "合成项目", "born-at": day(days[0] as number) } },
    ...days.map((d, i) => ({
      name: `cd${String(i + 1).padStart(2, "0")}-卡`,
      fm: { "born-at": day(d), label: "卡", parent: [id] },
    })),
  ];
  return buildModel(memCards(specs));
}

const FIXTURES = fileURLToPath(new URL("./fixtures/trajectory", import.meta.url));
const ROOT_ID = "tfix-测试项目根卡";

const fixtureCards: RawCard[] = (await scanCardDir(FIXTURES)).cards;
const m: TrajectoryModel = buildModel(fixtureCards);
const L = new RingsLayout(m);

/** 采样日：全程步进 + 空窗段边界两侧与中点（对数段的接缝是最容易错的地方）。 */
function sampleDays(): number[] {
  const days: number[] = [];
  for (let d = m.day0; d <= m.dayMax; d += 3) days.push(d);
  for (const b of L.gapBands()) {
    days.push(b.d0 - 0.5, b.d0 + 0.5, (b.d0 + b.d1) / 2, b.d1 - 0.5, b.d1 + 0.5);
  }
  return days.filter((d) => d >= m.day0 && d <= m.dayMax);
}

test("fixture 装载：106 张卡全扫到，tfix 认主、收得到卡", () => {
  assert.equal(fixtureCards.length, 106);
  assert.equal(m.root?.id, ROOT_ID);
  assert.ok(m.cards.length > 100);
  assert.ok(m.edges.length > 0);
  assert.ok(m.trees.length > 0);
});

test("折算表：显示域正逆互逆，空窗段边界不例外", () => {
  for (const d of sampleDays()) closeTo(L.dayOfEff(L.dayEff(d)), d, 5);
});

test("折算表：显示半径随日期单调不减", () => {
  let prev = Number.NEGATIVE_INFINITY;
  for (let d = m.day0; d <= m.dayMax; d += 1) {
    const r = L.radiusDay(d);
    assert.ok(r >= prev - 1e-9);
    prev = r;
  }
});

test("鱼眼映射：显示半径不出界且单调不减", () => {
  const L2 = new RingsLayout(m);
  L2.strength = 1;
  L2.focusDay = (m.day0 + m.dayMax) / 2;
  L2.buildMap();
  let prev = Number.NEGATIVE_INFINITY;
  for (let r = L2.innerR; r <= L2.maxR; r += 2) {
    const rv = L2.displayRadius(r);
    assert.ok(rv >= L2.innerR - 1e-9);
    assert.ok(rv <= L2.maxR + 1e-9);
    assert.ok(rv >= prev - 1e-9);
    prev = rv;
  }
});

test("鱼眼映射：局部放大率与映射本体的数值导数一致", () => {
  const L2 = new RingsLayout(m);
  L2.strength = 1;
  L2.focusDay = (m.day0 + m.dayMax) / 2;
  L2.buildMap();
  const h = 0.01;
  for (let r = L2.innerR + 5; r <= L2.maxR - 5; r += 7) {
    const lo = L2.displayRadius(r - h);
    const hi = L2.displayRadius(r + h);
    if (lo <= L2.innerR + 1e-6 || hi >= L2.maxR - 1e-6) continue;
    const num = (hi - lo) / (2 * h);
    const anal = L2.mag(r);
    assert.ok(Math.abs(anal - num) / Math.max(1, Math.abs(num)) < 1e-3);
  }
});

test("盘心：configure 改 hubBase，innerR = hubBase，hubR = 入参 + 10，盘心世界锚定不变", () => {
  const L3 = new RingsLayout(m);
  L3.configure({ hubBase: 130 });
  L3.bake();
  assert.equal(L3.hubBase, 130);
  assert.equal(L3.innerR, 130);
  assert.equal(L3.hubR, 140);
  assert.equal(L3.hubWorldR, L3.innerR - HUB_RIM);
  assert.equal(L3.hubR - L3.hubWorldR, 10 + HUB_RIM);
  assert.ok(L3.innerR > L3.hubWorldR);
});

test("盘心：maxR 只随 hubR 变、不随数据深浅变，盘心占比在同一 hubBase 下跨项目恒等", () => {
  const narrow = buildSynthetic("narw", [1, 4, 7]);
  const wide = buildSynthetic("wide", [1, 3, 29]);
  const a = new RingsLayout(narrow);
  a.configure({ hubBase: 150 });
  a.bake();
  const b = new RingsLayout(wide);
  b.configure({ hubBase: 150 });
  b.bake();
  assert.equal(a.maxR, b.maxR);
  assert.equal(a.hubWorldR / (a.maxR + 60), b.hubWorldR / (b.maxR + 60));
});

test("盘心：占比随设置值单调走，大盘心占比更大", () => {
  const a = new RingsLayout(m);
  a.configure({ hubBase: 130 });
  a.bake();
  const b = new RingsLayout(m);
  b.configure({ hubBase: 180 });
  b.bake();
  assert.ok(b.hubWorldR / (b.maxR + 60) > a.hubWorldR / (a.maxR + 60));
});

test("外锚定环带：最内 / 最外环世界半径与数据无关", () => {
  const narrow = buildSynthetic("narw", [1, 4, 7]);
  const wide = buildSynthetic("wide", [1, 3, 29]);
  const a = new RingsLayout(narrow);
  const b = new RingsLayout(wide);
  assert.equal(a.radiusDay(narrow.day0), a.hubR);
  assert.equal(b.radiusDay(wide.day0), b.hubR);
  assert.equal(a.radiusDay(narrow.day0), b.radiusDay(wide.day0));
  assert.equal(a.radiusDay(narrow.dayMax), a.hubR + AXIS_SPAN);
  assert.equal(a.radiusDay(narrow.dayMax), b.radiusDay(wide.dayMax));
  assert.equal(a.maxR, b.maxR);
});

test("外锚定环带：根卡早于第一张卡时，day0 的环仍落在 hubR，任何一天的环都不进盘心", () => {
  const day = (d: number): string => `2026-01-${String(d).padStart(2, "0")}T08:00`;
  for (const [rootDay, cardDays] of [
    [1, [7, 10]],
    [1, [28, 30]],
  ] as const) {
    const model = buildModel(
      memCards([
        { name: "root", fm: { type: "root", label: "合成项目", "born-at": day(rootDay) } },
        ...cardDays.map((d, i) => ({ name: `cd${i}-卡`, fm: { "born-at": day(d), label: "卡", parent: ["root"] } })),
      ]),
    );
    const layout = new RingsLayout(model);
    assert.equal(model.day0, Date.parse(`${day(rootDay).slice(0, 10)}T00:00:00Z`) / 86400000);
    closeTo(layout.radiusDay(model.day0), layout.hubR, 9);
    for (let d = model.day0; d <= model.dayMax; d++) {
      assert.ok(layout.radiusDay(d) >= layout.hubR - 1e-9, `第 ${d - model.day0} 天的环半径 ${layout.radiusDay(d)} 小于 hubR`);
    }
  }
});

test("外锚定环带：单日盘（effTotal = 0）所有卡半径坍缩到 hubR + AXIS_SPAN，dayOfRadius 不返回 NaN", () => {
  const oneDay = buildSynthetic("oned", [5, 5, 5]);
  const L2 = new RingsLayout(oneDay);
  assert.equal(L2.radPerEff, 0);
  for (const c of oneDay.cards) assert.equal(L2.radius(c.bornAt), L2.hubR + AXIS_SPAN);
  assert.equal(Number.isNaN(L2.dayOfRadius(L2.hubR + AXIS_SPAN)), false);
  assert.equal(L2.dayOfRadius(L2.hubR + AXIS_SPAN), oneDay.dayMax);
  assert.equal(L2.dayOfRadius(0), oneDay.dayMax);
});

test("外锚定环带：空盘（无卡）day0 = dayMax，radPerEff 钉 0，maxR 与有卡盘同一默认 hubR 下相等", () => {
  const mw = buildModel(fixtureCards.filter((c) => c.type === "root"));
  assert.equal(mw.cards.length, 0);
  const L2 = new RingsLayout(mw);
  assert.equal(L2.radPerEff, 0);
  assert.equal(L2.maxR, L2.hubR + AXIS_SPAN + 50);
  assert.equal(L2.maxR, L.maxR);
});

test("空窗碎石：每条带 floor(天数) 颗、粒序跨带累加，同模型两份布局逐位相等", () => {
  const dotsOf = (layout: RingsLayout): GapDot[][] => {
    let idx = 0;
    return layout.gapBands().map((band) => {
      const dots = gapDots(layout, band, idx);
      idx += dots.length;
      return dots;
    });
  };
  const a = dotsOf(new RingsLayout(m));
  const bands = L.gapBands();
  assert.ok(bands.length > 0);
  bands.forEach((band, i) => assert.equal(a[i]?.length, Math.floor(band.days)));
  assert.deepEqual(dotsOf(new RingsLayout(m)), a);
});

test("装箱：跨域扇环角向互斥（领域是颜色通道，同色不挨着才成立）", () => {
  const boxes = [...L.treeBoxes, ...L.isoBoxes];
  const norm = (x: number): number => ((x % 360) + 360) % 360;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i];
      const B = boxes[j];
      if (!A || !B || A.domain === B.domain) continue;
      const wA = A.th1 - A.th0;
      const wB = B.th1 - B.th0;
      const off = norm(norm(B.th0) - norm(A.th0));
      assert.equal(off >= wA && off <= 360 - wB, true);
    }
  }
});

test("装箱：一圈装得下就铺满整圈——扇环按顺序互不重叠、各自放大同一倍，首尾相接的缝跨在 12 点", () => {
  const day = (d: number): string => `2026-01-${String(d).padStart(2, "0")}T08:00`;
  const specs = [
    { name: "fc00-根", fm: { type: "root", label: "小盘", "born-at": day(1) } },
    { name: "fc01-甲一", fm: { "born-at": day(2), label: "甲一", domain: "甲", parent: ["fc00-根"] } },
    {
      name: "fc02-甲二",
      fm: { "born-at": day(4), label: "甲二", domain: "甲", parent: ["fc00-根"] },
      body: "supersedes:: [甲一](fc01-甲一.md)",
    },
    { name: "fc03-乙一", fm: { "born-at": day(3), label: "乙一", domain: "乙", parent: ["fc00-根"] } },
    { name: "fc04-丙一", fm: { "born-at": day(5), label: "丙一", domain: "丙", parent: ["fc00-根"] } },
  ];
  const small = new RingsLayout(buildModel(memCards(specs)));
  const boxes = [...small.treeBoxes, ...small.isoBoxes].sort((a, b) => a.th0 - b.th0);
  assert.equal(boxes.length, 3, "甲一棵树，乙、丙各一条孤星带");
  const first = boxes[0]!;
  const last = boxes[boxes.length - 1]!;
  assert.ok(first.th0 > 0 && last.th1 < 360, "全在 0～360° 之内");
  closeTo(first.th0, 360 - last.th1, 6);
  const k = (first.th1 - first.th0) / first.width;
  assert.ok(k > 1, "小盘放大铺开");
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    closeTo((b.th1 - b.th0) / b.width, k, 6);
    if (i > 0) assert.ok(b.th0 > boxes[i - 1]!.th1, "按顺序互不重叠");
  }
  for (const c of buildModel(memCards(specs)).cards) {
    const p = small.places.get(c.id)!;
    assert.ok(p.angBase > 0 && p.angBase < 360, `${c.id} 落在圈内`);
  }
});

test("装箱：每张卡都有落点", () => {
  assert.equal(L.places.size, m.cards.length);
  for (const c of m.cards) assert.equal(L.places.has(c.id), true);
});

test("装箱：节点散开乘数——串珠角偏等比放大、扇环宽度增量 = (串珠峰值−1)×角距差", () => {
  const L2 = new RingsLayout(m);
  L2.spreadMult = 2;
  L2.bake();
  let beads = 0;
  for (const c of m.cards) {
    const a = L.places.get(c.id)?.spreadOff ?? 0;
    const b = L2.places.get(c.id)?.spreadOff ?? 0;
    closeTo(b, a * 2, 10);
    if (a !== 0) beads++;
  }
  assert.ok(beads > 0);
  L.treeBoxes.forEach((box, i) => {
    const byKey = new Map<string, number>();
    for (const id of box.tree.ids) {
      const key = `${m.byId[id]?.bornAt.slice(0, 10)}|${box.pos[id]}`;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    const beadMax = Math.max(...byKey.values());
    closeTo((L2.treeBoxes[i]?.width ?? 0) - box.width, (beadMax - 1) * SPREAD_DEG, 10);
  });
});

test("结论放大档不进装箱：tierMult 纯屏幕尺寸口径，改它布局产物纹丝不动", () => {
  const L2 = new RingsLayout(m);
  L2.tierMult = 2;
  L2.bake();
  for (const c of m.cards) assert.deepEqual(L2.places.get(c.id), L.places.get(c.id));
  assert.deepEqual(L2.treeBoxes.map((b) => b.width), L.treeBoxes.map((b) => b.width));
});
