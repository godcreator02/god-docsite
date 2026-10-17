import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { identityOf, parsePeople } from '@godcreator/identity'
import { readCommentThreads } from '@godcreator/comments/node'
import { beforeEach, describe, expect, it } from 'vitest'
import { notificationOf } from '../src/core/notifications/notifications.js'
import type { SiteFeed } from '../src/core/notifications/site-feed.js'
import type { SubmitState } from '../src/core/notifications/submit-state.js'
import type { CollabSite } from '../src/site/collab-site.js'
import { collabLayoutData } from '../src/site/layout-data.js'
import {
  calendarLoader,
  commentAction,
  journalLoader,
  recordAction,
  recordLinksLoader,
  recordLoader,
  repoLinkAction,
  repoLinksLoader,
  tasksLoader,
} from '../src/site/index.server.js'

const bobCode = 'bobcode2345'
const peopleText = `${JSON.stringify([
  { id: 'admin', name: '管理员', codes: ['admincode001'] },
  { id: 'bob', name: '鲍勃', codes: [bobCode] },
])}\n`
const task = { id: '20261001090000-aaaaaaa', type: 'task', author: 'admin', status: 'todo', title: '画采样板', owner: 'bob', module: '20260920090000-mmmmmmm' }
const moduleRecord = { id: '20260920090000-mmmmmmm', type: 'module', author: 'admin', title: '采样板', due: '2026-10-31' }
/** 站点给的可信 origin：故意不是 4450，写入只认它 */
const trustedOrigin = 'http://collab.test:5173'

let repo: string
let site: CollabSite
let feed: SiteFeed | null

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  writeFileSync(path.join(repo, file), content)
}

const recordFiles = () => readdirSync(path.join(repo, 'collab', 'records')).sort()

function siteAs(code: string | undefined, overrides: Partial<CollabSite> = {}): CollabSite {
  const siteDir = path.join(repo, 'site')
  const people = () => parsePeople(JSON.parse(readFileSync(path.join(siteDir, 'people.json'), 'utf8')))
  return {
    siteName: '测试站',
    siteDir,
    repoDir: repo,
    commentsDir: path.join(repo, 'elsewhere', 'site-comments'),
    trustedOrigin,
    people,
    identity: () => identityOf(people(), code),
    pages: () => [{ url: '/notes', title: '笔记' }],
    feed: () => feed,
    ...overrides,
  }
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'collab-site-server-'))
  write('site/people.json', peopleText)
  write(`collab/records/${task.id}.json`, `${JSON.stringify(task, null, 2)}\n`)
  write(`collab/records/${moduleRecord.id}.json`, `${JSON.stringify(moduleRecord, null, 2)}\n`)
  feed = null
  site = siteAs(bobCode)
})

const args = (url: string, params: Record<string, string> = {}) => ({ request: new Request(url), params })

function post(fields: Record<string, string>, origin: string = trustedOrigin, url = 'http://collab.test:5173/tasks') {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  return { request: new Request(url, { method: 'POST', headers: { origin }, body: form }), params: {} }
}

type ActionReturn = Awaited<ReturnType<typeof recordAction>>

/** action 的回答：跳转（Response）或 data(...)（带状态码） */
function outcomeOf(returned: ActionReturn) {
  if (returned instanceof Response) return { status: returned.status, location: returned.headers.get('location') }
  return { status: returned.init?.status ?? 200, result: returned.data }
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? -1
  }
  return 200
}

