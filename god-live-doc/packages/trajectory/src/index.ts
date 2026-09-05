/**
 * @godcreator02/live-doc-trajectory——`.` 入口：parse / validate / model / layout / chains
 * 纯函数汇总导出，零 npm 依赖（只用 node:fs / node:path，来自 scan.ts 一处）；`buildTrajectory`
 * 是本文件新写的装配入口：扫一次目录、给每张盘建模，不算布局——布局是纯函数、几毫秒，留给客户端
 * 按设置滑杆现算（见方案第十三节）；layout.ts / chains.ts 照样导出，供客户端组件使用。
 * `./react`（客户端组件）与 `./server`（服务端组件 + cardSchema + remark 插件）是另外两个入口，
 * 各自的源码在 react.tsx / server.tsx，见方案第十三节「星轨盘」与「接线」。
 */

import { buildDisks, buildModel } from "./model.ts";
import { scanDir } from "./scan.ts";
import type { DiskInfo, Milestone, RawCard, Relation, SickFile, TrajectoryModel } from "./types.ts";

export {
  extractMilestones,
  extractRelations,
  listOf,
  MILESTONE_HEADING,
  parseFrontmatter,
  scalarOf,
  splitLines,
  stripFrontmatter,
  CARD_KEYS,
} from "./parse.ts";
export type { ExtractedRelations, Frontmatter } from "./parse.ts";

export { checkLivedocRefs } from "./validate.ts";

export { buildDisks, buildModel, dayNum, formatDay, formOf, inRange, NO_DOMAIN, parseCardFile } from "./model.ts";
export type { ParsedFile } from "./model.ts";

export { scanDir } from "./scan.ts";
export type { TrajectoryScan } from "./scan.ts";

export {
  AXIS_SPAN,
  BASE_RADIUS,
  BLEND_W,
  DEG,
  gapDots,
  HUB_RIM,
  LAYOUT_PATCH_KEYS,
  LOD_MAX,
  LOD_MIN,
  NODE_RADIUS,
  ROOT_RADIUS,
  RingsLayout,
  ringSkeleton,
  SPREAD_DEG,
  WORM_DOMAIN,
  bandFade,
  layoutPatchOf,
  lodOf,
  monthGate,
  polar,
  pseudoRandom,
  smoothstep,
} from "./layout.ts";
export type { Box, CardPlace, GapBand, GapDot, GapSkeleton, IsoBox, LayoutPatch, RingSkeleton, TreeBox, WormBox } from "./layout.ts";

export { buildChains, computeDodge } from "./chains.ts";
export type { Chain } from "./chains.ts";

export type {
  BrokenRel,
  Card,
  DayRange,
  DiskInfo,
  Edge,
  EdgeKind,
  Milestone,
  Problem,
  ProjectRoot,
  RawCard,
  Relation,
  SickFile,
  Tree,
  TrajectoryModel,
  Wormhole,
} from "./types.ts";

/** 一张卡对外的样子：RawCard 去掉 title（label 已兜底）与 mtime（内部指纹用）。 */
export interface RouteCard {
  id: string;
  type: string | null;
  parent: string[];
  mergedIn: string[];
  domain: string | null;
  label: string;
  status: string | null;
  bornAt: string;
  relations: Relation[];
  /** 仅根卡有，非根卡恒 null */
  milestones: Milestone[] | null;
  path: string;
}

function toRouteCard(raw: RawCard): RouteCard {
  return {
    id: raw.id,
    type: raw.type,
    parent: raw.parent,
    mergedIn: raw.mergedIn,
    domain: raw.domain,
    label: raw.label,
    status: raw.status,
    bornAt: raw.bornAt,
    relations: raw.relations,
    milestones: raw.milestones,
    path: raw.path,
  };
}

/** TrajectoryModel 的可序列化版：supersededIds 从 Set 转数组，其余字段原样——
 * JSON.stringify（或跨进程传递）之前用这个。 */
export type SerializableModel = Omit<TrajectoryModel, "supersededIds"> & { supersededIds: string[] };

function toSerializable(model: TrajectoryModel): SerializableModel {
  return { ...model, supersededIds: [...model.supersededIds] };
}

/** 建模产物：`cards` 是全部卡（原始，未按盘裁剪），`disks` 是盘清单，`sick` 是报病，
 * `models` 按 rootId 索引每张盘的模型（不含布局——布局在客户端算）。 */
export interface Trajectory {
  cards: RouteCard[];
  disks: DiskInfo[];
  sick: SickFile[];
  models: Record<string, SerializableModel>;
}

/** 扫一次目录、给每张盘建模。dir 是绝对路径，直接传给 scanDir；目录不存在时
 * 四段皆空、不报错。 */
export async function buildTrajectory(dir: string): Promise<Trajectory> {
  const { cards, sick } = await scanDir(dir);
  const disks = buildDisks(cards);
  const models: Record<string, SerializableModel> = {};
  for (const disk of disks) models[disk.rootId] = toSerializable(buildModel(cards, disk.rootId));
  return { cards: cards.map(toRouteCard), disks, sick, models };
}
