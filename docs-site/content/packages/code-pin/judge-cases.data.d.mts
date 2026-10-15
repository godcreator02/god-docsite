/** judge-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type TrailState = 'yes' | 'no' | 'skip';
export type Status = 'fresh' | 'changed' | 'missing';
export type ConfirmAction = 'unchanged' | 'moved' | 'needs-accept' | 'refused';

export interface JudgeCase {
  id: string;
  label: string;
  text: string;
  lines: string[];
  span: [number, number] | null;
  history: boolean;
  trail: { state: TrailState; note: string }[];
  status: Status;
  reason: 'changed' | 'vanished' | 'unlocated' | null;
  action: ConfirmAction;
  written: string;
}

export declare const stepNames: string[];
export declare const pinnedFile: string;
export declare const confirmedLines: string[];
export declare const confirmedSpan: [number, number];
export declare const cases: JudgeCase[];
