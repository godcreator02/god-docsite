/** auto-merge.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs（docfirst 的机读规则要在 Node 里直接读它），类型写在这里 */

export type CheckState = 'ok' | 'bad' | 'skip';

export interface TermLine {
  text: string;
  kind: 'cmd' | 'out' | 'ok' | 'err';
}

export type Artifact =
  | { kind: 'term'; title: string; lines: TermLine[] }
  | { kind: 'code'; title: string; lines: string[]; highlight: [number, number] }
  | { kind: 'checks'; command: string; checks: { text: string; state: CheckState }[]; output: string }
  | { kind: 'merge'; request: string[]; result: string };

export interface RunStep {
  title: string;
  text: string;
  place: string;
  seams: number[];
  artifact: Artifact;
}

export interface Case {
  id: string;
  label: string;
  text: string;
  pulls: { n: number; state: 'merged' | 'commented' | 'closed'; note: string }[];
  checks: CheckState[];
  output: string[];
  file?: { title: string; lines: string[]; highlight: [number, number] };
}

export declare const stepNames: string[];
export declare const example: { person: string; lead: string; pull: number; repo: string; range: string };
export declare const columns: { id: string; title: string; role: string }[];
export declare const places: { id: string; column: string; name: string; detail: string }[];
export declare const checkNames: string[];
export declare const measuredCheckNames: string[];
export declare const checkCommand: string;
export declare const runSteps: RunStep[];
export declare const commentFrame: { head: string; tail: string };
export declare const cases: Case[];
