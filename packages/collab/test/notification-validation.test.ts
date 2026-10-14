import { describe, expect, it } from 'vitest'
import { checkedNotificationsOf } from '../src/core/notifications/notification-validation.js'
import { InvalidSiteFeed } from '../src/core/notifications/shape-checks.js'
import { notificationOf } from '../src/core/notifications/notifications.js'
import { expectations } from './notification-examples.js'

const everyKind = expectations.map(({ facts }) => notificationOf(facts))
const pull = notificationOf({ kind: 'pull-to-review', repo: 'datasheets', number: 4, title: '补器件表', poster: 'chenhao', url: 'https://git.example/p/4' })
const task = notificationOf({ kind: 'task', recordId: 'r1', title: '画机柜', due: null, detail: null })

describe('交来的通知列表', () => {
  it('每种 kind 形状对的原样收下', () => {
    expect(checkedNotificationsOf(JSON.parse(JSON.stringify(everyKind)))).toEqual(everyKind)
  })

  it('空列表收下', () => {
    expect(checkedNotificationsOf([])).toEqual([])
  })

  it.each([
    ['不是数组', { notifications: [] }, /^notifications 要是数组$/],
    ['一条不是对象', [task, 'task:r1'], /^notifications\[1\] 要是对象$/],
    ['一条没有 kind', [{ id: 'x', repo: 'datasheets' }], /^notifications\[0\] 里缺字段 kind$/],
    ['kind 认不出', [pull, { ...task, kind: 'repo-drift' }], /^notifications\[1\]\.kind 要是 unsubmitted \/ .* 之一，收到 "repo-drift"$/],
    ['多了字段', [{ ...pull, sentence: '等你审阅' }], /^notifications\[0\] 里认不出的字段 sentence$/],
    ['带着别的 kind 的字段', [{ ...task, repo: 'datasheets' }], /^notifications\[0\] 里认不出的字段 repo$/],
    ['少了字段', [{ id: pull.id, kind: pull.kind, repo: 'datasheets', number: 4, title: '补器件表', url: 'https://git.example/p/4' }], /^notifications\[0\] 里缺字段 poster$/],
    ['少了 id', [{ kind: 'conflicts', files: [] }], /^notifications\[0\] 里缺字段 id$/],
    ['id 不是字符串', [{ ...task, id: 1 }], /^notifications\[0\]\.id 要是字符串，收到 1$/],
    ['仓名不是字符串', [task, { ...pull, repo: 3 }], /^notifications\[1\]\.repo 要是字符串，收到 3$/],
    ['编号不是整数', [{ ...pull, number: 4.5 }], /^notifications\[0\]\.number 要是非负整数，收到 4\.5$/],
    ['提交数是负数', [{ id: 'unpushed:a', kind: 'unpushed', repo: 'a', count: -1 }], /^notifications\[0\]\.count 要是非负整数，收到 -1$/],
    ['文件清单不是字符串数组', [{ id: 'conflicts', kind: 'conflicts', files: ['a', 2] }], /^notifications\[0\]\.files 要是字符串数组$/],
    ['截止日期不是字符串也不是 null', [{ ...task, due: 20261020 }], /^notifications\[0\]\.due 要是字符串，收到 20261020$/],
    ['分支不是字符串也不是 null', [{ id: 'off-main', kind: 'off-main', branch: false }], /^notifications\[0\]\.branch 要是字符串，收到 false$/],
    [
      '合并请求的变化认不出',
      [{ id: 'my-pull-update:a#1:merged', kind: 'my-pull-update', repo: 'a', number: 1, title: 't', change: 'merged', by: 'carol', url: 'u' }],
      /^notifications\[0\]\.change 要是 changes-requested \/ new-comment 之一，收到 "merged"$/,
    ],
    [
      '@ 我的地方认不出',
      [{ id: 'mention:c1/index.mdx', kind: 'mention', comment: 'c1/index.mdx', author: 'carol', page: '/p?comment=c1', text: '@chenhao', in: 'page' }],
      /^notifications\[0\]\.in 要是 comment \/ reply 之一，收到 "page"$/,
    ],
  ])('%s：拒收并写明第几条的哪个字段', (_label, value, message) => {
    expect(() => checkedNotificationsOf(value)).toThrow(InvalidSiteFeed)
    expect(() => checkedNotificationsOf(value)).toThrow(message)
  })
})
