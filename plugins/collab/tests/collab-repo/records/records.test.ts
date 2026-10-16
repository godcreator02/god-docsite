import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { encodeRecordFile, recordFileOf, type CollabRecord, type ModuleRecord, type TaskRecord } from '@godcreator/collab'
import { beforeEach, describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import { collabInbox } from '../../../src/collab-repo/records/inbox.js'
import { createModule, deleteModules, moduleCreateArgsOf, moduleDeleteArgsOf, moduleUpdateArgsOf, updateModule } from '../../../src/collab-repo/records/module.js'
import { joinProject, openProject, type Project } from '../../../src/project/project.js'
import { createTask, deleteTasks, taskCreateArgsOf, taskDeleteArgsOf, taskUpdateArgsOf, updateTask } from '../../../src/collab-repo/records/task.js'
/** 每个测试一个临时 git 仓，本 home 的身份码是 bob 的；这几条命令只读写工作区，不需要远端 */
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const bobCode = 'bobcode2345'
const adminCode = 'admincode234'

const people = `${JSON.stringify([
  { id: 'admin', name: '管理员', codes: [adminCode], gitea: 'admin' },
  { id: 'bob', name: '成员', codes: [bobCode], gitea: 'bob' },
  { id: 'carol', name: '成员', gitea: 'carol' },
])}\n`

const task = (id: string, author: string, extra: Partial<TaskRecord> = {}): TaskRecord => ({ id, type: 'task', author, status: 'todo', title: `${author} 的任务`, ...extra })
const moduleRecord = (id: string, author: string, extra: Partial<ModuleRecord> = {}): ModuleRecord => ({
  id,
  type: 'module',
  author,
  title: `${author} 的模块`,
  due: '2026-10-31',
  ...extra,
})

/** 项目负责人（Gitea 上协作仓的协作者）：命令里经 Gitea 现读，这里直接给 */
const projectLeads = ['admin']

let bob: Project

function writeRecord(record: CollabRecord) {
  const file = path.join(bob.collabDir, recordFileOf(record.id))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, encodeRecordFile(record))
}

const readRecordFile = (id: string) => readFileSync(path.join(bob.collabDir, recordFileOf(id)), 'utf8')
const recordFiles = () => readdirSync(path.join(bob.collabDir, 'records')).sort()

/** 站点 comments/ 里的一串评论：发起的那条与回复各一个文件 */
type CommentEntry = { author: string; body: string }
function writeThread(id: string, head: CommentEntry & { page?: string; status?: 'open' | 'resolved' }, replies: CommentEntry[] = []) {
  const dir = path.join(bob.siteDir, 'comments', id)
  mkdirSync(dir, { recursive: true })
  const pageLine = head.page === undefined ? '' : `page: ${head.page}\n`
  const statusLines = head.status === 'resolved' ? 'status: resolved\nresolvedBy: bob\nresolvedAt: 2026-10-11T09:00:00.000Z\n' : 'status: open\n'
  writeFileSync(path.join(dir, 'index.mdx'), `---\nauthor: ${head.author}\ncreatedAt: 2026-10-10T09:00:00.000Z\n${pageLine}${statusLines}---\n\n${head.body}\n`)
  replies.forEach((reply, index) => {
    writeFileSync(path.join(dir, `r${index + 1}.mdx`), `---\nauthor: ${reply.author}\ncreatedAt: 2026-10-10T09:0${index + 1}:00.000Z\n---\n\n${reply.body}\n`)
  })
}

beforeEach(() => {
  const repo = mkdtempSync(path.join(tmpdir(), 'gwb-collab-inbox-'))
  mkdirSync(path.join(repo, 'collab'), { recursive: true })
  mkdirSync(path.join(repo, 'site'), { recursive: true })
  writeFileSync(path.join(repo, 'site', 'people.json'), people)
  writeFileSync(path.join(repo, 'site', 'docsite.json'), '{"kind":"collab","format":1}')
  bob = { repo, collabDir: path.join(repo, 'collab'), siteDir: path.join(repo, 'site'), person: 'bob' }
})

