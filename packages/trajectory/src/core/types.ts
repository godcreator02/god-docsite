/**
 * 卡格式的类型：卡文件、一张卡解析出的记录、病，以及一批卡汇总出的结果——星轨盘要的中性输入（盘心加一组卡）加病卡清单。
 */

import type { DiskInput, Milestone, Relation } from "./model/types.ts";

/** 一个卡文件：`name` 是卡目录里的文件名（卡上记的 `path` 就是它）。 */
export interface CardFile {
  name: string;
  text: string;
}

/** 一张卡解析出的记录：frontmatter 已取值、正文关系与里程碑已提取，关系还没对卡集合求解。 */
export interface CardRecord {
  /** 卡身份 = 文件名去掉 `.mdx` / `.md` */
  id: string;
  /** 相对卡目录的文件路径 */
  path: string;
  /** frontmatter 的 type 原样取值；`root` 是唯一被读出含义的取值 */
  type: string | null;
  parent: string[];
  domain: string | null;
  /** 标题：卡页、星轨盘、卡集合同一条规则，见 titleOf */
  label: string;
  bornAt: string;
  relations: Relation[];
  /** 仅根卡有，非根卡恒 null */
  milestones: Milestone[] | null;
}

/** 一条病：形状（坏 born-at、该写单个值的写成列表、该写列表的写成单个值）、存在性（缺 born-at / label，非根卡缺 parent）、
 * 一致性（根卡几张、parent 指不指向根卡、关系指不指向星轨盘上的卡、同一身份两个文件）、关系行与里程碑行格式不对、
 * frontmatter 读不出来，以及卡正文里出现钉码记号。 */
export interface Problem {
  field: "born-at" | "parent" | "type" | "label" | "domain" | "relation" | "milestone" | "file" | "docfirst";
  value: string;
  /** 给人看的说明 */
  reason: string;
}

/** 一个文件的病，按文件归拢。 */
export interface SickFile {
  path: string;
  problems: Problem[];
}

/** 一个文件单独解析的结果。卡体系字段一个都没有的文件不是卡，card 为 null；frontmatter 读不出来时 card 也是 null、problems 里有一条 file 病 */
export interface ParsedFile {
  /** 页面标题：卡与不是卡的页同一条规则，见 titleOf */
  title: string;
  description: string | null;
  card: CardRecord | null;
  problems: Problem[];
}

/** 一个卡文件单独能查出的全部：解析结果加正文里的钉码记号病。卡集合把它存进每一页的数据，汇总时不用再读正文 */
export interface CardFileReading extends ParsedFile {
  /** 卡目录里的文件名 */
  name: string;
  pinMarkProblems: Problem[];
}

/** 一批卡汇总的结果：星轨盘的中性输入，加上病卡清单。有病但画得出来的卡照样在 cards 里。 */
export interface CardScan extends DiskInput {
  sick: SickFile[];
}
