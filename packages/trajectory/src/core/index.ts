/**
 * `@godcreator/trajectory` 的 `.` 出口：卡格式、校验、卡之间的关系与星轨盘的数据模型，纯逻辑。
 */

export { parseCardFile, ID_DATE_PREFIX } from "./card.ts";
export type { ParsedFile } from "./card.ts";
export { checkDocfirstRefs } from "./card-refs.ts";
export {
  CARD_KEYS,
  cardIdFromHref,
  EDGE_HEAD,
  extractMilestones,
  extractRelations,
  MILESTONE_HEADING,
  parseFrontmatter,
  splitLines,
  stripFrontmatter,
} from "./parse.ts";
export type { ExtractedMilestones, ExtractedRelations, Frontmatter } from "./parse.ts";
export { CARD_EXT, pickCardFiles, scanCards } from "./scan.ts";
export type { CardFile, CardRecord, CardScan, Problem, SickFile } from "./types.ts";
export { buildModel, validBornAt } from "./model/build.ts";
export type {
  BrokenRel,
  Card,
  DiskCard,
  DiskCenter,
  DiskInput,
  Edge,
  EdgeKind,
  Milestone,
  Relation,
  TrajectoryModel,
  Tree,
} from "./model/types.ts";
