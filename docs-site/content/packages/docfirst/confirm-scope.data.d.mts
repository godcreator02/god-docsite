/** confirm-scope.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface PageCard {
  /** 现状区里的文档身份（相对项目根） */
  doc: string;
  /** 卡片里展示的那处钉：路径与起止行 */
  pin: string;
  /** 这一篇现在是什么状态 */
  note: string;
}

export interface TermLine {
  text: string;
  /** ok 是 ✅ 的结果行，err 是报错；不写是普通输出 */
  kind?: 'out' | 'ok' | 'err';
}

export interface ConfirmCase {
  id: string;
  label: string;
  text: string;
  /** 终端第一行的命令（画面里加 $ 前缀） */
  command: string;
  /** 命令的输出，一行一项 */
  lines: TermLine[];
  /** 按 pages 的顺序：这一篇这次有没有被改写 */
  written: boolean[];
}

export declare const pages: PageCard[];
export declare const cases: ConfirmCase[];
