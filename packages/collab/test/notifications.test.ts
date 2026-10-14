import { describe, expect, it } from 'vitest'
import { notificationOriginalTextOf, notificationSentenceOf } from '../src/notification-model/notification-text.js'
import {
  notificationCountsOf,
  notificationGroupOf,
  notificationIdOf,
  notificationKinds,
  notificationOf,
  notificationTargetOf,
  sortedNotifications,
  type NotificationFacts,
} from '../src/notification-model/notifications.js'
import { expectations, nameOf, pullUrl } from './notification-examples.js'

describe('通知模型：每种通知', () => {
  it('kind 共 19 种、不重复，例子覆盖了全部', () => {
    expect(new Set(notificationKinds).size).toBe(19)
    expect(new Set(expectations.map(({ facts }) => facts.kind))).toEqual(new Set(notificationKinds))
  })

  it.each(expectations.map((expected) => [expected.id, expected.sentence, expected] as const))('%s：%s', (_id, _sentence, expected) => {
    const notification = notificationOf(expected.facts)
    expect(notification).toEqual({ id: expected.id, ...expected.facts })
    expect(notificationGroupOf(notification)).toBe(expected.group)
    expect(notificationSentenceOf(notification, nameOf)).toBe(expected.sentence)
    expect(notificationOriginalTextOf(notification)).toBe(expected.original)
    expect(notificationTargetOf(notification)).toEqual(expected.target)
  })

  it('同一件事的 id 不随别的字段变：合并请求改了标题、任务改了截止日期，id 不变', () => {
    const pull: NotificationFacts = { kind: 'pull-to-review', repo: 'datasheets', number: 4, title: '补器件表', poster: 'chenhao', url: pullUrl }
    expect(notificationIdOf({ ...pull, title: '补器件表与封装' })).toBe(notificationIdOf(pull))
    const task: NotificationFacts = { kind: 'task', recordId: 'r1', title: '画机柜', due: null, detail: null }
    expect(notificationIdOf({ ...task, due: '2026-10-20' })).toBe('task:r1')
  })

  it('不同的事 id 不同：同一个仓的未推送与未拉取、不同编号的合并请求', () => {
    expect(notificationIdOf({ kind: 'unpushed', repo: 'datasheets', count: 1 })).not.toBe(notificationIdOf({ kind: 'unpulled', repo: 'datasheets', count: 1 }))
    expect(notificationIdOf({ kind: 'pull-to-review', repo: 'datasheets', number: 4, title: 't', poster: 'carol', url: pullUrl })).not.toBe(
      notificationIdOf({ kind: 'pull-to-review', repo: 'datasheets', number: 5, title: 't', poster: 'carol', url: pullUrl }),
    )
  })
})

describe('通知模型：排序与计数', () => {
  const task = notificationOf({ kind: 'task', recordId: 'r1', title: '画机柜', due: null, detail: null })
  const reply = notificationOf({ kind: 'reply', comment: 'c1/r3.mdx', author: 'carol', page: '/plan?comment=c1', text: '好', threadId: 'c1' })
  const unpushedFirmware = notificationOf({ kind: 'unpushed', repo: 'firmware', count: 1 })
  const unpushedDatasheets = notificationOf({ kind: 'unpushed', repo: 'datasheets', count: 2 })
  const repoSetup = notificationOf({ kind: 'repo-setup', repo: 'datasheets', problems: ['main 没有保护'] })
  const webhook = notificationOf({ kind: 'webhook-setup', organization: 'hybrid-mmc', problems: ['没有 webhook'] })
  const unsubmitted = notificationOf({ kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] })

  it('按组的顺序排，组内按 kind 的顺序、再按 id；不改传入的数组', () => {
    const shuffled = [reply, unpushedFirmware, task, webhook, repoSetup, unsubmitted, unpushedDatasheets]
    const before = [...shuffled]
    expect(sortedNotifications(shuffled)).toEqual([unsubmitted, webhook, unpushedDatasheets, unpushedFirmware, repoSetup, task, reply])
    expect(shuffled).toEqual(before)
  })

  it('各组几条；没有的组是 0', () => {
    expect(notificationCountsOf([reply, unpushedFirmware, task, repoSetup, unpushedDatasheets])).toEqual({ 'collab-repo': 0, 'other-repos': 3, 'for-me': 2 })
    expect(notificationCountsOf([])).toEqual({ 'collab-repo': 0, 'other-repos': 0, 'for-me': 0 })
  })
})
