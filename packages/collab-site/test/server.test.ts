import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collabRecordResponse, collabSiteData, recordJournalMentions } from '../src/server/index.js'

const bobCode = 'bobcode2345'
const people = `${JSON.stringify([
  { id: 'admin', name: '管理员' },
  { id: 'bob', name: '鲍勃', codes: [bobCode] },
])}\n`
const task = { id: '20261001090000-aaaaaaa', type: 'task', author: 'admin', status: 'todo', title: '画采样板', owner: 'bob' }

let repo: string
const siteDir = () => path.join(repo, 'site')
const recordFiles = () => readdirSync(path.join(repo, 'collab', 'records')).sort()

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  writeFileSync(path.join(repo, file), content)
}

/** 路由文件里的函数以进程的当前目录为站点目录：每个测试切到临时协作仓的 site/ */
const startDir = process.cwd()
beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'collab-site-server-'))
  write('site/people.json', people)
  write(`collab/records/${task.id}.json`, `${JSON.stringify(task, null, 2)}\n`)
  process.chdir(siteDir())
  vi.stubEnv('DOCSITE_IDENTITY_CODE', bobCode)
})
afterEach(() => {
  process.chdir(startDir)
  vi.unstubAllEnvs()
})

const post = (body: unknown) => new Request('http://site/api/collab', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })

describe('布局的协作数据', () => {
  it('任务、模块、人员、本机身份、有日志的日子；gwb-collab 还没推数据时通知与负责人为 null', async () => {
    write('site/journal/2026-10-10.mdx', '画完 <RecordLink id="20261001090000-aaaaaaa" />\n')
    const data = await collabSiteData([{ url: '/notes', title: '笔记' }])
    expect(data).toMatchObject({ person: 'bob', projectLeads: null, notifications: null, pages: [{ url: '/notes', title: '笔记' }], journalDates: ['2026-10-10'], problems: [] })
    expect(data.tasks.map((each) => each.title)).toEqual(['画采样板'])
    expect(data.people.map((each) => each.id)).toEqual(['admin', 'bob'])
    expect(await recordJournalMentions(task.id)).toEqual([{ date: '2026-10-10', text: '画完 画采样板' }])
  })

  it('身份码不在人员列表里：只读，person 为 null', async () => {
    vi.stubEnv('DOCSITE_IDENTITY_CODE', 'nobodycode99')
    expect((await collabSiteData([])).person).toBeNull()
  })
})

describe('写任务与模块的接口', () => {
  it('create：写成新的记录文件，作者是本机身份', async () => {
    const response = await collabRecordResponse(post({ action: 'create', record: { type: 'task', status: 'todo', title: '调 PLL' } }))
    expect(response.status).toBe(200)
    const { id } = (await response.json()) as { id: string }
    expect(recordFiles()).toEqual([`${task.id}.json`, `${id}.json`].sort())
  })

  it('update：改别人的任务里允许的字段', async () => {
    const response = await collabRecordResponse(post({ action: 'update', record: { id: task.id, fields: { status: 'doing' } } }))
    expect(response.status).toBe(200)
  })

  it('写入规则拒绝回 422 和原话', async () => {
    const response = await collabRecordResponse(post({ action: 'update', record: { id: task.id, fields: { detail: '改掉' } } }))
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error: string }).error).toMatch(/bob 改了 admin 的记录 .* 的 detail/)
  })

  it('请求不对回 400：不是 JSON、action 认不出、多了字段', async () => {
    const statusOf = async (body: unknown) => (await collabRecordResponse(post(body))).status
    expect(await statusOf('{{{')).toBe(400)
    expect(await statusOf({ action: 'move', record: {} })).toBe(400)
    expect(await statusOf({ action: 'create', record: {}, extra: 1 })).toBe(400)
  })

  it('不是 POST 回 405；只读时回 403，不写文件', async () => {
    expect((await collabRecordResponse(new Request('http://site/api/collab'))).status).toBe(405)
    vi.stubEnv('DOCSITE_IDENTITY_CODE', 'nobodycode99')
    expect((await collabRecordResponse(post({ action: 'create', record: { type: 'task', status: 'todo', title: '调 PLL' } }))).status).toBe(403)
    expect(recordFiles()).toEqual([`${task.id}.json`])
  })
})
