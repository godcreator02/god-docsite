/** card-sorting.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type Dest = 'center' | 'cards' | 'sick';

export interface FileTag {
  mark: string;
  name: string;
  dest: Dest;
}

export interface MiniCard {
  mark: string;
  label: string;
  bornAt: string;
}

export interface SickCard extends MiniCard {
  reason: string;
}

export declare const files: FileTag[];
export declare const centerCard: MiniCard;
export declare const diskCards: MiniCard[];
export declare const sickCard: SickCard;
export declare const note: string;