describe('认人', () => {
  // 这三条走真的 openProject（认人、报错与 join 是产品入口行为），要仓是 git 仓；其余用例手拼 Project 就够
  beforeEach(() => {
    git(bob.repo, 'init', '-q', '-b', 'main')
  })

  it('身份是本 home 的身份码在 site/people.json 里对应的那个人', async () => {
    expect(bob.person).toBe('bob')
    expect((await openProject(bob.repo, adminCode)).person).toBe('admin')
  })

  it('身份码不在人员列表里：拒绝，写明用 collab.project.join 加进去', async () => {
    await expect(openProject(bob.repo, 'nobodycode99')).rejects.toThrow(/本 home 的身份码不在 site\/people\.json 里：运行 collab\.project\.join/)
  })

  it('collab.project.join：按令牌的账号找到自己那一项，交给 gwb-docsite 加码；账号不在列表里就拒绝、不改文件', async () => {
    const joined: unknown[] = []
    const join = async (siteDir: string, person: unknown) => {
      joined.push([siteDir, person])
      return { changed: true }
    }
    expect(await joinProject(bob.repo, 'carol', join)).toEqual({ person: 'carol', changed: true })
    expect(joined).toEqual([[bob.siteDir, { id: 'carol', name: '成员', gitea: 'carol' }]])
    await expect(joinProject(bob.repo, 'dave', join)).rejects.toThrow(/Gitea 账号 dave 不在 site\/people\.json 里：请项目负责人加上/)
    expect(joined).toHaveLength(1)
  })
})

describe('collab.inbox', () => {
  const ids = { myTodo: '20260926090000-aaaaaaa', myDone: '20260926090100-aaaaaab', carolsTask: '20260926090200-aaaaaac' }

  beforeEach(() => {
    writeRecord(task(ids.myTodo, 'admin', { owner: 'bob', status: 'doing' }))
    writeRecord(task(ids.myDone, 'admin', { owner: 'bob', status: 'done' }))
    writeRecord(task(ids.carolsTask, 'admin', { owner: 'carol' }))

    writeThread('20261010t090000-mention', { author: 'carol', page: '/plan', body: '@bob 看看拓扑' })
    writeThread('20261010t090001-resolved', { author: 'carol', page: '/plan', status: 'resolved', body: '@bob 已经解决了' })
    writeThread('20261010t090002-mine', { author: 'bob', body: '我的问题' }, [{ author: 'carol', body: '我来答' }])
  })

  it('任务：负责人是我、还没做完的；做完的和别人的不列', async () => {
    expect((await collabInbox(bob)).tasks.map((entry) => entry.id)).toEqual([ids.myTodo])
  })

  it('@我与回复我的：读站点 comments/ 里的评论串，去处带上评论串；已解决的串不列', async () => {
    const inbox = await collabInbox(bob)
    expect(inbox.mentions).toEqual([
      { in: 'comment', comment: '20261010t090000-mention/index.mdx', author: 'carol', text: '@bob 看看拓扑', page: '/plan?comment=20261010t090000-mention' },
    ])
    expect(inbox.repliesToMe).toEqual([{ comment: '20261010t090002-mine/r1.mdx', author: 'carol', text: '我来答', threadId: '20261010t090002-mine', page: '/comments?comment=20261010t090002-mine' }])
  })

  it('读出记录时的问题原样带上', async () => {
    writeFileSync(path.join(bob.collabDir, 'notes.txt'), '放错地方的文件\n')
    const { problems } = await collabInbox(bob)
    expect(problems.map((problem) => problem.file)).toEqual(['notes.txt'])
    expect(problems[0]?.message).toMatch(/认不出的文件/)
  })

  it('评论文件格式不对：拒绝，写明是 site/comments/ 的问题', async () => {
    writeThread('20261010t090003-broken', { author: 'carol', page: '/plan', body: '' })
    writeFileSync(path.join(bob.siteDir, 'comments', '20261010t090003-broken', 'index.mdx'), '没有 frontmatter 的正文\n')
    await expect(collabInbox(bob)).rejects.toThrow(/site\/comments\/ 里的评论读不对：\n[\s\S]*没有 frontmatter/)
  })
})

