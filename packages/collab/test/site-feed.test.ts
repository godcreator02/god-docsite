import { describe, expect, it } from 'vitest'
import { notificationOf, sortedNotifications } from '../src/core/notifications/notifications.js'
import { InvalidSiteFeed, siteFeedOf } from '../src/core/notifications/site-feed.js'

const notifications = sortedNotifications([
  notificationOf({ kind: 'task', recordId: '20260926120000-abc1234', title: '画机柜', due: '2026-10-20', detail: '先画草图' }),
  notificationOf({ kind: 'unsubmitted', records: ['records/20260926120000-abc1234.json'], siteFiles: ['content/prototype.mdx'] }),
  notificationOf({ kind: 'unpulled', repo: 'datasheets', count: 2 }),
  notificationOf({ kind: 'pull-to-review', repo: 'datasheets', number: 4, title: '补器件表', poster: 'chenhao', url: 'https://git.example/hybrid-mmc/datasheets/pulls/4' }),
])
const projectLeads = ['godcreator', 'chenhao']

const valid = { notifications, projectLeads }

describe('gwb-collab 交来的站点状态', () => {
  it('形状对的原样收下', () => {
    expect(siteFeedOf(JSON.parse(JSON.stringify(valid)))).toEqual(valid)
  })

  it('没有通知时是空数组；还没读到项目负责人时 projectLeads 为 null', () => {
    expect(siteFeedOf({ notifications: [], projectLeads: null })).toEqual({ notifications: [], projectLeads: null })
  })

  it.each([
    ['不是对象', [], /^推来的数据 要是对象$/],
    ['多了认不出的字段', { ...valid, extra: 1 }, /^推来的数据 里认不出的字段 extra$/],
    ['还是旧的形状', { gitStatus: {}, attention: [], leads: null }, /^推来的数据 里认不出的字段 gitStatus$/],
    ['少了通知', { projectLeads }, /^推来的数据 里缺字段 notifications$/],
    ['少了项目负责人', { notifications }, /^推来的数据 里缺字段 projectLeads$/],
    ['通知不是数组', { ...valid, notifications: {} }, /^notifications 要是数组$/],
    ['一条通知的字段不对', { ...valid, notifications: [notifications[0], { ...notifications[1], kind: 'repo-drift' }] }, /^notifications\[1\]\.kind 要是 unsubmitted \/ .* 之一，收到 "repo-drift"$/],
    ['项目负责人不是字符串数组', { ...valid, projectLeads: 'godcreator' }, /^projectLeads 要是字符串数组$/],
    ['项目负责人写成了旧的按仓分开的形状', { ...valid, projectLeads: { project: ['godcreator'], repos: {} } }, /^projectLeads 要是字符串数组$/],
  ])('%s：拒收并写明哪一项', (_label, body, message) => {
    expect(() => siteFeedOf(body)).toThrow(InvalidSiteFeed)
    expect(() => siteFeedOf(body)).toThrow(message)
  })
})
