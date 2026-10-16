/** qq-timing.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface ExampleNotification {
  id: string
  sentence: string
  checkError: string
}

export interface TimelineFacts {
  totalSeconds: number
  appearAt: number
  sendAfter: number
  failAt: number
  recoverAt: number
  ticks: number[]
}

export interface ChapterData {
  title: string
  text: string
  duration: number
}

export declare const presentForMillisecondsBeforeSending: number
export declare const sentNotificationsDocKey: string
export declare const silentKinds: string[]
export declare const disappearanceRule: string
export declare const sendRule: string
export declare const refreshedOnceRule: string
export declare const exampleNotification: ExampleNotification
export declare const chatLines: string[]
export declare const timeline: TimelineFacts
export declare const chapters: ChapterData[]
