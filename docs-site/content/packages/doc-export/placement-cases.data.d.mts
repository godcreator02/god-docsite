/** placement-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */
import type { Tone } from '@godcreator/explainer/site';

export interface PlacementCase {
  id: string;
  label: string;
  text: string;
  /** 配置里那一项的写法 */
  config: string[];
  /** 右块标题栏的状态；bad 时为空，画面摆拒绝状态 */
  status: string | null;
  tone: Tone;
  artifact: { title: string; lines: string[]; highlight: [number, number] | null } | null;
}

export declare const skillHead: string[];
export declare const plainHead: string[];
export declare const badRefusal: { pill: string; why: string };
export declare const cases: PlacementCase[];
