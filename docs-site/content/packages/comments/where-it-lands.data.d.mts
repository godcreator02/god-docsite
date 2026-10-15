/** where-it-lands.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

import type { PageChar } from './example.data.mjs';

export type TrailState = 'yes' | 'no' | 'skip';
export type LandKind = 'text' | 'hidden' | 'missing';

/** 今天的正文怎么画：字格（可带高亮或「收起来了」的虚线格），或正文块（批的标题删了，用共用的 bodyBlocks） */
export type TodayView =
  | {
      kind: 'cells';
      chars: PageChar[];
      /** 高亮的格子（含两端）；null 是推算不出、不高亮 */
      highlight: [number, number] | null;
      tone?: 'good' | 'warn';
      /** 画成虚线框并调淡的格子（收进折叠块的字，含两端） */
      folded?: [number, number];
      /** 标题栏右端的胶囊（推算不出 / 收起来了） */
      todayExtra?: string;
    }
  | { kind: 'blocks' };

export interface LandCase {
  id: string;
  label: string;
  text: string;
  today: TodayView;
  kind: LandKind;
  /** text 且改过：结论胶囊用琥珀色 */
  changed?: boolean;
  inbox: '正文里' | '找不到原文';
  note: string;
  trail: { state: TrailState; note: string }[];
}

export declare const elementAnchorId: string;
export declare const stepNames: string[];
export declare const cases: LandCase[];
