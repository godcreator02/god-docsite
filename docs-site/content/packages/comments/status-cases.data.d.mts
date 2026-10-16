/** status-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface StatusCase {
  id: string;
  label: string;
  /** 串头状态那几行的旧样子（重复标的情况不给，文件不动） */
  old?: string[];
  /** 串头状态那几行的新样子 */
  now?: string[];
  /** true：重复标被拒（409），摆胶囊与原话，不摆 Diff */
  rejected?: boolean;
  text: string;
}

export declare const headPath: string;
export declare const resolvedBy: string;
export declare const resolvedAt: string;
export declare const openLines: string[];
export declare const resolvedLines: string[];
export declare const rejectedMessage: string;
export declare const cases: StatusCase[];
