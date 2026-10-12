/** 我开的合并请求有了什么变化：被要求修改，或有了新评论 */
export const pullUpdateChanges = ['changes-requested', 'new-comment'] as const
export type PullUpdateChange = (typeof pullUpdateChanges)[number]

/** @ 我的那段话写在评论还是回复里 */
export const mentionPlaces = ['comment', 'reply'] as const
export type MentionPlace = (typeof mentionPlaces)[number]

/**
 * 一条通知除 id 以外的事实，按 kind 分。人都只写人员 id（协作站里就是 Gitea 用户名），显示名由短句的调用方传入 nameOf 去换。
 * mention、reply 的 comment 是评论文件「评论串/文件名」，page 是点了去的站内地址（带 ?comment=<评论串>）
 */
export type NotificationFacts =
  | { kind: 'unsubmitted'; records: string[]; siteFiles: string[] }
  | { kind: 'conflicts'; files: string[] }
  | { kind: 'submit-failure'; message: string; at: string }
  | { kind: 'sync-problem'; reason: string }
  | { kind: 'check-error'; message: string }
  | { kind: 'off-main'; branch: string | null }
  | { kind: 'record-problem'; file: string; message: string }
  | { kind: 'webhook-setup'; organization: string; problems: string[] }
  | { kind: 'unpushed'; repo: string; count: number }
  | { kind: 'unpulled'; repo: string; count: number }
  | { kind: 'diverged'; repo: string; ahead: number; behind: number }
  | { kind: 'pull-to-review'; repo: string; number: number; title: string; poster: string; url: string }
  | { kind: 'issue-to-answer'; repo: string; number: number; title: string; poster: string; lastSpeaker: string; url: string }
  | { kind: 'my-pull-update'; repo: string; number: number; title: string; change: PullUpdateChange; by: string; url: string }
  | { kind: 'my-issue-answered'; repo: string; number: number; title: string; by: string; url: string }
  | { kind: 'repo-setup'; repo: string; problems: string[] }
  | { kind: 'task'; recordId: string; title: string; due: string | null; detail: string | null }
  | { kind: 'mention'; comment: string; author: string; page: string; text: string; in: MentionPlace }
  | { kind: 'reply'; comment: string; author: string; page: string; text: string; threadId: string }

/** 一条通知：只带事实，句子、去处、分组都按 kind 从字段算 */
export type Notification = { id: string } & NotificationFacts

export type NotificationKind = NotificationFacts['kind']
export type NotificationOfKind<K extends NotificationKind> = Extract<Notification, { kind: K }>

/** 三组的显示顺序 */
export const notificationGroups = ['collab-repo', 'other-repos', 'for-me'] as const
export type NotificationGroup = (typeof notificationGroups)[number]

/** 全部 kind，按组的顺序、组内按显示顺序 */
export const notificationKinds = [
  'unsubmitted',
  'conflicts',
  'submit-failure',
  'sync-problem',
  'check-error',
  'off-main',
  'record-problem',
  'webhook-setup',
  'unpushed',
  'unpulled',
  'diverged',
  'pull-to-review',
  'issue-to-answer',
  'my-pull-update',
  'my-issue-answered',
  'repo-setup',
  'task',
  'mention',
  'reply',
] as const satisfies readonly NotificationKind[]

const groupOfKind = {
  unsubmitted: 'collab-repo',
  conflicts: 'collab-repo',
  'submit-failure': 'collab-repo',
  'sync-problem': 'collab-repo',
  'check-error': 'collab-repo',
  'off-main': 'collab-repo',
  'record-problem': 'collab-repo',
  'webhook-setup': 'collab-repo',
  unpushed: 'other-repos',
  unpulled: 'other-repos',
  diverged: 'other-repos',
  'pull-to-review': 'other-repos',
  'issue-to-answer': 'other-repos',
  'my-pull-update': 'other-repos',
  'my-issue-answered': 'other-repos',
  'repo-setup': 'other-repos',
  task: 'for-me',
  mention: 'for-me',
  reply: 'for-me',
} as const satisfies Record<NotificationKind, NotificationGroup>

export function notificationGroupOf({ kind }: { kind: NotificationKind }): NotificationGroup {
  return groupOfKind[kind]
}

/** 同一件事在状态更新前后算出同一个 id */
export function notificationIdOf(facts: NotificationFacts): string {
  switch (facts.kind) {
    // 这几种在一个项目里至多一条，kind 本身就能区分
    case 'unsubmitted':
    case 'conflicts':
    case 'submit-failure':
    case 'sync-problem':
    case 'check-error':
    case 'off-main':
      return facts.kind
    case 'record-problem':
      return `record-problem:${facts.file}:${facts.message}`
    case 'webhook-setup':
      return `webhook-setup:${facts.organization}`
    case 'unpushed':
    case 'unpulled':
    case 'diverged':
    case 'repo-setup':
      return `${facts.kind}:${facts.repo}`
    case 'pull-to-review':
    case 'issue-to-answer':
    case 'my-issue-answered':
      return `${facts.kind}:${facts.repo}#${facts.number}`
    // 从「有新评论」变成「被要求修改」是另一件要告诉我的事
    case 'my-pull-update':
      return `my-pull-update:${facts.repo}#${facts.number}:${facts.change}`
    case 'task':
      return `task:${facts.recordId}`
    case 'mention':
    case 'reply':
      return `${facts.kind}:${facts.comment}`
  }
}

/** 造一条通知：id 由 notificationIdOf 算，调用方不自己拼 */
export function notificationOf(facts: NotificationFacts): Notification {
  return { id: notificationIdOf(facts), ...facts }
}

/** 点了去哪：一条任务或模块（记录 id）、站内地址、外部网址；null 是没有可去的地方，只显示短句 */
export type NotificationTarget = { record: string } | { page: string } | { url: string } | null

export function notificationTargetOf(notification: Notification): NotificationTarget {
  switch (notification.kind) {
    case 'pull-to-review':
    case 'issue-to-answer':
    case 'my-pull-update':
    case 'my-issue-answered':
      return { url: notification.url }
    case 'task':
      return { record: notification.recordId }
    case 'mention':
    case 'reply':
      return { page: notification.page }
    case 'unsubmitted':
    case 'conflicts':
    case 'submit-failure':
    case 'sync-problem':
    case 'check-error':
    case 'off-main':
    case 'record-problem':
    case 'webhook-setup':
    case 'unpushed':
    case 'unpulled':
    case 'diverged':
    case 'repo-setup':
      return null
  }
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 按组的显示顺序排，组内按 kind 的顺序、再按 id；不改传入的数组 */
export function sortedNotifications(notifications: readonly Notification[]): Notification[] {
  const groupRank = (notification: Notification) => notificationGroups.indexOf(notificationGroupOf(notification))
  const kindRank = (notification: Notification) => notificationKinds.indexOf(notification.kind)
  return [...notifications].sort((a, b) => groupRank(a) - groupRank(b) || kindRank(a) - kindRank(b) || compareIds(a.id, b.id))
}

/** 各组几条：网站提示栏收起时与协作窗格都用它 */
export function notificationCountsOf(notifications: readonly Notification[]): Record<NotificationGroup, number> {
  const counts: Record<NotificationGroup, number> = { 'collab-repo': 0, 'other-repos': 0, 'for-me': 0 }
  for (const notification of notifications) counts[notificationGroupOf(notification)] += 1
  return counts
}
