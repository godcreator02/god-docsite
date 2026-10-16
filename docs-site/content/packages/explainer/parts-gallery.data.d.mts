/** parts-gallery.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */
import type { Role, Tone } from '@godcreator/explainer/site';

export interface PartCard {
  /** 零件名（site 出口里的组件名） */
  name: string;
  /** 画什么 */
  what: string;
  /** 本站页面里真实用过的最小写法，等宽字摆在格底 */
  usage: string;
}

export interface ToneSwatch {
  name: Tone;
  /** 这个语气的颜色中文名 */
  word: string;
}

export interface RoleSwatch {
  name: Role;
  /** 本站页面上真用这个颜色的标题栏文字 */
  title: string;
}

export declare const parts: PartCard[];
export declare const tones: ToneSwatch[];
export declare const roles: RoleSwatch[];
export declare const diffSides: { old: string[]; now: string[] };
export declare const terminalLines: string[];
export declare const codeLines: string[];
export declare const codeSpan: [number, number];
export declare const paneSteps: string[];
