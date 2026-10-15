/** chapter-assembly.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type FileId = 'root' | 'a' | 'b';

/** 「组装结果」小表的一行：左列 id 或键，右列值；chapter 只给编号表里的行，id 前画章色小圆点（a 蓝、b 紫） */
export interface ResultRow {
  key: string;
  value: string;
  chapter?: 'a' | 'b';
  /** 加粗这一行：第 3 步与第 5 步的 eq_b，同一个 id 从「式（2-1）」变成「式（1-1）」 */
  strong?: boolean;
}

/** 「组装结果」卡片里的一组两列小表 */
export interface ResultGroup {
  /** 组的小标题（如 sources、assets），只有一组时可以不给 */
  title?: string;
  rows: ResultRow[];
}

export interface AssemblyStep {
  title: string;
  text: string;
  /** 三张文件卡片各标哪一段（行号含两端），null 不标 */
  highlights: { root: [number, number] | null; a: [number, number] | null; b: [number, number] | null };
  /** 整张调淡的卡片（第 5 步：单独组装 b，入口与 a 不读） */
  dim: FileId[];
  /** 文件卡片标题栏的胶囊文字（第 2 步图片改名、第 5 步不读） */
  extra: { root?: string; a?: string; b?: string };
  groups: ResultGroup[];
  /** 第 5 步的提示：胶囊「提示 1 条」后面的灰字原文 */
  warning?: string;
  /** 第 5 步不写 externalLabel 时的报错原话 */
  errorWithoutExternalLabel?: string;
}

export declare const rootLines: string[];
export declare const aLines: string[];
export declare const bLines: string[];
export declare const steps: AssemblyStep[];