describe('布局的轻量数据', () => {
  it('只有公开人员、本机身份与推送来的通知和提示词：人员不带身份码，不读任务', () => {
    feed = { notifications: [notificationOf({ kind: 'task', recordId: task.id, title: task.title, due: null, detail: null })], aiPrompt: '提示词', projectLeads: ['admin'] }
    const layout = collabLayoutData(args('http://collab.test:5173/'), site)
    expect(Object.keys(layout).sort()).toEqual(['aiPrompt', 'notifications', 'people', 'person'])
    expect(layout.aiPrompt).toBe('提示词')
    expect(layout.people).toEqual([
      { id: 'admin', name: '管理员' },
      { id: 'bob', name: '鲍勃' },
    ])
    expect(JSON.stringify(layout)).not.toContain(bobCode)
    expect(layout.person).toBe('bob')
    expect(layout.notifications?.map((each) => each.kind)).toEqual(['task'])
  })

  it('推送通道还没交来数据：通知与提示词为 null', () => {
    const layout = collabLayoutData(args('http://collab.test:5173/'), site)
    expect(layout.notifications).toBeNull()
    expect(layout.aiPrompt).toBeNull()
  })
})

describe('页面的 loader', () => {
  it('任务页：任务、模块、公开人员、页面、负责人取推送来的数据', async () => {
    feed = { notifications: [], aiPrompt: null, projectLeads: ['admin'] }
    const data = await tasksLoader(args('http://collab.test:5173/tasks'), site)
    expect(data.tasks.map((each) => each.title)).toEqual(['画采样板'])
    expect(data.modules.map((each) => each.title)).toEqual(['采样板'])
    expect(data).toMatchObject({ siteName: '测试站', person: 'bob', projectLeads: ['admin'], pages: [{ url: '/notes', title: '笔记' }] })
    expect(JSON.stringify(data)).not.toContain(bobCode)
  })

  it('记录那一页只交那一条：模块带上归进它的任务；日志里的进展一并读出', async () => {
    write('site/journal/2026-10-10.mdx', '画完 <RecordLink id="20261001090000-aaaaaaa" />\n')
    const taskPage = await recordLoader(args(`http://collab.test:5173/tasks/${task.id}`, { recordId: task.id }), site)
    expect(taskPage.record).toMatchObject({ kind: 'task', task: { id: task.id } })
    expect(taskPage.mentions).toEqual([{ date: '2026-10-10', text: '画完 画采样板' }])
    expect('tasks' in taskPage).toBe(false)
    const modulePage = await recordLoader(args(`http://collab.test:5173/tasks/${moduleRecord.id}`, { recordId: moduleRecord.id }), site)
    expect(modulePage.record).toMatchObject({ kind: 'module', moduleTasks: [{ id: task.id }] })
  })

  it('没有这条记录、或地址里不是记录 id：抛 404', async () => {
    expect(await statusOf(recordLoader(args('http://collab.test:5173/tasks/x', { recordId: '20261001090000-zzzzzzz' }), site))).toBe(404)
    expect(await statusOf(recordLoader(args('http://collab.test:5173/tasks/x', { recordId: '../../etc' }), site))).toBe(404)
  })

  it('日历：任务、模块、有日志的日子；日志页的日期不是真实日期抛 404', async () => {
    write('site/journal/2026-10-10.mdx', '有一篇\n')
    expect((await calendarLoader(args('http://collab.test:5173/calendar'), site)).journalDates).toEqual(['2026-10-10'])
    expect(await journalLoader(args('http://collab.test:5173/calendar/2026-10-10', { date: '2026-10-10' }), site)).toMatchObject({ date: '2026-10-10', hasJournal: true })
    expect(await statusOf(journalLoader(args('http://collab.test:5173/calendar/2026-02-30', { date: '2026-02-30' }), site))).toBe(404)
  })
})

