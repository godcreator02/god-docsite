/** submit-stops.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export type StepState = 'ok' | 'bad' | 'skip'
export type EndId = 'merged' | 'untouched' | 'merging' | 'returned'
export type EndTone = 'good' | 'warn' | 'bad'

export interface ChangeGroup {
  /** 单组时是 null（文件路径当小标题）；conflict 的两组各写「bob 本机」「main 上」 */
  title: string | null
  /** 组标题后面的胶囊（conflict 的 main 组写「admin 先推的」） */
  pill?: string
  old: string[]
  now: string[]
}

export interface FileChange {
  path: string
  groups: ChangeGroup[]
}

export interface SubmitCase {
  id: string
  label: string
  text: string
  /** bob 的改动卡片：每个改到的文件一组 Diff；note 是卡片底部的灰字（merged 写 notes.txt 那句） */
  changes: { files: FileChange[]; note: string | null }
  steps: { state: StepState; note: string }[]
  end: EndId
  /** 「仓里留下什么」的一段灰字 */
  leftInRepo: string
  /** 拒绝原话（换行照样换行）；merged 为 null、摆回执 */
  error: string[] | null
  /** merged 的回执 */
  receipt: string[] | null
  /** 提示栏「协作仓」组的短句；pills 为空显示「没有新通知」，note 是 conflict 的那行灰字 */
  noticeBar: { pills: string[]; note: string | null }
}

export declare const verdictWait: { pollSeconds: number; timeoutSeconds: number }
export declare const steps: string[]
export declare const ends: Record<EndId, { text: string; tone: EndTone }>
export declare const cases: SubmitCase[]
