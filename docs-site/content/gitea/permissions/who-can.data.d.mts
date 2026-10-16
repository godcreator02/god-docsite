/** who-can.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 横带的状态：pass 放行、block 拦下（加粗）、dim 不相关（灰掉） */
export type RowState = 'pass' | 'block' | 'dim';

export interface LayerRow {
  what: string;
  state: RowState;
}

export interface WhoCase {
  id: string;
  label: string;
  text: string;
  /** 四条横带，顺序同 layers */
  rows: LayerRow[];
  outcome: { tone: 'good' | 'bad'; label: string };
}

export declare const mainRules: { collab: string; other: string };

export declare const layers: Array<{ id: string; name: string }>;

export declare const cases: WhoCase[];
