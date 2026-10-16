/** mode-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** 组装结果卡片里的一行：mono 为 true 时用等宽字体摆原话 */
export interface ResultLine {
  text: string;
  mono?: boolean;
}

export interface ModeCase {
  id: string;
  label: string;
  text: string;
  /** 画面底部一行胶囊写的模式与调用方 */
  mode: string;
  /** 左卡片摆的章 b 里那处引用（JSON 行） */
  refLines: string[];
  /** CodeLines 要高亮的行（1 起的 [起, 止]），null 不高亮 */
  highlight: [number, number] | null;
  tone: 'good' | 'warn' | 'bad';
  /** 右卡片标题旁的结论胶囊 */
  pill: string;
  lines: ResultLine[];
}

export declare const refWithLabel: string[];
export declare const refWithoutLabel: string[];

export declare const outcomes: {
  completeLabel: string;
  warning: string;
  error: string;
};

export declare const cases: ModeCase[];