describe('collab.task.create', () => {
  it('写成规范的新文件：status 是 todo，作者是本机身份', async () => {
    const { fields } = taskCreateArgsOf({ repo: bob.repo, title: '核算纹波', owner: 'carol', due: '2026-10-01' })
    const { id, file } = await createTask(bob, fields)
    expect(file).toBe(`collab/records/${id}.json`)
    expect(readRecordFile(id)).toBe(encodeRecordFile({ id, type: 'task', author: 'bob', status: 'todo', title: '核算纹波', owner: 'carol', due: '2026-10-01' }))
  })

  it('写入规则拒绝的原样转成 CollabRejected，不写文件', async () => {
    writeRecord(task('20260926090000-aaaaaaa', 'admin'))
    await expect(createTask(bob, { title: '核算纹波', owner: 'dave' })).rejects.toThrow(CollabRejected)
    await expect(createTask(bob, { title: '核算纹波', owner: 'dave' })).rejects.toThrow(/dave/)
    await expect(createTask(bob, { title: '核算纹波', due: '十月一日' })).rejects.toThrow(/YYYY-MM-DD/)
    expect(recordFiles()).toEqual(['20260926090000-aaaaaaa.json'])
  })

  it('带 module：归进那个模块', async () => {
    const rack = moduleRecord('20260926080000-mmmmmma', 'admin')
    writeRecord(rack)
    const { fields } = taskCreateArgsOf({ repo: bob.repo, title: '核算纹波', module: rack.id })
    const { id } = await createTask(bob, fields)
    expect(readRecordFile(id)).toBe(encodeRecordFile({ id, type: 'task', author: 'bob', status: 'todo', title: '核算纹波', module: rack.id }))
  })

  it('module 指向的不是模块：拒绝，不写文件', async () => {
    const note = task('20260926100000-bbbbbba', 'bob')
    writeRecord(note)
    await expect(createTask(bob, { title: '核算纹波', module: note.id })).rejects.toThrow(/不是一个模块/)
    await expect(createTask(bob, { title: '核算纹波', module: '20260926000000-zzzzzzz' })).rejects.toThrow(/模块 20260926000000-zzzzzzz 不存在/)
    expect(recordFiles()).toEqual([`${note.id}.json`])
  })
})

describe('collab.task.update', () => {
  const mine = task('20260926090000-aaaaaaa', 'bob', { detail: '先看数据手册' })
  const carols = task('20260926090100-aaaaaab', 'carol', { detail: '量三次取平均' })

  beforeEach(() => {
    writeRecord(mine)
    writeRecord(carols)
  })

  it('改自己的任务：任何字段都能改', async () => {
    expect(await updateTask(bob, mine.id, { status: 'doing', detail: '数据手册看完了' })).toEqual({ id: mine.id, file: `collab/records/${mine.id}.json` })
    expect(readRecordFile(mine.id)).toBe(encodeRecordFile({ ...mine, status: 'doing', detail: '数据手册看完了' }))
  })

  it('改别人的任务：status、owner、due、title 能改', async () => {
    await updateTask(bob, carols.id, { status: 'done', owner: 'bob', due: '2026-10-01', title: '量纹波' })
    expect(readRecordFile(carols.id)).toBe(encodeRecordFile({ ...carols, status: 'done', owner: 'bob', due: '2026-10-01', title: '量纹波' }))
  })

  it('改别人任务里不许改的字段：拒绝，文件不变', async () => {
    await expect(updateTask(bob, carols.id, { status: 'doing', detail: '改掉' })).rejects.toThrow(CollabRejected)
    await expect(updateTask(bob, carols.id, { detail: '改掉' })).rejects.toThrow(/bob 改了 carol 的记录 .* 的 detail/)
    expect(readRecordFile(carols.id)).toBe(encodeRecordFile(carols))
  })

  it('id 不是任务：拒绝，文件不变', async () => {
    const note = moduleRecord('20260926100000-bbbbbba', 'bob')
    writeRecord(note)
    await expect(updateTask(bob, note.id, { status: 'done' })).rejects.toThrow(/是一条 module 记录，不是任务/)
    expect(readRecordFile(note.id)).toBe(encodeRecordFile(note))
  })

  it('记录不存在：原样报出写入规则的原因', async () => {
    await expect(updateTask(bob, '20260926000000-zzzzzzz', { status: 'done' })).rejects.toThrow(/没有 id 为 20260926000000-zzzzzzz 的记录/)
  })
})

