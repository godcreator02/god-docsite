/** anchor-kinds.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** mark：这一种情况在页面上批中的地方怎么标 */
export interface AnchorCase {
  id: string;
  label: string;
  /** 串头里 anchor 那几行（CodeLines 用，行号从 6 起，与页面 mdx 例子同一个位置） */
  anchorLines: string[];
  mark: 'page' | 'element' | 'text' | 'broken';
  text: string;
}

export declare const cases: AnchorCase[];
