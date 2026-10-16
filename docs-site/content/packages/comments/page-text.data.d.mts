/** page-text.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 左卡的正文的 DOM：拼的例子，srOnlyText 在画面上划掉（不算进页面文字） */
export interface DomSource {
  headingOpen: string;
  srOnlyOpen: string;
  srOnlyText: string;
  srOnlyClose: string;
  headingClose: string;
  paraStrong: string;
  paraQuoted: string;
  paraImage: string;
}

export declare const dom: DomSource;
export declare const pageNote: string;
export declare const cells: { char: string; atomic?: boolean }[];