describe('collab.module.create', () => {
  it('写成规范的新文件：作者是本机身份', async () => {
    const { fields } = moduleCreateArgsOf({ repo: bob.repo, title: '机柜', due: '2026-10-31', owner: 'carol', detail: '先定尺寸' })
    const { id, file } = await createModule(bob, fields)
    expect(file).toBe(`collab/records/${id}.json`)
    expect(readRecordFile(id)).toBe(encodeRecordFile({ id, type: 'module', author: 'bob', title: '机柜', due: '2026-10-31', owner: 'carol', detail: '先定尺寸' }))
  })

  it('缺 due：写入规则拒绝，转成 CollabRejected，不写文件', async () => {
    await expect(createModule(bob, { title: '机柜' })).rejects.toThrow(CollabRejected)
    await expect(createModule(bob, { title: '机柜' })).rejects.toThrow(/due/)
    expect(existsSync(path.join(bob.collabDir, 'records'))).toBe(false)
  })
})

describe('collab.module.update', () => {
  const mine = moduleRecord('20260926080000-mmmmmma', 'bob', { detail: '先定尺寸' })
  const carols = moduleRecord('20260926080100-mmmmmmb', 'carol', { detail: '量三次取平均' })

  beforeEach(() => {
    writeRecord(mine)
    writeRecord(carols)
  })

  it('改自己的模块：任何字段都能改', async () => {
    expect(await updateModule(bob, mine.id, { detail: '尺寸定了', due: '2026-11-15' })).toEqual({ id: mine.id, file: `collab/records/${mine.id}.json` })
    expect(readRecordFile(mine.id)).toBe(encodeRecordFile({ ...mine, detail: '尺寸定了', due: '2026-11-15' }))
  })

  it('改别人的模块：title、owner、due 能改', async () => {
    await updateModule(bob, carols.id, { title: '机柜与风道', owner: 'bob', due: '2026-11-05' })
    expect(readRecordFile(carols.id)).toBe(encodeRecordFile({ ...carols, title: '机柜与风道', owner: 'bob', due: '2026-11-05' }))
  })

  it('改别人模块的 detail：拒绝，文件不变', async () => {
    await expect(updateModule(bob, carols.id, { detail: '改掉' })).rejects.toThrow(CollabRejected)
    await expect(updateModule(bob, carols.id, { title: '机柜', detail: '改掉' })).rejects.toThrow(/bob 改了 carol 的记录 .* 的 detail/)
    expect(readRecordFile(carols.id)).toBe(encodeRecordFile(carols))
  })

  it('给模块加开始日：模块没有这个字段，拒绝，文件不变', async () => {
    await expect(updateModule(bob, mine.id, { start: '2026-10-01' })).rejects.toThrow(/start/)
    expect(readRecordFile(mine.id)).toBe(encodeRecordFile(mine))
  })

  it('id 是一条任务：拒绝，文件不变', async () => {
    const chore = task('20260926090000-aaaaaaa', 'bob')
    writeRecord(chore)
    await expect(updateModule(bob, chore.id, { title: '改名' })).rejects.toThrow(/是一条 task 记录，不是模块；collab\.module\.update 只改模块/)
    expect(readRecordFile(chore.id)).toBe(encodeRecordFile(chore))
  })
})

