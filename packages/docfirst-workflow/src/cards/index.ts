/**
 * docfirst 卡格式：轨迹卡怎么写（frontmatter、关系行、里程碑区块）、怎么校验、怎么换成星轨盘的中性输入。
 * 只有这一种卡格式，没有格式接口。也是 `./cards` 出口：站的星轨盘页经 `@godcreator/docfirst-fumadocs` 用读卡目录，
 * 卡集合用字段表、解析器与卡身份；走 `.` 会把命令行与配置加载带进 Next 的服务端构建。
 *
 * 这个目录只许 import `../marker/`（卡里不许钉码要认记号）与 `@godcreator/docfirst-trajectory`，
 * 除了命令行谁都不 import 它（`tests/boundary.test.ts` 守着）。
 */

export { parseCardFile } from "./card.ts";
export type { ParsedFile } from "./card.ts";
export { scanCardDir } from "./card-dir.ts";
export { checkDocfirstRefs } from "./card-refs.ts";
export {
  CARD_KEYS,
  cardIdFromHref,
  extractMilestones,
  extractRelations,
  MILESTONE_HEADING,
  parseFrontmatter,
  splitLines,
  stripFrontmatter,
} from "./parse.ts";
export type { ExtractedMilestones, ExtractedRelations, Frontmatter } from "./parse.ts";
export { pickCardFiles, scanCards } from "./scan.ts";
export type { CardFile, CardRecord, CardScan, Problem, SickFile } from "./types.ts";
