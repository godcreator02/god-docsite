/** loader-steps.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface SourceRef {
  /** 显示名（路径:行段） */
  file: string;
  /** GitHub 固定 tag 链接 */
  url: string;
}

export interface LoaderStep {
  title: string;
  /** 左边卡片的标题 */
  cardTitle: string;
  /** 左边卡片里这一步手里的数据 */
  lines: string[];
  /** 画面右侧的一句说明 */
  note: string;
  /** 这一步对应的源码段 */
  srcRef: SourceRef;
  /** 第二个源码段（第 2 步有两个），没有就不显示 */
  srcRef2?: SourceRef;
  /** 画面下方（外壳说明行）的讲解 */
  text: string;
}

export declare const SOURCE_BASE: string;

export declare const steps: LoaderStep[];
