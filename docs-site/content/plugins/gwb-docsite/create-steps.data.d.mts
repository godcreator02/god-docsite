/** create-steps.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 卡片行的语气：code 是照文件内容写的等宽行，none 是说明 */
export type LineTone = 'none' | 'good' | 'bad' | 'code';

export interface StepLine {
  tone: LineTone;
  text: string;
}

export type TermLine = { text: string; kind?: 'cmd' | 'out' | 'ok' | 'err' };

export type StepPane =
  | { kind: 'pane'; title: string; icon: 'file' | 'folder'; lines: StepLine[] }
  | { kind: 'terminal'; title: string; lines: TermLine[] };

export interface TreeNode {
  id: string;
  name: string;
  depth: number;
  dir?: boolean;
  /** 第几步出现 */
  step: number;
  note?: string;
  /** 哪几步改写了它（不是新文件） */
  modifiedSteps?: number[];
}

export interface CreateStep {
  title: string;
  /** 第 5 步起为 true：docfirst.create 多做的，画面上标一个胶囊 */
  pill: boolean;
  pane: StepPane;
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const initialPeopleEntry: { id: string; name: string; agent: boolean };
export declare const docfirstScripts: Record<string, string>;
export declare const docfirstTemplateFiles: string[];
export declare const treeNodes: TreeNode[];
export declare const steps: CreateStep[];
