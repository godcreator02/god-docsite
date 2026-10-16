/** roster-rules.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 一边的一小段：几行代码，或一行画面标注（drop 的「（没有）」） */
export interface RuleSegment {
  lines?: string[];
  /** 第一行的行号（照正本里的行号接上） */
  start?: number;
  note?: string;
}

export interface RuleCase {
  id: string;
  label: string;
  text: string;
  left: RuleSegment[];
  /** null 表示这种情况整篇拒绝，画面摆拒绝原话 */
  right: RuleSegment[] | null;
}

export declare const treeSource: string[];
export declare const treeOutput: string[];
export declare const dropSource: string[];
export declare const dropOutput: RuleSegment[];
export declare const noteBlock: { source: string[]; output: string[] };
export declare const noteInline: { source: string[]; output: string[] };
export declare const unknownSource: { start: number; lines: string[] };
export declare const unknownRefusal: { pill: string; quote: string };
export declare const cases: RuleCase[];
