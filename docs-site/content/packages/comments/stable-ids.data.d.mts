/** stable-ids.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface IdBlock {
  /** 段落文字 */
  text: string;
  /** 这一段分到的稳定 id（dc- 加指纹，同页相同的加 -2、-3） */
  id: string;
  /** 与上一情况比变了的 id：画面上用 warn 色 */
  changed?: boolean;
  /** 新插进来的那一段 */
  inserted?: boolean;
}

export interface StableIdCase {
  id: string;
  label: string;
  blocks: IdBlock[];
  /** true：后缀错位是协议已知的边界，画面上标 warn 胶囊 */
  knownEdge?: boolean;
  text: string;
}

export declare const paragraphs: {
  a: { text: string; fingerprint: string };
  b: { text: string; fingerprint: string };
  bChanged: { text: string; fingerprint: string };
};
export declare const cases: StableIdCase[];
