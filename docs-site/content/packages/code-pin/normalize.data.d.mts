/** normalize.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface HashRow {
  tone: 'good' | 'warn';
  left: string;
  right: string;
}

export declare const rawLines: string[];
export declare const normalizedLines: string[];
export declare const hashSample: string;
export declare const hashRows: HashRow[];
