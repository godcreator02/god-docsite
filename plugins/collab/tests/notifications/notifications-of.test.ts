import { notificationKinds, type NotificationKind } from '@godcreator/collab'
import { describe, expect, it } from 'vitest'
import { notificationsOf, type NotificationSources } from '../../src/notifications/notifications-of.js'

/** 什么事都没有的一个项目：在 main 上，没有改动、没有出错，别的仓与服务器一样 */
const quiet: NotificationSources = {
  collabRepo: { name: 'collab', local: { branch: 'main', unsubmitted: { records: [], siteFiles: [] }, conflicts: [] }, syncProblem: null, submitFailure: null, setupProblems: [] },
  records: { inbox: { tasks: [], mentions: [], repliesToMe: [] }, problems: [] },
  otherRepos: { heads: [{ repo: 'firmware', ahead: 0, behind: 0 }], reviews: [], setupProblems: [] },
  webhookProblem: null,
  checkErrors: [],
}

function sources(change: (draft: NotificationSources) => void): NotificationSources {
  const draft = structuredClone(quiet)
  change(draft)
  return draft
}

const web = 'https://git.example.org/hybrid-mmc/datasheets'
const at = '2026-10-03T08:00:00.000Z'

/** 每种 kind 都出现一次的项目 */
const busy = sources((draft) => {
  draft.collabRepo.local.unsubmitted = { records: ['records/a.json'], siteFiles: ['pages/a/page.mdx'] }
  draft.collabRepo.submitFailure = { at, message: '被打回' }
  draft.collabRepo.syncProblem = '工作区里没提交的改动和 main 上的新改动碰到了同一个文件'
  draft.collabRepo.setupProblems = ['main 没有分支保护']
  draft.checkErrors = ['取回 datasheets 失败：fatal', '读 hybrid-mmc/firmware 的协作者失败：Gitea 回 500，boom']
  draft.webhookProblem = { organization: 'hybrid-mmc', problems: ['少订了事件 issues'] }
  draft.records.problems = [{ file: 'records/b.json', message: '不是合法 JSON' }]
  draft.records.inbox = {
    tasks: [{ id: 't1', author: 'admin', status: 'todo', title: '核算纹波', owner: 'bob', due: '2026-10-10' }],
    mentions: [{ in: 'comment', comment: '2026-10-10-a/index.mdx', author: 'admin', page: '/plan?comment=2026-10-10-a', text: '@bob 看看' }],
    repliesToMe: [{ comment: '2026-10-10-b/r1.mdx', author: 'carol', text: '同意', threadId: '2026-10-10-b', page: '/plan?comment=2026-10-10-b' }],
  }
  draft.otherRepos.heads = [
    { repo: 'datasheets', ahead: 2, behind: 0 },
    { repo: 'firmware', ahead: 0, behind: 3 },
    { repo: 'fpga', ahead: 1, behind: 1 },
    { repo: 'hil', ahead: 0, behind: 0 },
  ]
  draft.otherRepos.reviews = [
    {
      repo: 'datasheets',
      pullsToReview: [{ repo: 'datasheets', number: 3, title: '补手册', poster: 'carol', url: `${web}/pulls/3` }],
      issuesToAnswer: [{ repo: 'datasheets', number: 7, title: '缺页', poster: 'carol', lastSpeaker: 'carol', url: `${web}/issues/7` }],
      myPullUpdates: [{ repo: 'datasheets', number: 4, title: '改目录', change: 'changes-requested', by: 'admin', url: `${web}/pulls/4` }],
      myIssuesAnswered: [{ repo: 'datasheets', number: 11, title: '要新版', by: 'admin', url: `${web}/issues/11` }],
    },
  ]
  draft.otherRepos.setupProblems = [{ repo: 'firmware', problems: ['没有协作者（没有负责人）'] }]
})