describe('一键提交的 action', () => {
  function submitChannelOf(listening: boolean) {
    const channel = { value: null as SubmitState, listening, published: [] as SubmitState[] }
    return {
      channel,
      submit: {
        state: () => channel.value,
        publish: (state: SubmitState) => {
          channel.published.push(state)
          channel.value = state
        },
        workbenchListening: () => channel.listening,
      },
    }
  }

  it('往频道写一份 requested（发起人是本机身份）；已经在提交 409；gwb-collab 没在听 503 且不写；站点没接 501；只读 403', async () => {
    const { channel, submit } = submitChannelOf(true)
    const submitting = siteAs(bobCode, { submit })
    expect(outcomeOf(await recordAction(post({ intent: 'request-submit' }), submitting))).toEqual({ status: 200, result: { ok: true, intent: 'request-submit' } })
    expect(channel.published).toEqual([{ state: 'requested', by: 'bob', at: expect.any(String) as unknown }])
    expect(outcomeOf(await recordAction(post({ intent: 'request-submit' }), submitting))).toMatchObject({ status: 409, result: { ok: false, error: expect.stringContaining('已经在提交审核了') as unknown } })

    channel.value = null
    channel.listening = false
    expect(outcomeOf(await recordAction(post({ intent: 'request-submit' }), submitting))).toMatchObject({ status: 503, result: { error: expect.stringContaining('工作台没连着这个站') as unknown } })
    expect(channel.published).toHaveLength(1)

    expect(outcomeOf(await recordAction(post({ intent: 'request-submit' }), site)).status).toBe(501)
    expect(outcomeOf(await recordAction(post({ intent: 'request-submit' }), siteAs('nobodycode99', { submit }))).status).toBe(403)
    expect(outcomeOf(await recordAction(post({ intent: 'request-submit', extra: 'x' }), submitting))).toMatchObject({ status: 400 })
  })

  it('布局数据带上一键提交的状态；站点没接就没有这一项', () => {
    const merged: SubmitState = { state: 'merged', by: 'bob', at: '2026-10-17T08:00:00.000Z', pull: { number: 3, url: 'https://git.test/pulls/3' } }
    expect(collabLayoutData(args('http://collab.test:5173/'), { ...site, submitState: () => merged }).submit).toEqual(merged)
    expect('submit' in collabLayoutData(args('http://collab.test:5173/'), site)).toBe(false)
  })
})

describe('写任务与模块的 action', () => {
  it('新建：写成新的记录文件，作者是本机身份，跳到新记录那一页', async () => {
    const outcome = outcomeOf(await recordAction(post({ intent: 'create-record', type: 'task', status: 'todo', title: '调 PLL' }), site))
    expect(outcome.status).toBe(302)
    const id = outcome.location!.replace('/tasks/', '')
    expect(recordFiles()).toEqual([`${task.id}.json`, `${id}.json`, `${moduleRecord.id}.json`].sort())
    expect(JSON.parse(readFileSync(path.join(repo, 'collab', 'records', `${id}.json`), 'utf8'))).toMatchObject({ author: 'bob', title: '调 PLL' })
  })

  it('改字段：改别人的任务里允许的字段', async () => {
    expect(outcomeOf(await recordAction(post({ intent: 'update-record', id: task.id, field: 'status', value: 'doing' }), site))).toEqual({ status: 200, result: { ok: true, intent: 'update-record' } })
  })

  it('写入规则拒绝回 422 和原话', async () => {
    const outcome = outcomeOf(await recordAction(post({ intent: 'update-record', id: task.id, field: 'detail', value: '改掉' }), site))
    expect(outcome.status).toBe(422)
    expect(outcome.result).toMatchObject({ ok: false, error: expect.stringMatching(/bob 改了 admin 的记录 .* 的 detail/) as string })
  })

  it('表单不对回 400：intent 认不出、多了字段、缺字段', async () => {
    const status = async (fields: Record<string, string>) => outcomeOf(await recordAction(post(fields), site)).status
    expect(await status({ intent: 'move-record' })).toBe(400)
    expect(await status({ intent: 'update-record', id: task.id, field: 'status', value: 'doing', extra: '1' })).toBe(400)
    expect(await status({ intent: 'delete-record' })).toBe(400)
  })

  it('只读、或 Origin 不是站点给的可信 origin 回 403，不写文件；可信 origin 取参数，不认写死的 4450', async () => {
    const created = { intent: 'create-record', type: 'task', status: 'todo', title: '调 PLL' }
    expect(outcomeOf(await recordAction(post(created), siteAs('nobodycode99'))).status).toBe(403)
    expect(outcomeOf(await recordAction(post(created, 'http://127.0.0.1:4450'), site)).status).toBe(403)
    expect(outcomeOf(await recordAction(post(created, 'http://127.0.0.1:4450'), siteAs(bobCode, { trustedOrigin: 'http://127.0.0.1:4450' }))).status).toBe(302)
    expect(recordFiles()).toHaveLength(3)
  })

  it('删除：作者以外的人删不了；推送来的负责人能删，删完跳回任务页', async () => {
    const remove = post({ intent: 'delete-record', id: task.id })
    expect(outcomeOf(await recordAction(remove, site))).toMatchObject({ status: 422, result: { ok: false } })
    feed = { notifications: [], aiPrompt: null, projectLeads: ['bob'] }
    expect(outcomeOf(await recordAction(post({ intent: 'delete-record', id: task.id }), site))).toEqual({ status: 302, location: '/tasks' })
    expect(recordFiles()).toEqual([`${moduleRecord.id}.json`])
  })
})

