/** start-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type StepState = 'pass' | 'stop' | 'skip';
/** stop 的两种：reuse 回现状（info 色），refusal 拒绝或失败（bad 色） */
export type StopTone = 'reuse' | 'refusal';
export type Occupancy = 'none' | 'free' | 'taken';
export type SiteState = 'running' | 'stopped' | 'failed';

export interface StartStep {
  state: StepState;
  note: string;
  /** 只在 state 为 stop 时有：回现状还是拒绝或失败 */
  stopTone?: StopTone;
}

export interface AfterLine {
  state: SiteState;
  url: string | null;
  error: string | null;
  /** 两行并存时的标签（如「进程退出后」「再 start 后」） */
  label?: string;
  /** 状态之外的补充（如「只启动过一次」） */
  note?: string;
}

export interface StartCase {
  id: string;
  label: string;
  text: string;
  portsBefore: { port: number | null; occupancy: Occupancy };
  portsAfter: { port: number | null; note: string };
  steps: StartStep[];
  /** 第 ④ 步走到时启动的命令；没走到是 null */
  command: string | null;
  /** refused 情况：第 ② 步下面列出的四条原话 */
  refusals?: string[];
  result: { error: boolean; value: string };
  after: AfterLine[];
}

export declare const siteDir: string;
export declare const identityCode: string;
export declare const stepNames: string[];
export declare const envLine: string;
export declare const refusalMessages: string[];
export declare const cases: StartCase[];
