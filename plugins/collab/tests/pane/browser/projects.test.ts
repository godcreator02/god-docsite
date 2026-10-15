import { describe, expect, it } from 'vitest'
import { aiPromptCopiedTextOf, hasNotifications, notificationsChipOf, pushChipOf, type ProjectRow, type ProjectSummary, type SiteRow } from '../../../src/pane/browser/projects.js'

const noCounts = { 'collab-repo': 0, 'other-repos': 0, 'for-me': 0 }

const summary: ProjectSummary = {
  title: '混合型 MMC 样机',
  name: '鲍勃',
  counts: noCounts,
  giteaUrl: 'https://git.example.org/hybrid-mmc',
}

const runningSite: SiteRow = { url: 'http://127.0.0.1:4330/', running: true, error: null }

/** 打得开的项目：summary 必在、error 必空 */
const openedRow = (counts: Partial<ProjectSummary['counts']> = {}, site: Partial<SiteRow> = {}): ProjectRow => ({
  repo: 'D:/p/collab',
  summary: { ...summary, counts: { ...noCounts, ...counts } },
  error: null,
  site: { ...runningSite, ...site },
})

/** 打不开的项目：只在 error 里写原因 */
const closedRow = (error: string): ProjectRow => ({ repo: 'D:/p/collab', summary: null, error, site: runningSite })

describe('项目那一行的「复制给 AI」', () => {
  it('有通知才有按钮；打不开的项目没有', () => {
    expect(hasNotifications(openedRow())).toBe(false)
    expect(hasNotifications(openedRow({ 'other-repos': 1 }))).toBe(true)
    expect(hasNotifications(closedRow('不是协作仓'))).toBe(false)
  })

  it('复制以后写明复制了几件事、去哪里用', () => {
    expect(aiPromptCopiedTextOf(3)).toBe('已把 3 件事写成提示词复制下来，粘贴给你的 AI')
  })
})

describe('项目那一行的通知标签', () => {
  it('没有通知：绿的「没有通知」', () => {
    expect(notificationsChipOf(openedRow())).toEqual({ key: 'messages', label: '没有通知', tone: 'ok' })
  })

  it('三组各几条和网站顶部提示栏一样：协作仓组有通知标红，只有别的两组标黄，没有的那一组不写', () => {
    expect(notificationsChipOf(openedRow({ 'collab-repo': 2, 'for-me': 3 }))).toMatchObject({ label: '协作仓 2 条 · 找我的 3 条', tone: 'bad' })
    expect(notificationsChipOf(openedRow({ 'for-me': 1 }))).toMatchObject({ label: '找我的 1 条', tone: 'warn' })
    expect(notificationsChipOf(openedRow({ 'collab-repo': 1 }))).toMatchObject({ label: '协作仓 1 条', tone: 'bad' })
    expect(notificationsChipOf(openedRow({ 'other-repos': 2, 'for-me': 1 }))).toMatchObject({ label: '别的仓 2 条 · 找我的 1 条', tone: 'warn' })
  })

  it('网站上看不到提示栏的情况：项目打不开、站点没能启动，悬停看原因', () => {
    expect(notificationsChipOf(closedRow('D:/p/collab 不存在'))).toEqual({ key: 'error', label: '打不开', tone: 'bad', title: 'D:/p/collab 不存在' })
    expect(notificationsChipOf(openedRow({ 'collab-repo': 1 }, { running: false, error: '没装依赖' }))).toEqual({ key: 'site', label: '站点没能启动', tone: 'bad', title: '没装依赖' })
  })
})

describe('窗格顶上实时推送的标签', () => {
  const url = 'https://ntfy.example.org'
  const topics = ['collab-chb-dab-sst', 'collab-hybrid-mmc']

  it('连上了绿，悬停看订了哪些；有项目没订上标黄', () => {
    expect(pushChipOf({ state: 'connected', url, topics, error: null })).toEqual({
      key: 'push',
      label: '实时推送已连上',
      tone: 'ok',
      title: '订阅 https://ntfy.example.org 上的 collab-chb-dab-sst、collab-hybrid-mmc',
    })
    expect(pushChipOf({ state: 'connected', url, topics, error: 'D:/p/x 没订上：D:/p/x 不存在' })).toMatchObject({ label: '实时推送已连上，有项目没订上', tone: 'warn' })
  })

  it('断开了就是连不上 NAS，标黄、悬停看原因；没能开始标红；列表是空的标灰', () => {
    expect(pushChipOf({ state: 'waiting', url, topics, error: 'ntfy 回 HTTP 502' })).toEqual({ key: 'push', label: '连不上 NAS，稍后重连', tone: 'warn', title: 'ntfy 回 HTTP 502' })
    expect(pushChipOf({ state: 'off', url: null, topics: [], error: 'gwb-gitea 没装或没启用' })).toMatchObject({ label: '实时推送没能开始', tone: 'bad' })
    expect(pushChipOf({ state: 'off', url: null, topics: [], error: null })).toEqual({ key: 'push', label: '没有项目，没在订阅', tone: 'muted' })
  })
})
