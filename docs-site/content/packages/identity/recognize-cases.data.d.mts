/** recognize-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface RecognizeMachine {
  runMode: 'dev' | 'start';
  /** 环境变量里的码，没有设是 null */
  code: string | null;
  /** 发布版（start）不看环境变量里的码 */
  ignored: boolean;
}

export interface RecognizedPerson {
  id: string;
  name: string;
  /** 头像上显示的字：名字的第一个字（Avatar 的画法） */
  initial: string;
}

export interface RecognizeCase {
  id: string;
  label: string;
  text: string;
  machine: RecognizeMachine;
  /** 名单里命中的行号，没有命中（只读）是 null */
  hitLine: number | null;
  /** 认出的人（侧栏底部显示头像与名字），只读时是 null */
  person: RecognizedPerson | null;
  /** 只读原因的原文，认出人时是 null */
  reason: string | null;
}

export declare const peopleLines: string[];
export declare const envName: string;
export declare const cases: RecognizeCase[];
