/** sync-cases.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

/** pass 过、stop 停在这一格、dim 之后的不再问 */
export type GateState = 'pass' | 'stop' | 'dim'

export interface GateAnswer {
  state: GateState
  /** 这一格的答案；dim 的格子没有 */
  answer: string | null
}

export interface RepoRow {
  label: string
  value: string
  tone: 'good' | 'bad' | 'pending'
}

export interface NoticeBarData {
  pills: string[]
  note: string | null
  /** 通知点开的原文行 */
  original: readonly string[] | null
}

export interface SyncCase {
  id: string
  label: string
  text: string
  gates: GateAnswer[]
  merge: { state: GateState; note: string | null }
  repo: RepoRow[]
  /** fast-forward 的情况摆一行「动了依赖先装依赖」 */
  showDependencyNote?: boolean
  noticeBar: NoticeBarData
}

export interface Gate {
  id: string
  question: string
}

export declare const gates: Gate[]
export declare const mergeCommand: string
export declare const siteDependencyFiles: string[]
export declare const dependencyNote: string
export declare const reasons: { offMain: string; noOriginMain: string; merging: string; localAhead: string }
export declare const ffBlockedReason: string
export declare const noticeSentences: { conflicts: string; syncProblem: string; offMain: string }
export declare const suppressionNote: string
export declare const conflictFile: string
export declare const cases: SyncCase[]
