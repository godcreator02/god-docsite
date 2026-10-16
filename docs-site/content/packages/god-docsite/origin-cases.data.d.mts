/** origin-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */
import type { Tone } from '@godcreator/explainer/site';

/** 一种环境变量在这种情况下的样子；present 为 false 时整行灰掉，写 note */
export interface OriginVar {
  name: string;
  value: string | null;
  present: boolean;
  note: string;
}

export interface OriginCheck {
  tone: Tone;
  text: string;
}

export interface OriginCase {
  id: string;
  label: string;
  text: string;
  /** 站点进程的模式（siteOrigin 的第一个参数） */
  mode: string;
  vars: OriginVar[];
  /** 算出的可信 origin（good）或报错原话（bad） */
  outcome: { tone: Tone; lines: string[] };
  /** 浏览器发来的 Origin 对上与对不上各一次（只有 dev 情况有） */
  checks: OriginCheck[];
}

export declare const cases: OriginCase[];
