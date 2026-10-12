/**
 * docfirst 卡格式的类型：卡文件、一张卡解析出的记录、病卡，以及读完一个卡目录返回的结果——
 * 星轨盘要的中性输入（盘心加一组卡）加病卡清单。
 */

import type { DiskInput, Milestone, Relation } from "@godcreator/trajectory-disk";

/** 一个卡文件：`name` 是卡目录里的文件名（卡上记的 `path` 就是它）。 */
export interface CardFile {
  name: string;
  text: string;
}

/** 一张卡解析出的记录：frontmatter 已取值、正文关系与里程碑已提取，关系还没对卡集合求解。 */
export interface CardRecord {
  /** 卡身份 = 文件名去掉 `.mdx` / `.md` */
  id: string;
  /** 身份去掉前置日期段后的那一截，label 缺了用它 */
  title: string;
  /** 相对卡目录的文件路径 */
  path: string;
  /** frontmatter 的 type 原样取值；`root` 是唯一被读出含义的取值 */
  type: string | null;
  parent: string[];
  domain: string | null;
  /** frontmatter 的 label，缺了用 title */
  label: string;
  bornAt: string;
  relations: Relation[];
  /** 仅根卡有，非根卡恒 null */
  milestones: Milestone[] | null;
}

/** 一条病：形状（坏 born-at、该写单个值的写成列表、该写列表的写成单个值）、存在性（缺 born-at / label，非根卡缺 parent）、
 * 一致性（根卡几张、parent 指不指向根卡、关系指不指向星轨盘上的卡、同一身份两个文件）、关系行与里程碑行格式不对，
 * 以及卡正文里出现 docfirst 引用记号。 */
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

/** 读完一个卡目录：星轨盘的中性输入，加上病卡清单。有病但画得出来的卡照样在 cards 里。 */
export interface CardScan extends DiskInput {
  sick: SickFile[];
}
