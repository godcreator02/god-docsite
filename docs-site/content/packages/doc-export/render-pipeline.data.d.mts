/** render-pipeline.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */
import type { Tone } from '@godcreator/explainer/site';

export interface Mark {
  /** 正本里要标出的行段（含两端） */
  lines: [number, number];
  tone: Tone;
  note: string;
}

export type StepArtifact =
  | { kind: 'nodes' }
  | { kind: 'pin' }
  | { kind: 'refusals' }
  | { kind: 'markdown' }
  | { kind: 'placements' }
  | { kind: 'disk' };

export interface RenderStep {
  title: string;
  text: string;
  marks: Mark[];
  artifact: StepArtifact;
}

export interface DiskRow {
  when: string;
  to: string;
  status: string;
  tone: Tone;
}

export declare const greetLines: string[];
export declare const sourceLines: string[];
export declare const parsedNodes: string[];
export declare const pinPill: string;
export declare const refusalChecks: Array<{ name: string; result: string }>;
export declare const refusalExamples: string[];
export declare const bodySegments: Array<{ tone: Tone | null; lines: string[] }>;
export declare const placementViews: {
  skill: { title: string; headLines: string[]; highlight: [number, number] };
  plain: { title: string; firstLine: string };
  bad: { title: string; pill: string };
  more: string;
};
export declare const firstWriteRows: DiskRow[];
export declare const recheckRows: DiskRow[];
export declare const steps: RenderStep[];
