/** who-writes.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type StepState = 'pass' | 'readonly' | 'reject' | 'skip';

export interface Step {
  state: StepState;
  note: string;
}

export interface WhoWritesCase {
  id: string;
  label: string;
  text: string;
  machine: { runMode: 'dev' | 'start'; code: string | null; ignored: boolean };
  request: { origin: string; as: string | null };
  /** 名单里命中的行号（本机身份认出的那一项），没有命中是 null */
  hitLine: number | null;
  /** 代 agent 写时 as 指向的 agent id，其余是 null */
  asPointsAt: string | null;
  steps: Step[];
  outcome: { http: number; writes: string; detail: string; sidebar: string };
}

export declare const stepNames: string[];
export declare const peopleLines: string[];
export declare const trustedOrigin: string;
export declare const codeField: string;
export declare const cases: WhoWritesCase[];
