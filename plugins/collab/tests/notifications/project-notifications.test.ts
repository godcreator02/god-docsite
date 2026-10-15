import type { Notification } from '@godcreator/collab'
import { describe, expect, it, vi } from 'vitest'
import { ProjectNotifications, type NotificationReaders } from '../../src/notifications/project-notifications.js'
import type { Project } from '../../src/project/project.js'

const project: Project = { repo: 'D:/projects/hybrid-mmc/collab', collabDir: 'D:/projects/hybrid-mmc/collab/collab', siteDir: 'D:/projects/hybrid-mmc/collab/site', person: 'bob' }

/** 读数的假件：协作仓有一个没提交的记录，别的仓 firmware 落后一个提交，people.json 里 carol 叫卡萝 */
function readersWith(overrides: Partial<NotificationReaders> = {}): NotificationReaders {
  return {
    openProject: async () => project,
    collabLocalStateOf: async () => ({ branch: 'main', unsubmitted: { records: ['records/a.json'], siteFiles: [] }, conflicts: [] }),
    syncProblemOf: () => null,
    submitFailureOf: () => null,
    collabSetupProblemsOf: () => [],
    recordsOf: async () => ({
      inbox: { tasks: [], mentions: [], repliesToMe: [{ comment: '2026-10-10-a/r1.mdx', author: 'carol', text: '同意', threadId: '2026-10-10-a', page: '/plan?comment=2026-10-10-a' }] },
      problems: [],
      people: [
        { id: 'bob', name: '鲍勃' },
        { id: 'carol', name: '卡萝' },
      ],
    }),
    otherHeadsOf: async () => [{ repo: 'firmware', ahead: 0, behind: 1 }],
    otherReviewsOf: () => [],
    otherSetupProblemsOf: () => [],
    webhookProblemOf: () => null,
    checkErrorsOf: () => [],
    projectLeadsOf: () => ['admin'],
    refreshedOnce: () => true,
    ...overrides,
  }
}

function notificationsWith(readers: NotificationReaders) {
  const observed: Array<{ title: string; notifications: Notification[]; carol: string }> = []
  const fed: string[] = []
  const notifications = new ProjectNotifications({
    readers,
    channel: {
      observe: async (_repo, title, current, nameOf) => {
        observed.push({ title, notifications: current, carol: nameOf('carol') })
      },
    },
    onFeedChanged: (repo) => fed.push(repo),
    log: { warn: () => {} },
  })
  return { notifications, observed, fed }
}

describe('一个项目此刻的通知', () => {
  it('交给站点的整份数据：通知按组排好，连同把它们交给 AI 的提示词与项目负责人', async () => {
    const { notifications } = notificationsWith(readersWith())
    const { aiPrompt, ...rest } = await notifications.feedOf(project.repo)
    expect(rest).toEqual({
      notifications: [
        { id: 'unsubmitted', kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] },
        { id: 'unpulled:firmware', kind: 'unpulled', repo: 'firmware', count: 1 },
        { id: 'reply:2026-10-10-a/r1.mdx', kind: 'reply', comment: '2026-10-10-a/r1.mdx', author: 'carol', page: '/plan?comment=2026-10-10-a', text: '同意', threadId: '2026-10-10-a' },
      ],
      projectLeads: ['admin'],
    })
    expect(aiPrompt?.split('\n')[0]).toBe('协作站要处理的 3 件事（collab）')
    expect(aiPrompt).toContain(`协作仓：${project.repo}`)
    expect(aiPrompt).toContain('卡萝')
  })

  it('没有通知时提示词为 null', async () => {
    const quiet = readersWith({
      collabLocalStateOf: async () => ({ branch: 'main', unsubmitted: { records: [], siteFiles: [] }, conflicts: [] }),
      recordsOf: async () => ({ inbox: { tasks: [], mentions: [], repliesToMe: [] }, problems: [], people: [] }),
      otherHeadsOf: async () => [],
    })
    const feed = await notificationsWith(quiet).notifications.feedOf(project.repo)
    expect(feed.notifications).toEqual([])
    expect(feed.aiPrompt).toBeNull()
  })

  it('哪样变了都交给站点；做完过一次完整刷新才交给接口 B，交的是此刻的全部通知与换显示名的办法', async () => {
    let refreshed = false
    const { notifications, observed, fed } = notificationsWith(readersWith({ refreshedOnce: () => refreshed }))
    notifications.changed(project.repo)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(fed).toEqual([project.repo])
    expect(observed).toEqual([])
    refreshed = true
    notifications.changed(project.repo)
    await vi.waitFor(() => expect(observed).toHaveLength(1))
    expect(observed[0]).toMatchObject({ title: 'collab', carol: '卡萝' })
    expect(observed[0]!.notifications.map((notification) => notification.id)).toEqual(['unsubmitted', 'unpulled:firmware', 'reply:2026-10-10-a/r1.mdx'])
  })
})
