import {
  mentionPlaces,
  notificationKinds,
  pullUpdateChanges,
  type MentionPlace,
  type Notification,
  type NotificationKind,
  type NotificationOfKind,
  type PullUpdateChange,
} from './notifications.js'
import { countOf, fieldsOf, InvalidSiteFeed, objectOf, oneOf, textOf, textOrNullOf, textsOf, type FieldCheck } from './shape-checks.js'

type FieldChecksOf<K extends NotificationKind> = { [F in Exclude<keyof NotificationOfKind<K>, 'id' | 'kind'>]-?: FieldCheck<NotificationOfKind<K>[F]> }

const pullUpdateChangeOf: FieldCheck<PullUpdateChange> = (value, where) => oneOf(value, where, pullUpdateChanges)
const mentionPlaceOf: FieldCheck<MentionPlace> = (value, where) => oneOf(value, where, mentionPlaces)

/** 每种 kind 除 id、kind 以外的字段各怎么查：类型保证与 Notification 的字段一一对应 */
const fieldChecksByKind: { [K in NotificationKind]: FieldChecksOf<K> } = {
  unsubmitted: { records: textsOf, siteFiles: textsOf },
  conflicts: { files: textsOf },
  'submit-failure': { message: textOf, at: textOf },
  'sync-problem': { reason: textOf },
  'check-error': { message: textOf },
  'off-main': { branch: textOrNullOf },
  'record-problem': { file: textOf, message: textOf },
  'webhook-setup': { organization: textOf, problems: textsOf },
  unpushed: { repo: textOf, count: countOf },
  unpulled: { repo: textOf, count: countOf },
  diverged: { repo: textOf, ahead: countOf, behind: countOf },
  'pull-to-review': { repo: textOf, number: countOf, title: textOf, poster: textOf, url: textOf },
  'issue-to-answer': { repo: textOf, number: countOf, title: textOf, poster: textOf, lastSpeaker: textOf, url: textOf },
  'my-pull-update': { repo: textOf, number: countOf, title: textOf, change: pullUpdateChangeOf, by: textOf, url: textOf },
  'my-issue-answered': { repo: textOf, number: countOf, title: textOf, by: textOf, url: textOf },
  'repo-setup': { repo: textOf, problems: textsOf },
  task: { recordId: textOf, title: textOf, due: textOrNullOf, detail: textOrNullOf },
  mention: { comment: textOf, author: textOf, page: textOf, text: textOf, in: mentionPlaceOf },
  reply: { comment: textOf, author: textOf, page: textOf, text: textOf, threadId: textOf },
}

function checkedNotificationOf(value: unknown, where: string): Notification {
  const object = objectOf(value, where)
  if (!('kind' in object)) throw new InvalidSiteFeed(`${where} 里缺字段 kind`)
  const kind = oneOf(object['kind'], `${where}.kind`, notificationKinds)
  const fieldChecks: Record<string, FieldCheck<unknown>> = fieldChecksByKind[kind]
  const fields = fieldsOf(object, where, ['id', 'kind', ...Object.keys(fieldChecks)])
  const facts = Object.fromEntries(Object.entries(fieldChecks).map(([field, check]) => [field, check(fields[field], `${where}.${field}`)]))
  return { id: textOf(fields['id'], `${where}.id`), kind, ...facts } as Notification
}

/** 经 HTTP 交来的通知列表是外部输入：逐条按 kind 查字段，kind 认不出、字段多了少了、类型不对就抛 InvalidSiteFeed，写明是第几条的哪个字段 */
export function checkedNotificationsOf(value: unknown): Notification[] {
  if (!Array.isArray(value)) throw new InvalidSiteFeed('notifications 要是数组')
  return value.map((item, index) => checkedNotificationOf(item, `notifications[${index}]`))
}
