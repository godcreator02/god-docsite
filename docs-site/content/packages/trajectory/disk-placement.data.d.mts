/** disk-placement.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type Verdict = 'center' | 'card' | 'sick';
export type TimelineRow = 'spine' | 'subline' | 'isolated';
export type EdgeKind = 'supersede' | 'pivot';
export type Domain = '存储' | '界面';

export interface StepItem {
  title: string;
  text: string;
}

export interface DiskSpec {
  halfSpan: number;
  hubRadius: number;
  hubLabel: string;
  markRadius: number;
  maxR: number;
}

export interface FileItem {
  mark: string;
  name: string;
  verdict: Verdict;
}

export interface TimelineCard {
  mark: string;
  day: number;
  row: TimelineRow;
  onSpine?: boolean;
  superseded?: boolean;
  evidence?: boolean;
  dx?: number;
}

export interface TimelineTick {
  day: number;
  label: string;
}

export interface EdgeItem {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface Candidate {
  tone: 'pending' | 'good';
  text: string;
  dot?: boolean;
}

export interface DayRing {
  date: string;
  r: number;
}

export interface Band {
  from: number;
  to: number;
  label: string;
}

export interface RadiusRow {
  date: string;
  eff: string;
  r: string;
}

export interface BoxRow {
  block: string;
  domain: Domain;
  span: string;
  slots: number;
  meanR: number;
  slotDeg: string;
  padDeg: string;
  width: string;
}

export interface DiskBox {
  name: string;
  domain: Domain;
  th0: number;
  th1: number;
  rMin: number;
  rMax: number;
}

export interface Place {
  mark: string;
  slot: string;
  angle: number;
  radius: number;
  labelAngle: number;
  labelR: number;
  domain: Domain;
  superseded?: boolean;
  evidence?: boolean;
  note: string;
}

export declare const steps: StepItem[];
export declare const disk: DiskSpec;
export declare const files: FileItem[];
export declare const filesNote: string;
export declare const timelineCards: TimelineCard[];
export declare const timelineTicks: TimelineTick[];
export declare const timelineNote: string;
export declare const edges: EdgeItem[];
export declare const candidates: Candidate[];
export declare const candidatesNote: string;
export declare const dayRings: DayRing[];
export declare const dateTags: DayRing[];
export declare const foldBand: Band;
export declare const widenBand: Band;
export declare const radiusRows: RadiusRow[];
export declare const radiusNote: string;
export declare const boxRows: BoxRow[];
export declare const packingNotes: string[];
export declare const diskBoxes: DiskBox[];
export declare const seamLabel: string;
export declare const crossGapLabel: string;
export declare const places: Place[];
export declare const dodgeLabel: string;
export declare const constants: {
  slotArc: number;
  isoSlotArc: number;
  padArc: number;
  sameDomainGapDeg: number;
  crossDomainGapDeg: number;
  laneGapDays: number;
  crowdStepEff: number;
  axisSpan: number;
};
export declare const defaults: { hubBase: number; gapFreeDays: number; gapWideDays: number };
export declare const radiusAnchors: { firstRing: number; latestRing: number };
export declare const meanRadius: (rMin: number, rMax: number) => number;
export declare const angleOfSlot: (boxStartDeg: number, padDeg: number, slot: number, slotDeg: number) => number;
