/** verify-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */
import type { Tone } from '@godcreator/explainer/site';

export type VerifyRight =
  /** 磁盘上有文件：lines 是它的开头几行；crlf 标在标题栏（true 是 CRLF、false 是 LF）；added 是比正本会写出的多出来的行号 */
  | { kind: 'lines'; lines: string[]; crlf: boolean; added?: readonly number[] }
  /** 落点还没有文件 */
  | { kind: 'missing' };

export interface VerifyCase {
  id: string;
  label: string;
  text: string;
  left: { lines: string[] };
  right: VerifyRight;
  status: string;
  tone: Tone;
}

export declare const headLines: string[];
export declare const tamperedLine: string;
export declare const crlfLines: string[];
export declare const cases: VerifyCase[];
