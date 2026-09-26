/**
 * @godcreator/docfirst-trajectory——`.` 入口：parse / scan / model / layout / chains / thumbs
 * 纯函数汇总导出，**一句 import 外部模块都没有**（连 `node:` 也没有），浏览器、服务端、命令行都能直接用。
 * `buildTrajectory` 是装配入口：给一份扫盘产物的每张盘建模，不算布局——布局是纯函数、几毫秒，
 * 留给客户端按设置滑杆现算（见方案第十三节）；layout.ts / chains.ts 照样导出，供客户端组件使用。
 * 卡从哪儿来不归这个包：读卡目录在 `@godcreator/docfirst-workflow` 的 `scanCardDir`，
 * 这里的 `scanCards` 只吃已经读好的文件。
 * `./disk`（客户端组件 StarDisk）是另一个入口，源码在 disk.tsx，见方案第十三节「星轨盘」。
 */

import { buildDisks, buildModel } from "./model.ts";
import type { TrajectoryScan } from "./scan.ts";
import { type SerializableModel, toSerializable } from "./serial.ts";
import type { DiskInfo, Milestone, RawCard, Relation, SickFile } from "./types.ts";

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

export { buildDisks, buildModel, dayNum, formatDay, formOf, inRange, NO_DOMAIN, parseCardFile } from "./model.ts";
export type { ParsedFile } from "./model.ts";

export { pickCardFiles, scanCards } from "./scan.ts";
export type { CardFile, TrajectoryScan } from "./scan.ts";

export { launcherThumbs, renderThumb } from "./thumbs.ts";
export type { RenderThumbOptions } from "./thumbs.ts";

export {
  advanceFrame,
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
export type { Box, CardPlace, FrameState, GapBand, GapDot, GapSkeleton, IsoBox, LayoutPatch, RingSkeleton, TreeBox, WormBox } from "./layout.ts";

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

/** 一张卡对外的样子：RawCard 去掉 title（label 已兜底）与 mtime（只在包内部用）。 */
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

export { toRuntimeModel, toSerializable } from "./serial.ts";
export type { LauncherThumb, SerializableModel } from "./serial.ts";

/** 建模产物：`cards` 是全部卡（原始，未按盘裁剪），`disks` 是盘清单，`sick` 是报病，
 * `models` 按 rootId 索引每张盘的模型（不含布局——布局在客户端算）。 */
export interface Trajectory {
  cards: RouteCard[];
  disks: DiskInfo[];
  sick: SickFile[];
  models: Record<string, SerializableModel>;
}

/** 给一份扫盘产物的每张盘建模。扫盘产物是空的（卡目录还没建）时四段皆空、不报错。 */
export function buildTrajectory(scan: TrajectoryScan): Trajectory {
  const { cards, sick } = scan;
  const disks = buildDisks(cards);
  const models: Record<string, SerializableModel> = {};
  for (const disk of disks) models[disk.rootId] = toSerializable(buildModel(cards, disk.rootId));
  return { cards: cards.map(toRouteCard), disks, sick, models };
}
