/** round-trip.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type LaneId = 'browser' | 'server' | 'disk';
export type LaneRole = 'blue' | 'violet' | 'emerald';

export interface Lane {
  id: LaneId;
  title: string;
  role: LaneRole;
}

/** 跨横道传的东西：gap 是两道之间的间隙（0 在浏览器与服务端之间、1 在服务端与磁盘之间） */
export interface StepFlow {
  gap: 0 | 1;
  dir: 'down' | 'up';
  label?: string;
}

export interface RoundTripStep {
  title: string;
  text: string;
  lane: LaneId;
  flow?: StepFlow;
}

export type RequestLine = { text: string; kind: 'cmd' | 'out' | 'ok' | 'err' };

export declare const lanes: Lane[];
export declare const anchorLines: string[];
export declare const requestLines: RequestLine[];
export declare const checks: string[];
export declare const checksNote: string;
export declare const threadFileLines: string[];
export declare const threadTreeLines: string[];
export declare const loaderLines: string[];
export declare const loaderAuthorLine: number;
export declare const loaderAuthorPill: string;
export declare const collectionNote: string;
export declare const inboxRow: { avatar: string; name: string; time: string; note: string };
export declare const steps: RoundTripStep[];
