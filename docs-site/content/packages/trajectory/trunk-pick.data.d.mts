/** trunk-pick.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type Domain = '存储' | '界面';
export type EdgeKind = 'supersede' | 'pivot';

export interface TrunkNode {
  mark: string;
  date: string;
  domain: Domain;
  superseded: boolean;
}

export interface TrunkEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface CandidateTag {
  at: string;
  text: string;
}

export interface DomainFirst {
  name: Domain;
  first: string;
}

export interface StepItem {
  title: string;
  /** 外壳底部的一行短句 */
  text: string;
  /** 每步右边的一句说明 */
  note: string;
}

export declare const nodes: TrunkNode[];
export declare const edges: TrunkEdge[];
export declare const candidates: CandidateTag[];
export declare const verdicts: { trunk: string; subline: string };
export declare const domainOrder: DomainFirst[];
export declare const steps: StepItem[];
