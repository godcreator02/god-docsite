/** pin-kinds.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface PinKind {
  id: string;
  label: string;
  text: string;
  paneTitle: string;
  code: string[];
  start: number;
  highlight: [number, number] | null;
  before: string;
  after: string;
}

export declare const pinnedFile: string;
export declare const spanLines: string[];
export declare const fileLines: string[];
export declare const treeNames: string[];
export declare const kinds: PinKind[];
