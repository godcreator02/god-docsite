/** new-problems.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface Problem {
  file: string;
  message: string;
}

/** after 卡里每一行的归类：same 两边都有、new 这次带来、fixed 已修好（画出来划掉） */
export type ProblemKind = 'same' | 'new' | 'fixed';

export interface AfterLine extends Problem {
  kind: ProblemKind;
}

export declare const fileNameProblem: Problem;
export declare const formatProblem: Problem;
export declare const authorProblem: Problem;
export declare const after: AfterLine[];
export declare const blocked: Problem[];
export declare const note: string;

/** 图例的一行：状态点颜色与它的意思 */
export interface LegendItem {
  tone: 'pending' | 'bad' | 'good';
  label: string;
}

export declare const legend: LegendItem[];

export declare const text: string;