describe('协作页上的评论', () => {
  it('评论写进站点给的评论目录，loader 也从那里读；作者是本机身份', async () => {
    const outcome = outcomeOf(await recordAction(post({ intent: 'create-thread', page: '/tasks', body: '看一下' }), site))
    expect(outcome).toMatchObject({ status: 200, result: { ok: true, intent: 'create-thread' } })
    const [thread] = await readCommentThreads(site.commentsDir)
    expect(thread!.head).toMatchObject({ page: '/tasks', authorId: 'bob' })
    const data = await tasksLoader(args('http://collab.test:5173/tasks'), site)
    expect(data.comments.threads.map((each) => each.author)).toEqual([{ id: 'bob', name: '鲍勃' }])
    expect(data.comments.access).toEqual({ kind: 'writable', writer: { id: 'bob', name: '鲍勃' } })
  })

  it('还没有评论目录：没有评论；日志页的 action 只收评论', async () => {
    expect((await tasksLoader(args('http://collab.test:5173/tasks'), site)).comments.threads).toEqual([])
    const returned = await commentAction(post({ intent: 'create-record', type: 'task', status: 'todo', title: 'x' }), site)
    expect(returned.init?.status).toBe(400)
  })
})

describe('正文里的链接', () => {
  it('记录链接：问到的任务带状态与模块色号，模块带截止日的样子；删了的不在回答里', async () => {
    write('site/journal/2026-10-10.mdx', '有一篇\n')
    const targets = await recordLinksLoader(args(`http://collab.test:5173/api/record-links?id=${task.id}&id=${moduleRecord.id}&id=20261001090000-zzzzzzz`), site)
    expect(targets.records).toEqual([
      { kind: 'task', id: task.id, title: '画采样板', status: 'todo', module: { id: moduleRecord.id, title: '采样板', colorSlot: 0 } },
      { kind: 'module', id: moduleRecord.id, title: '采样板', due: '2026-10-31', dueState: expect.any(String) as string, colorSlot: 0 },
    ])
    expect(targets.journalDates).toEqual(['2026-10-10'])
  })

  it('repo: 链接：只读的站点一律 read-only；在本机打开要本机身份与可信 origin', async () => {
    expect(await repoLinksLoader(args('http://collab.test:5173/api/repo-links?target=repo:firmware/a.c'), siteAs(undefined))).toMatchObject({ state: 'read-only' })
    const open = (origin: string) => post({ target: 'repo:firmware/a.c' }, origin, 'http://collab.test:5173/api/repo-links')
    expect((await repoLinkAction(open('http://elsewhere.test'), site)).init?.status).toBe(403)
    expect((await repoLinkAction(open(trustedOrigin), siteAs(undefined))).init?.status).toBe(403)
  })
})
