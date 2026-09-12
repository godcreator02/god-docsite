/**
 * 链表分组 + 跨日弧向避让——纯几何。建构期（buildChains）只依赖模型与站位表，
 * 帧变量只在 computeDodge 里（视图缩放会变间距）。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/chains.ts`（只读参考，本仓不 import 它）。
 */

import { type CardPlace, DEG, lodOf, NODE_RADIUS, type RingsLayout } from "./layout.ts";
import { formOf } from "./model.ts";
import type { Card, TrajectoryModel } from "./types.ts";

/** 链表（跨日弧向避让用）：每 (树, 槽) 一条，组 = 同日卡集、按日期序；
 * rBase = 组内最大节点基半径（算所需间距，建构期定死、不随帧变）；
 * hasConclusion = 组内含结论卡（主干末端那张且在立），dodge 直径现乘 tierMult——
 * 判定与节点放大档的 isConclusion 同一口径。 */
export interface Chain {
  boxIndex: number;
  groups: { ids: string[]; rBase: number; hasConclusion: boolean }[];
}

/** 链表重建：树内按槽分道、槽内同日合组、组按日期序。单组槽（无相邻对）不进表。
 * 只依赖模型与站位，rebake 保序重建、身份稳定，建一次够用。 */
export function buildChains(model: TrajectoryModel, layout: RingsLayout): Chain[] {
  const { byId } = model;
  const chains: Chain[] = [];
  /* 结论卡集：每棵树主干末端那张（与渲染层 spineTipIds 同一口径，纯几何这边自算不跨层） */
  const tips = new Set(model.trees.map((t) => t.spine.at(-1)).filter((id) => !!id));
  layout.treeBoxes.forEach((box, boxIndex) => {
    const bySlot = new Map<number, Map<string, string[]>>();
    for (const id of box.tree.ids) {
      const slot = box.pos[id] as number;
      let days = bySlot.get(slot);
      if (!days) {
        days = new Map();
        bySlot.set(slot, days);
      }
      const key = (byId[id] as Card).bornAt.slice(0, 10);
      const arr = days.get(key);
      if (arr) arr.push(id);
      else days.set(key, [id]);
    }
    for (const days of bySlot.values()) {
      if (days.size < 2) continue;
      const groups = [...days.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, ids]) => ({
          ids,
          rBase: Math.max(...ids.map((i) => NODE_RADIUS[formOf(model, i)])),
          hasConclusion: ids.some((i) => tips.has(i) && formOf(model, i) === "alive"),
        }));
      chains.push({ boxIndex, groups });
    }
  });
  return chains;
}

/** 同链跨日弧向避让：判定看屏幕径向间距，动作只动角度——半径 = 日期是铁律。
 * 相邻日组径向间距不足所需时按日组序奇偶交替 ± 错开，偏移量按缺口连续给：
 * 间距拉开（透镜推入 / 放大）自动归零、链还原直线，锯齿只出现在真挤的地方。
 * 上限半槽宽防撞邻链；错到上限仍叠的密集段交给透镜，这层只管「叠成一摞变看得出个数」。
 * 所需直径不含 hover 放大——hover 不该抖布局。
 * viewK = 视图当前缩放：唯一的帧态输入，屏幕间距换算要用它——传参数而非视图引用，
 * 保持纯函数、不认识视图层。 */
export function computeDodge(
  chains: Chain[],
  layout: RingsLayout,
  viewK: number,
): Map<string, number> {
  const dodge = new Map<string, number>();
  for (const chain of chains) {
    const cap = (layout.treeBoxes[chain.boxIndex] as { slotDeg: number }).slotDeg / 2;
    const groups = chain.groups;
    /* 每组的显示半径与屏幕直径（帧变量：鱼眼映射与缩放深度都在动） */
    const radii: number[] = [];
    const diam: number[] = [];
    for (const g of groups) {
      const place = layout.places.get(g.ids[0] as string) as CardPlace;
      const mag = layout.mag(place.rLin);
      const lod = lodOf(mag);
      radii.push(layout.displayRadius(place.rLin));
      diam.push(2 * g.rBase * (g.hasConclusion ? layout.tierMult : 1) * layout.symbolPx * lod);
    }
    /* 相邻对的角向需求（每侧担一半）：水平错开量 √(所需² − 径向²) 在对中半径处换算角度 */
    const need: number[] = [];
    for (let i = 0; i < groups.length - 1; i++) {
      const r0 = radii[i] as number;
      const r1 = radii[i + 1] as number;
      const gap = (r1 - r0) * viewK;
      const needPx = ((diam[i] as number) + (diam[i + 1] as number)) / 2 + 6;
      if (gap >= needPx) {
        need.push(0);
        continue;
      }
      const dx = Math.sqrt(needPx * needPx - gap * gap);
      need.push((dx / 2 / (((r0 + r1) / 2) * viewK)) * DEG);
    }
    for (let i = 0; i < groups.length; i++) {
      const push = Math.max(i > 0 ? (need[i - 1] as number) : 0, i < need.length ? (need[i] as number) : 0);
      if (push <= 0) continue;
      const off = (i % 2 ? -1 : 1) * Math.min(push, cap);
      for (const id of (groups[i] as Chain["groups"][number]).ids) dodge.set(id, off);
    }
  }
  return dodge;
}
