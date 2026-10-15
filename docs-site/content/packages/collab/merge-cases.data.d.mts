/** merge-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type CheckState = 'pass' | 'fail' | 'skipped';
export type Verdict = 'mergeable' | 'conflict' | 'needs-review';

export interface FileChange {
  /** 改到的文件，相对协作仓仓根 */
  path: string;
  /** 新文件：没有旧行，只有新行 */
  created?: boolean;
  old?: string[];
  now?: string[];
}

export interface ChangeSide {
  /** conflict 分「topic 上」「main 上」两组；只有一组时不写 */
  side?: string;
  /** 组标题后的胶囊（main 那组写「main 后来的提交」） */
  sideNote?: string;
  files: FileChange[];
}

export interface CheckVariant {
  /** 第 2 条分两种 authorIsLead 时的小行标签 */
  label: string;
  state: 'pass' | 'fail';
  note: string;
}

export interface CheckRow {
  state: CheckState;
  note: string;
  /** 分两种 authorIsLead 时各自的状态 */
  variants?: CheckVariant[];
}

export interface VerdictRow {
  /** 分两种 authorIsLead 的结论时，各自的标签 */
  label?: string;
  verdict: Verdict;
  exitCode: 0 | 1;
  /** 给人看的原话，能合并时为空 */
  problems: string[];
}

export interface MergeCase {
  id: string;
  label: string;
  text: string;
  changes: ChangeSide[];
  checks: [CheckRow, CheckRow];
  verdicts: VerdictRow[];
}

export declare const repo: {
  peopleFile: string;
  aliceEntryOld: string[];
  aliceEntryNew: string[];
  aliceTaskFile: string;
  taskTitleLineOld: string[];
  sitePackageFile: string;
  request: { base: string; head: string; authorIsLead: boolean; author: string };
};

export declare const checkNames: [string, string];

export declare const cases: MergeCase[];
