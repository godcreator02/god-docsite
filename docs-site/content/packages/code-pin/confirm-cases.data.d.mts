/** confirm-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type VerdictTone = 'good' | 'pending' | 'warn' | 'bad';

export interface ConfirmCase {
  id: string;
  label: string;
  text: string;
  tone: VerdictTone;
  statusWord: string;
  statusNote: string;
  action: string;
  actionWord: string;
  writes: boolean;
  before?: string;
  after?: string;
  line?: string;
}

export declare const cases: ConfirmCase[];
