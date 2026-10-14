/**
 * `@godcreator/trajectory` 的 `.` 出口：卡格式与校验、卡之间的关系、星轨盘的数据模型，纯逻辑。
 */

export { CARD_KEYS, cardFrontmatterSchema, ID_DATE_PREFIX, parseCardFile, readCardFile, titleOf } from "./card.ts";
export type { CardFrontmatter } from "./card.ts";
export { CARD_EXT, cardIdOfFile, pickCardFiles } from "./card-files.ts";
export { assembleCardSet, scanCards } from "./card-set.ts";
export { FrontmatterError, parseFrontmatter, stripFrontmatter } from "./frontmatter.ts";
export { splitLines } from "./lines.ts";
export { extractMilestones, MILESTONE_HEADING } from "./milestones.ts";
export type { ExtractedMilestones } from "./milestones.ts";
export { checkDocfirstRefs } from "./pin-marks.ts";
export { cardIdFromHref, EDGE_HEAD, extractRelations } from "./refs.ts";
export type { ExtractedRelations } from "./refs.ts";
export type { CardFile, CardFileReading, CardRecord, CardScan, ParsedFile, Problem, SickFile } from "./types.ts";
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
