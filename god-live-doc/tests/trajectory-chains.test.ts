/**
 * chains 的两个纯函数：buildChains——树内按槽分道、槽内同日合组、组按日期序，单日槽
 * （全槽仅一个日期）不进表；computeDodge——同链跨日弧向避让，径向间距不足才给角偏，
 * 偏移按索引奇偶交替、上限半槽宽。
 * buildChains 用真实 buildModel + RingsLayout；computeDodge 只碰
 * places / treeBoxes[].slotDeg / mag / displayRadius 几个字段，用最小 duck-typed 假布局精确摆几何。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChains, computeDodge, RingsLayout, buildModel } from "@godcreator02/live-doc-trajectory";
import type { Chain, CardPlace } from "@godcreator02/live-doc-trajectory";
import { card, D, memCards, root } from "./trajectory-helpers.ts";

/** 一棵树四张卡的主干直链（aa01←aa02←aa03←aa04，supersedes 一路串），
 * aa02/aa03 同日（06 号）测多卡同组；
 * 主干外挂一条转向支线（cc01→cc02，pivots-from，另开槽 pos=1）测跨槽不串组；
 * 单日两卡树（bb01/bb02 同日 20 号，全槽只一个日期）测单日不成链；
 * 另一棵两日直链树（dd01←dd02）测跨树不串组。 */
const buildFixtureModel = () =>
  buildModel(
    memCards([
      root("pj01", D(1)),
      card("aa01-链头", { "born-at": D(2), domain: "域一" }),
      card("aa02-链二", { "born-at": D(6), domain: "域一" }, { body: "supersedes:: [[aa01-链头]]" }),
      card("aa03-链三", { "born-at": D(6), domain: "域一" }, { body: "supersedes:: [[aa02-链二]]" }),
      card("aa04-链尾", { "born-at": D(10), domain: "域一" }, { body: "supersedes:: [[aa03-链三]]" }),
      card("cc01-支线甲", { "born-at": D(4), domain: "域一" }, { body: "pivots-from:: [[aa01-链头]]" }),
      card("cc02-支线乙", { "born-at": D(8), domain: "域一" }, { body: "pivots-from:: [[cc01-支线甲]]" }),
      card("bb01-单日甲", { "born-at": D(20), domain: "域二" }),
      card("bb02-单日乙", { "born-at": D(20), domain: "域二" }, { body: "supersedes:: [[bb01-单日甲]]" }),
      card("dd01-别树头", { "born-at": D(25), domain: "域三" }),
      card("dd02-别树尾", { "born-at": D(30), domain: "域三" }, { body: "supersedes:: [[dd01-别树头]]" }),
    ]),
    "pj01",
  );

test("同树同槽同日多卡分到同一组、组按日期序；跨槽（主干/支线）各开一条链不串组", () => {
  const model = buildFixtureModel();
  const layout = new RingsLayout(model);
  const chains = buildChains(model, layout);

  const boxOfAa = layout.treeBoxes.findIndex((b) => b.tree.ids.includes("aa01-链头"));
  assert.ok(boxOfAa >= 0);
  const chainsOfAa = chains.filter((c) => c.boxIndex === boxOfAa);
  assert.equal(chainsOfAa.length, 2);

  const spine = chainsOfAa.find((c) => c.groups.some((g) => g.ids.includes("aa01-链头")));
  assert.deepEqual(spine?.groups.map((g) => g.ids), [["aa01-链头"], ["aa02-链二", "aa03-链三"], ["aa04-链尾"]]);
  assert.deepEqual(spine?.groups.map((g) => g.hasConclusion), [false, false, true]);
  assert.equal(spine?.groups.every((g) => g.rBase === 6), true);

  const subline = chainsOfAa.find((c) => c.groups.some((g) => g.ids.includes("cc01-支线甲")));
  assert.deepEqual(subline?.groups.map((g) => g.ids), [["cc01-支线甲"], ["cc02-支线乙"]]);
  assert.deepEqual(subline?.groups.map((g) => g.hasConclusion), [true, true]);
});

test("单日两卡树（全槽仅一个日期）不成链", () => {
  const model = buildFixtureModel();
  const layout = new RingsLayout(model);
  const chains = buildChains(model, layout);

  const boxOfBb = layout.treeBoxes.findIndex((b) => b.tree.ids.includes("bb01-单日甲"));
  assert.ok(boxOfBb >= 0);
  assert.equal(chains.some((c) => c.boxIndex === boxOfBb), false);
  const allIds = chains.flatMap((c) => c.groups.flatMap((g) => g.ids));
  assert.ok(!allIds.includes("bb01-单日甲"));
  assert.ok(!allIds.includes("bb02-单日乙"));
});

