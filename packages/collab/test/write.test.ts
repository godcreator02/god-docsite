import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRecord, deleteRecords, updateRecord, WriteRejected } from '../src/task-model/node.js'
import { fileOf, filesOf, moduleRecord, peopleText, task, taskId, textOf } from './fixtures.js'
import { repoOnDisk, writeCollabFile } from './repo-on-disk.js'

let repo: string

beforeEach(() => {
  repo = repoOnDisk(filesOf(task), peopleText)
})

const readRecordFile = (file: string) => readFileSync(path.join(repo, 'collab', file), 'utf8')
const recordFiles = () => readdirSync(path.join(repo, 'collab', 'records')).sort()

describe('新建记录', () => {
  it('补上 id 与作者，按规范写法写成 collab/records/ 下的新文件，不动已有的', async () => {
    const { id } = await createRecord({ repo, person: 'carol-test', body: { type: 'task', status: 'todo', title: '画原理图' } })
    expect(id).toMatch(/^\d{14}-[a-z0-9]{7}$/)
    expect(readRecordFile(`records/${id}.json`)).toBe(textOf({ id, type: 'task', author: 'carol-test', status: 'todo', title: '画原理图' }))
    expect(recordFiles()).toEqual([`${taskId}.json`, `${id}.json`].sort())
    expect(readRecordFile(fileOf(task))).toBe(textOf(task))
  })

  it('records/ 目录还没有时新建', async () => {
    const emptyRepo = repoOnDisk({}, peopleText)
    const { id } = await createRecord({ repo: emptyRepo, person: 'godcreator', body: { type: 'task', status: 'todo', title: '第一个任务' } })
    expect(readdirSync(path.join(emptyRepo, 'collab', 'records'))).toEqual([`${id}.json`])
  })

  it('collab/ 里别处原本就有的问题不挡这次写入', async () => {
    writeCollabFile(repo, fileOf(task), `<<<<<<< HEAD\n${textOf(task)}`)
    await expect(createRecord({ repo, person: 'carol-test', body: { type: 'task', status: 'todo', title: '画原理图' } })).resolves.toMatchObject({})
  })

  const newTask = { type: 'task', status: 'todo', title: '画原理图' }
  const rejected: Array<[string, string | null, Record<string, unknown>, RegExp]> = [
    ['没有本机身份', null, newTask, /没有本机身份/],
    ['身份不在人员列表里', 'dave', newTask, /dave 不在 site\/people\.json/],
    ['自带 id', 'bob-test', { ...newTask, id: '20260925000000-aaaaaaa' }, /不能自带 id/],
    ['自带作者', 'bob-test', { ...newTask, author: 'carol-test' }, /不能自带 author/],
    ['记录格式不对', 'bob-test', { type: 'task', status: 'todo' }, /缺少字段 title/],
    ['评论不再是记录', 'bob-test', { type: 'comment', status: 'open', text: '看看' }, /评论在站点的 comments\//],
    ['负责人不在人员列表里', 'bob-test', { ...newTask, owner: 'dave' }, /负责人 dave 不在 site\/people\.json/],
  ]
  for (const [name, person, body, message] of rejected) {
    it(`拒绝：${name}，不写文件`, async () => {
      await expect(createRecord({ repo, person, body })).rejects.toThrow(WriteRejected)
      await expect(createRecord({ repo, person, body })).rejects.toThrow(message)
      expect(recordFiles()).toEqual([`${taskId}.json`])
    })
  }
})

describe('修改记录', () => {
  it('别人改任务状态：直接改写那条记录的文件', async () => {
    await updateRecord({ repo, person: 'bob-test', body: { id: taskId, fields: { status: 'doing' } } })
    expect(readRecordFile(fileOf(task))).toBe(textOf({ ...task, status: 'doing' }))
  })

  it('作者改自己的说明', async () => {
    await updateRecord({ repo, person: 'godcreator', body: { id: taskId, fields: { detail: '对比三个通道' } } })
    expect(readRecordFile(fileOf(task))).toBe(textOf({ ...task, detail: '对比三个通道' }))
  })

  const rejected: Array<[string, string | null, Record<string, unknown>, RegExp]> = [
    ['没有本机身份', null, { id: taskId, fields: { status: 'done' } }, /没有本机身份/],
    ['改别人的说明', 'carol-test', { id: taskId, fields: { detail: '改掉' } }, /carol-test 改了 godcreator 的记录 .* 的 detail；别人的 task 记录只能改 status、owner、due、title、module/],
    ['记录不存在', 'carol-test', { id: '20260925000000-zzzzzzz', fields: { status: 'done' } }, /没有 id 为 20260925000000-zzzzzzz 的记录/],
    ['改作者', 'godcreator', { id: taskId, fields: { author: 'carol-test' } }, /author 不能改/],
    ['一个字段都没给', 'godcreator', { id: taskId, fields: {} }, /至少含一个字段/],
    ['请求里有认不出的字段', 'godcreator', { id: taskId, fields: { status: 'done' }, force: true }, /认不出的字段 force/],
    ['值不合规', 'godcreator', { id: taskId, fields: { status: 'blocked' } }, /status 只能是 todo、doing、done/],
  ]
  for (const [name, person, body, message] of rejected) {
    it(`拒绝：${name}，文件不变`, async () => {
      await expect(updateRecord({ repo, person, body })).rejects.toThrow(WriteRejected)
      await expect(updateRecord({ repo, person, body })).rejects.toThrow(message)
      expect(readRecordFile(fileOf(task))).toBe(textOf(task))
    })
  }
})

describe('删除记录', () => {
  /** beforeEach 之外再放：bob-test 建的任务、负责人建的模块和归进它的一条任务 */
  const bobsTask = { id: '20260926090000-b0b7a5k', type: 'task', author: 'bob-test', status: 'doing', title: '画采样板原理图' } as const
  const taskInModule = { id: '20260926100000-m0d7a5k', type: 'task', author: 'carol-test', status: 'todo', title: '选 ADC', module: moduleRecord.id } as const

  beforeEach(() => {
    for (const record of [bobsTask, moduleRecord, taskInModule]) writeCollabFile(repo, fileOf(record), textOf(record))
  })

  const projectLeads = ['godcreator']

  const allFiles = () => [taskId, bobsTask.id, moduleRecord.id, taskInModule.id].map((id) => `${id}.json`).sort()

  it('作者删自己的任务：只删那条记录的文件，回执列出删掉的文件', async () => {
    expect(await deleteRecords({ repo, person: 'bob-test', body: { ids: [bobsTask.id] }, projectLeads })).toEqual({ files: [fileOf(bobsTask)] })
    expect(recordFiles()).toEqual(allFiles().filter((file) => file !== `${bobsTask.id}.json`))
  })

  it('负责人（协作仓的协作者）删别人的任务', async () => {
    await deleteRecords({ repo, person: 'godcreator', body: { ids: [bobsTask.id] }, projectLeads })
    expect(recordFiles()).not.toContain(`${bobsTask.id}.json`)
  })

  it('模块连同归进它的任务一次删掉', async () => {
    await deleteRecords({ repo, person: 'godcreator', body: { ids: [moduleRecord.id, taskInModule.id] }, projectLeads })
    expect(recordFiles()).toEqual([taskId, bobsTask.id].map((id) => `${id}.json`).sort())
  })

  const rejected: Array<[string, string | null, Record<string, unknown>, RegExp]> = [
    ['不是作者也不是负责人', 'carol-test', { ids: [bobsTask.id] }, new RegExp(`carol-test 删不了 bob-test 的记录 ${bobsTask.id}；任务和模块只有作者和负责人能删`)],
    [
      '模块下还有没一起删的任务',
      'godcreator',
      { ids: [moduleRecord.id] },
      new RegExp(`模块 ${moduleRecord.id}（采样板）下还有任务：${taskInModule.id}（选 ADC）；先把这些任务删掉或改到别的模块`),
    ],
    ['有一条删不了，能删的也不删', 'bob-test', { ids: [bobsTask.id, taskId] }, /bob-test 删不了 godcreator 的记录/],
    ['记录不存在', 'godcreator', { ids: ['20260925000000-zzzzzzz'] }, /没有 id 为 20260925000000-zzzzzzz 的记录/],
    ['没有本机身份', null, { ids: [bobsTask.id] }, /没有本机身份/],
    ['ids 是空数组', 'bob-test', { ids: [] }, /ids 要是一个至少含一个记录 id 的字符串数组/],
    ['ids 不是数组', 'bob-test', { ids: bobsTask.id }, /ids 要是一个至少含一个记录 id 的字符串数组/],
    ['同一个 id 写了两次', 'bob-test', { ids: [bobsTask.id, bobsTask.id] }, new RegExp(`ids 里 ${bobsTask.id} 写了不止一次`)],
    ['请求里有认不出的字段', 'bob-test', { ids: [bobsTask.id], force: true }, /认不出的字段 force；只接受 ids/],
  ]
  for (const [name, person, body, message] of rejected) {
    it(`拒绝：${name}，一个文件都不删`, async () => {
      await expect(deleteRecords({ repo, person, body, projectLeads })).rejects.toThrow(WriteRejected)
      await expect(deleteRecords({ repo, person, body, projectLeads })).rejects.toThrow(message)
      expect(recordFiles()).toEqual(allFiles())
    })
  }
})