describe('collab.task.delete', () => {
  const mine = task('20260926090000-aaaaaaa', 'bob')
  const carols = task('20260926090100-aaaaaab', 'carol', { status: 'done' })

  beforeEach(() => {
    writeRecord(mine)
    writeRecord(carols)
  })

  const asAdmin = () => ({ ...bob, person: 'admin' })

  it('删自己的任务：删掉工作区里的记录文件，回执的 files 相对仓根', async () => {
    const { ids } = taskDeleteArgsOf({ repo: bob.repo, ids: [mine.id] })
    expect(await deleteTasks(bob, ids, projectLeads)).toEqual({ ids: [mine.id], files: [`collab/records/${mine.id}.json`] })
    expect(recordFiles()).toEqual([`${carols.id}.json`])
  })

  it('负责人一次删掉别人的几条任务，做完的也能删', async () => {
    await deleteTasks(asAdmin(), [mine.id, carols.id], projectLeads)
    expect(existsSync(path.join(bob.collabDir, recordFileOf(mine.id)))).toBe(false)
    expect(recordFiles()).toEqual([])
  })

  it('负责人看传进来的 projectLeads（协作仓的协作者），不看 people.json：bob 在里面就能删 carol 的任务', async () => {
    await deleteTasks(bob, [carols.id], ['admin', 'bob'])
    expect(recordFiles()).toEqual([`${mine.id}.json`])
  })

  it('删别人的任务：写入规则拒绝，转成 CollabRejected，一个文件都不删', async () => {
    await expect(deleteTasks(bob, [mine.id, carols.id], projectLeads)).rejects.toThrow(CollabRejected)
    await expect(deleteTasks(bob, [mine.id, carols.id], projectLeads)).rejects.toThrow(/bob 删不了 carol 的记录 .*；任务和模块只有作者和负责人能删/)
    expect(recordFiles()).toEqual([`${mine.id}.json`, `${carols.id}.json`])
  })

  it('ids 里有不是任务的：拒绝，一个文件都不删', async () => {
    const rack = moduleRecord('20260926080000-mmmmmma', 'bob')
    writeRecord(rack)
    await expect(deleteTasks(bob, [mine.id, rack.id], projectLeads)).rejects.toThrow(/是一条 module 记录，不是任务；collab\.task\.delete 只删任务/)
    expect(recordFiles()).toEqual([`${rack.id}.json`, `${mine.id}.json`, `${carols.id}.json`].sort())
  })
})

describe('collab.module.delete', () => {
  const rack = moduleRecord('20260926080000-mmmmmma', 'bob')
  const inRack = task('20260926090000-aaaaaaa', 'carol', { module: rack.id })

  beforeEach(() => {
    writeRecord(rack)
    writeRecord(inRack)
  })

  it('模块下还有任务：拒绝并列出任务，一个文件都不删', async () => {
    await expect(deleteModules(bob, [rack.id], projectLeads)).rejects.toThrow(new RegExp(`模块 ${rack.id}（bob 的模块）下还有任务：${inRack.id}（carol 的任务）`))
    expect(recordFiles()).toEqual([`${rack.id}.json`, `${inRack.id}.json`].sort())
  })

  it('任务改到别的模块之后再删', async () => {
    const cabinet = moduleRecord('20260926080100-mmmmmmb', 'carol')
    writeRecord(cabinet)
    await updateTask(bob, inRack.id, { module: cabinet.id })
    const { ids } = moduleDeleteArgsOf({ repo: bob.repo, ids: [rack.id] })
    expect(await deleteModules(bob, ids, projectLeads)).toEqual({ ids: [rack.id], files: [`collab/records/${rack.id}.json`] })
    expect(recordFiles()).toEqual([`${cabinet.id}.json`, `${inRack.id}.json`].sort())
  })

  it('ids 里是任务：拒绝', async () => {
    await expect(deleteModules(bob, [inRack.id], projectLeads)).rejects.toThrow(/是一条 task 记录，不是模块；collab\.module\.delete 只删模块/)
  })
})

describe('删除命令的参数', () => {
  const repo = path.resolve('/projects/hybrid-mmc')

  it('收 repo 与 ids', () => {
    expect(taskDeleteArgsOf({ repo, ids: ['x', 'y'] })).toEqual({ repo, ids: ['x', 'y'] })
    expect(moduleDeleteArgsOf({ repo, ids: ['x'] })).toEqual({ repo, ids: ['x'] })
  })

  const rejected: Array<[string, () => unknown, RegExp]> = [
    ['ids 给成一个字符串', () => taskDeleteArgsOf({ repo, ids: 'x' }), /ids 要是任务记录 id 的数组，收到 "x"/],
    ['ids 里有数字', () => moduleDeleteArgsOf({ repo, ids: ['x', 1] }), /ids 要是模块记录 id 的数组/],
    ['给的是 id 不是 ids', () => taskDeleteArgsOf({ repo, id: 'x' }), /认不出的参数 id/],
  ]
  for (const [name, parse, message] of rejected) {
    it(`拒绝：${name}`, () => {
      expect(parse).toThrow(CollabRejected)
      expect(parse).toThrow(message)
    })
  }
})

