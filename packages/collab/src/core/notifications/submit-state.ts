/**
 * 网站上的一键提交：站点与 gwb-collab 在推送通道的频道 collab-submit 上来回写同一份状态。
 * 网页点了按钮，站点写 requested；gwb-collab 带着令牌订阅着这个频道，接到后写 running、跑提交审核，合并了写 merged，失败了写 null
 * （失败的原话照旧变成 submit-failure 通知，在频道 collab 里）。AI 调 collab.submit 时 gwb-collab 也写 running 与结果，网页上一样看得到
 */
import type { Notification, NotificationKind } from './notifications.js'
import { countOf, fieldsOf, objectOf, oneOf, textOf } from './shape-checks.js'

export const submitChannel = 'collab-submit'

/** 一键提交此刻的状态：by 是发起的人员 id，at 是这一步的 ISO 时刻；merged 带上合并了的合并请求。null 是没有在提交 */
export type SubmitState =
  | { state: 'requested' | 'running'; by: string; at: string }
  | { state: 'merged'; by: string; at: string; pull: { number: number; url: string } }
  | null

const submitStates = ['requested', 'running', 'merged'] as const

/** 频道里的值是外部输入：按 SubmitState 的形状逐项查，不对就抛 InvalidSiteFeed */
export function submitStateOf(body: unknown): SubmitState {
  if (body === null) return null
  const state = oneOf(objectOf(body, '一键提交的状态')['state'], '一键提交的 state', submitStates)
  if (state !== 'merged') {
    const fields = fieldsOf(body, '一键提交的状态', ['state', 'by', 'at'])
    return { state, by: textOf(fields['by'], 'by'), at: textOf(fields['at'], 'at') }
  }
  const fields = fieldsOf(body, '一键提交的状态', ['state', 'by', 'at', 'pull'])
  const pull = fieldsOf(fields['pull'], 'pull', ['number', 'url'])
  return { state, by: textOf(fields['by'], 'by'), at: textOf(fields['at'], 'at'), pull: { number: countOf(pull['number'], 'pull.number'), url: textOf(pull['url'], 'pull.url') } }
}

/** 还在提交里：已经点了、等 gwb-collab 接手，或者正在跑 */
export function isSubmitInProgress(state: SubmitState): state is { state: 'requested' | 'running'; by: string; at: string } {
  return state !== null && state.state !== 'merged'
}

/** 有这几种通知时提交审核一定被拒，一键提交的按钮不能点：要先让 AI 照说明书处理 */
const blockingKinds = {
  conflicts: '合 main 的冲突还没改好',
  'off-main': '协作仓不在 main 上',
  'record-problem': 'collab/ 里有读不对的记录',
} as const satisfies Partial<Record<NotificationKind, string>>

function isBlockingKind(kind: NotificationKind): kind is keyof typeof blockingKinds {
  return kind in blockingKinds
}

/** 这批通知里挡住一键提交的原因，一种一句、不重复；空的就是能点 */
export function submitBlockersOf(notifications: readonly Notification[]): string[] {
  return [...new Set(notifications.flatMap(({ kind }) => (isBlockingKind(kind) ? [blockingKinds[kind]] : [])))]
}

/** 有没有本机还没提交审核的改动：一键提交的按钮只在有的时候出现 */
export function hasUnsubmittedChanges(notifications: readonly Notification[]): boolean {
  return notifications.some(({ kind }) => kind === 'unsubmitted')
}