test("不同树各占一条链，互不混组", () => {
  const model = buildFixtureModel();
  const layout = new RingsLayout(model);
  const chains = buildChains(model, layout);

  const boxOfAa = layout.treeBoxes.findIndex((b) => b.tree.ids.includes("aa01-链头"));
  const boxOfDd = layout.treeBoxes.findIndex((b) => b.tree.ids.includes("dd01-别树头"));
  assert.ok(boxOfDd >= 0);
  assert.notEqual(boxOfDd, boxOfAa);

  const ddChain = chains.find((c) => c.boxIndex === boxOfDd);
  assert.deepEqual(ddChain?.groups.map((g) => g.ids), [["dd01-别树头"], ["dd02-别树尾"]]);
  const ddIds = ddChain?.groups.flatMap((g) => g.ids) ?? [];
  assert.equal(ddIds.every((id) => id === "dd01-别树头" || id === "dd02-别树尾"), true);
});

/** 只碰 places / treeBoxes[].slotDeg / mag / displayRadius 几个字段，duck-typed 最小假布局：
 * displayRadius 恒等映射（等价 strength = 0 的线性态），mag 恒 1（lod 钳在 1）。 */
function fakeLayout(opts: { slotDeg: number; radii: Record<string, number>; tierMult?: number; symbolPx?: number }): RingsLayout {
  const places = new Map<string, CardPlace>();
  for (const [id, rLin] of Object.entries(opts.radii)) places.set(id, { angBase: 0, spreadOff: 0, rLin });
  return {
    treeBoxes: [{ slotDeg: opts.slotDeg }],
    places,
    tierMult: opts.tierMult ?? 1.4,
    symbolPx: opts.symbolPx ?? 0.65,
    mag: () => 1,
    displayRadius: (r: number) => r,
  } as unknown as RingsLayout;
}

/** 密集场景的三档半径：径向间距（2 世界单位）远小于所需屏幕间距，三处测试复用同一组数据。 */
const DENSE_RADII = { g0: 100, g1: 102, g2: 104 };
const SPARSE_SLOT_DEG = 30;
const DENSE_SLOT_DEG = 4;

const denseChain: Chain[] = [
  {
    boxIndex: 0,
    groups: [
      { ids: ["g0"], rBase: 6, hasConclusion: false },
      { ids: ["g1", "g1b"], rBase: 6, hasConclusion: false },
      { ids: ["g2"], rBase: 6, hasConclusion: false },
    ],
  },
];

test("computeDodge：径向间距不足时按索引奇偶交替给角偏，同组成员偏移相同、两端同号中段异号", () => {
  const layout = fakeLayout({ slotDeg: SPARSE_SLOT_DEG, radii: DENSE_RADII });
  const dodge = computeDodge(denseChain, layout, 1);

  assert.equal(dodge.size, 4);
  for (const id of ["g0", "g1", "g1b", "g2"]) {
    assert.notEqual(dodge.get(id), undefined);
    assert.ok(Math.abs(dodge.get(id) as number) > 0);
  }
  assert.equal(dodge.get("g1"), dodge.get("g1b"));
  assert.equal(Math.sign(dodge.get("g0") as number), Math.sign(dodge.get("g2") as number));
  assert.notEqual(Math.sign(dodge.get("g1") as number), Math.sign(dodge.get("g0") as number));
  assert.ok(Math.abs(Math.abs(dodge.get("g0") as number) - Math.abs(dodge.get("g2") as number)) < 0.5);
});

test("computeDodge：偏移量上限钉死半槽宽（slotDeg / 2），挤到顶就钳住不再放大", () => {
  const wide = fakeLayout({ slotDeg: SPARSE_SLOT_DEG, radii: DENSE_RADII });
  const dodgeWide = computeDodge(denseChain, wide, 1);
  const needed = Math.abs(dodgeWide.get("g0") as number);

  const narrow = fakeLayout({ slotDeg: DENSE_SLOT_DEG, radii: DENSE_RADII });
  const dodgeNarrow = computeDodge(denseChain, narrow, 1);
  assert.ok(needed > 2);
  for (const id of ["g0", "g1", "g1b", "g2"]) {
    const v = Math.abs(dodgeNarrow.get(id) as number);
    assert.ok(Math.abs(v - 2) < 1e-9);
  }
});

test("computeDodge：径向间距充分（远超所需屏幕间距）时不产生任何避让", () => {
  const spread: Chain[] = [
    {
      boxIndex: 0,
      groups: [
        { ids: ["g0"], rBase: 6, hasConclusion: false },
        { ids: ["g1"], rBase: 6, hasConclusion: false },
        { ids: ["g2"], rBase: 6, hasConclusion: false },
      ],
    },
  ];
  const layout = fakeLayout({ slotDeg: 30, radii: { g0: 100, g1: 400, g2: 700 } });
  assert.equal(computeDodge(spread, layout, 1).size, 0);
});

test("computeDodge：单组链（无相邻对）不产生避让", () => {
  const single: Chain[] = [{ boxIndex: 0, groups: [{ ids: ["only"], rBase: 6, hasConclusion: false }] }];
  const layout = fakeLayout({ slotDeg: 30, radii: { only: 100 } });
  assert.equal(computeDodge(single, layout, 1).size, 0);
});