describe('模块命令的参数', () => {
  const repo = path.resolve('/projects/hybrid-mmc')

  it('建模块：除 repo 以外的键原样作为模块字段', () => {
    expect(moduleCreateArgsOf({ repo, title: '机柜', due: '2026-10-31' })).toEqual({
      repo,
      fields: { title: '机柜', due: '2026-10-31' },
    })
  })

  it('改模块：收 repo、id、fields', () => {
    expect(moduleUpdateArgsOf({ repo, id: 'x', fields: { due: '2026-11-01' } })).toEqual({ repo, id: 'x', fields: { due: '2026-11-01' } })
  })

  const rejected: Array<[string, () => unknown, RegExp]> = [
    ['建模块时自己给 author', () => moduleCreateArgsOf({ repo, title: '机柜', due: '2026-10-31', author: 'carol' }), /认不出的参数 author/],
    ['建模块时给 status：模块不存状态', () => moduleCreateArgsOf({ repo, title: '机柜', due: '2026-10-31', status: 'doing' }), /认不出的参数 status/],
    ['建模块时给 start：模块没有开始日', () => moduleCreateArgsOf({ repo, title: '机柜', start: '2026-10-01', due: '2026-10-31' }), /认不出的参数 start/],
    ['改模块时 id 不是字符串', () => moduleUpdateArgsOf({ repo, id: 1, fields: {} }), /id 要是模块的记录 id/],
    ['缺 repo', () => moduleCreateArgsOf({ title: '机柜', due: '2026-10-31' }), /绝对路径/],
  ]
  for (const [name, parse, message] of rejected) {
    it(`拒绝：${name}`, () => {
      expect(parse).toThrow(CollabRejected)
      expect(parse).toThrow(message)
    })
  }
})

describe('任务命令的参数', () => {
  const repo = path.resolve('/projects/hybrid-mmc')

  it('建任务：除 repo 以外的键原样作为任务字段', () => {
    expect(taskCreateArgsOf({ repo, title: '核算纹波', page: 'prototype/rack' })).toEqual({ repo, fields: { title: '核算纹波', page: 'prototype/rack' } })
  })

  it('改任务：收 repo、id、fields', () => {
    expect(taskUpdateArgsOf({ repo, id: 'x', fields: { status: 'done' } })).toEqual({ repo, id: 'x', fields: { status: 'done' } })
  })

  const rejected: Array<[string, () => unknown, RegExp]> = [
    ['建任务时自己给 status', () => taskCreateArgsOf({ repo, title: '核算纹波', status: 'done' }), /认不出的参数 status/],
    ['建任务时自己给 author', () => taskCreateArgsOf({ repo, title: '核算纹波', author: 'carol' }), /认不出的参数 author/],
    ['建任务时给 from：任务不记来自哪条评论', () => taskCreateArgsOf({ repo, title: '核算纹波', from: '20260926100000-bbbbbba' }), /认不出的参数 from/],
    ['建任务时给 group：任务归到哪一块用 module', () => taskCreateArgsOf({ repo, title: '核算纹波', group: '机柜' }), /认不出的参数 group/],
    ['改任务时多给了键', () => taskUpdateArgsOf({ repo, id: 'x', fields: {}, force: true }), /认不出的参数 force/],
    ['改任务时 id 不是字符串', () => taskUpdateArgsOf({ repo, id: 1, fields: {} }), /id 要是任务的记录 id/],
    ['缺 repo', () => taskCreateArgsOf({ title: '核算纹波' }), /绝对路径/],
  ]
  for (const [name, parse, message] of rejected) {
    it(`拒绝：${name}`, () => {
      expect(parse).toThrow(CollabRejected)
      expect(parse).toThrow(message)
    })
  }
})
