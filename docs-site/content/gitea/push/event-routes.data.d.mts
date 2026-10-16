/** event-routes.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface ChainCard {
  /** 这张卡的环节名（卡片标题） */
  title: string;
  /** 这个环节手里的真实东西 */
  lines: string[];
}

export interface EventCase {
  id: string;
  label: string;
  text: string;
  chain: ChainCard[];
}

export declare const templates: { title: string; body: string };

export declare const debounceMilliseconds: number;

export declare const splitByRepo: string;

export declare const collabSide: string;

export declare const otherSide: string;

export declare const unknownWarn: string;

export declare const footer: string;

export declare const cases: EventCase[];