describe('从此刻的状态算通知', () => {
  it('什么事都没有：一条通知都没有', () => {
    expect(notificationsOf(quiet)).toEqual([])
  })

  it('每种 kind 都从对应的状态来，按组排好；id 由通知模型按事实算', () => {
    const notifications = notificationsOf(busy)
    const kinds = notifications.map((notification) => notification.kind)
    const expectedKinds: NotificationKind[] = notificationKinds.filter((kind) => kind !== 'conflicts' && kind !== 'off-main')
    expect([...new Set(kinds)]).toEqual(expectedKinds)
    expect(notifications.map((notification) => notification.id)).toEqual([
      'unsubmitted',
      'submit-failure',
      'sync-problem',
      'check-error',
      'record-problem:records/b.json:不是合法 JSON',
      'webhook-setup:hybrid-mmc',
      'unpushed:datasheets',
      'unpulled:firmware',
      'diverged:fpga',
      'pull-to-review:datasheets#3',
      'issue-to-answer:datasheets#7',
      'my-pull-update:datasheets#4:changes-requested',
      'my-issue-answered:datasheets#11',
      'repo-setup:collab',
      'repo-setup:firmware',
      'task:t1',
      'mention:2026-10-10-a/index.mdx',
      'reply:2026-10-10-b/r1.mdx',
    ])
  })

  it('事实原样带上：没提交的文件 collab/、site/ 分开，检查出错一步一行，别的仓的三种只看 HEAD', () => {
    const byId = new Map(notificationsOf(busy).map((notification) => [notification.id, notification]))
    expect(byId.get('unsubmitted')).toEqual({ id: 'unsubmitted', kind: 'unsubmitted', records: ['records/a.json'], siteFiles: ['pages/a/page.mdx'] })
    expect(byId.get('check-error')).toEqual({ id: 'check-error', kind: 'check-error', message: '取回 datasheets 失败：fatal\n读 hybrid-mmc/firmware 的协作者失败：Gitea 回 500，boom' })
    expect(byId.get('unpushed:datasheets')).toEqual({ id: 'unpushed:datasheets', kind: 'unpushed', repo: 'datasheets', count: 2 })
    expect(byId.get('unpulled:firmware')).toEqual({ id: 'unpulled:firmware', kind: 'unpulled', repo: 'firmware', count: 3 })
    expect(byId.get('diverged:fpga')).toEqual({ id: 'diverged:fpga', kind: 'diverged', repo: 'fpga', ahead: 1, behind: 1 })
    expect(byId.get('repo-setup:collab')).toEqual({ id: 'repo-setup:collab', kind: 'repo-setup', repo: 'collab', problems: ['main 没有分支保护'] })
    expect(byId.get('task:t1')).toEqual({ id: 'task:t1', kind: 'task', recordId: 't1', title: '核算纹波', due: '2026-10-10', detail: null })
    expect(byId.get('mention:2026-10-10-a/index.mdx')).toMatchObject({ author: 'admin', page: '/plan?comment=2026-10-10-a', in: 'comment' })
    expect(byId.get('reply:2026-10-10-b/r1.mdx')).toMatchObject({ author: 'carol', threadId: '2026-10-10-b' })
  })

  it('冲突没改好：只列冲突，不再列提交失败与同步不了', () => {
    const kinds = notificationsOf(
      sources((draft) => {
        draft.collabRepo.local.conflicts = ['README.md']
        draft.collabRepo.submitFailure = { at, message: '合 main 出了冲突' }
        draft.collabRepo.syncProblem = '提交审核时把 main 合进来出了冲突，还没改好'
      }),
    ).map((notification) => notification.kind)
    expect(kinds).toEqual(['conflicts'])
  })

  it('不在 main 上：列出在哪，不再列同步不了；分离的 HEAD 的 branch 为 null', () => {
    const offBranch = notificationsOf(
      sources((draft) => {
        draft.collabRepo.local.branch = 'research'
        draft.collabRepo.syncProblem = '当前在分支 research 上'
      }),
    )
    expect(offBranch).toEqual([{ id: 'off-main', kind: 'off-main', branch: 'research' }])
    expect(notificationsOf(sources((draft) => void (draft.collabRepo.local.branch = null)))).toEqual([{ id: 'off-main', kind: 'off-main', branch: null }])
  })
})
