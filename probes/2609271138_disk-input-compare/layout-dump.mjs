// 用法：node layout-dump.mjs <old|new> <仓根> <输出文件> <卡目录…>
// 把画布要用的一切（模型、里程碑、种类、半径角度、扇区、碎石、同日错开、鱼眼后的显示半径）导成 JSON，新旧两边逐位比。
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

const [mode, root, out, ...dirs] = process.argv.slice(2);
const url = (p) => pathToFileURL(resolve(root, p)).href;
const { scanCardDir } = await import(url("packages/docfirst-workflow/dist/cards.mjs"));
const traj = await import(url("packages/docfirst-trajectory/dist/index.mjs"));
let RingsLayout, gapDots, buildChains, computeDodge;
if (mode === "old") {
  ({ RingsLayout, gapDots, buildChains, computeDodge } = traj);
} else {
  ({ RingsLayout, gapDots } = await import(url("packages/docfirst-trajectory/src/layout.ts")));
  ({ buildChains, computeDodge } = await import(url("packages/docfirst-trajectory/src/chains.ts")));
}

function step(layout) {
  if (mode === "old") return traj.advanceFrame(layout, { view: { k: 1, tx: 0, ty: 0 }, vT: null, hv: new Map(), hover: null, raf: null }, 0.16);
  return layout.step(0.16);
}

const result = {};
for (const dir of dirs) {
  const scan = await scanCardDir(resolve(dir));
  let model, milestones, kinds;
  if (mode === "old") {
    model = traj.buildModel(scan.cards);
    const rootRaw = model.root ? scan.cards.find((c) => c.id === model.root.id) : undefined;
    milestones = rootRaw?.milestones ? traj.inRange(rootRaw.milestones, model.day0, model.dayMax) : [];
    const typeById = new Map(scan.cards.map((c) => [c.id, c.type]));
    kinds = model.cards.map((c) => [c.id, typeById.get(c.id) ?? null]);
  } else {
    model = traj.buildModel(scan);
    milestones = model.milestones;
    kinds = model.cards.map((c) => [c.id, c.kind]);
  }
  const center = mode === "old" ? model.root : model.center;
  const layout = new RingsLayout(model);
  const dots = [];
  let idx = 0;
  for (const band of layout.gapBands()) {
    const d = gapDots(layout, band, idx);
    idx += d.length;
    dots.push(d);
  }
  const chains = buildChains(model, layout);
  const dodge = (k) => [...computeDodge(chains, layout, k)].sort((a, b) => a[0].localeCompare(b[0]));
  const places = [...layout.places].sort((a, b) => a[0].localeCompare(b[0]));
  const box = (b) => ({ th0: b.th0, th1: b.th1, rMin: b.rMin, rMax: b.rMax, width: b.width, padDeg: b.padDeg, slotDeg: b.slotDeg, angMid: b.angMid, dMin: b.dMin, dMax: b.dMax, domain: b.domain });
  const base = {
    center: center ? { id: center.id, label: center.label } : null,
    cards: model.cards.map((c) => ({ id: c.id, domain: c.domain, bornAt: c.bornAt, label: c.label })),
    kinds,
    edges: model.edges,
    broken: model.broken,
    superseded: [...model.supersededIds].sort(),
    domains: model.domains,
    trees: model.trees,
    isolated: model.isolated.map((c) => c.id),
    compOf: model.compOf,
    day0: model.day0,
    dayMax: model.dayMax,
    milestones,
    sick: scan.sick,
    hub: { innerR: layout.innerR, hubR: layout.hubR, hubWorldR: layout.hubWorldR, maxR: layout.maxR },
    places,
    treeBoxes: layout.treeBoxes.map((b) => ({ ...box(b), slots: b.slots, pos: b.pos, name: b.name, ids: b.tree.ids })),
    isoBoxes: layout.isoBoxes.map((b) => ({ ...box(b), iso: b.iso.map((c) => c.id) })),
    gapBands: layout.gapBands(),
    dots,
    chains,
    dodge1: dodge(1),
    dodge3: dodge(3),
  };
  /* 聚焦最新往前 5 天，推帧到停，取每张卡的显示半径与放大率；再退回全景 */
  layout.focusOn(model.dayMax - 5, false);
  let frames = 0;
  while (step(layout) && frames < 400) frames++;
  base.focus = { frames, display: places.map(([id, p]) => [id, layout.displayRadius(p.rLin), layout.mag(p.rLin)]) };
  layout.unfocus();
  frames = 0;
  while (step(layout) && frames < 400) frames++;
  base.unfocus = { frames, display: places.map(([id, p]) => [id, layout.displayRadius(p.rLin)]) };
  /* 设置面板的「世界尺度级」改动：盘心大小 */
  layout.configure({ hubBase: 130, gapFree: 20 });
  base.reconfigured = { hub: { innerR: layout.innerR, hubR: layout.hubR, maxR: layout.maxR }, places: [...layout.places].sort((a, b) => a[0].localeCompare(b[0])) };
  result[dir] = base;
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`${mode}: ${dirs.length} 个卡目录 → ${out}`);
