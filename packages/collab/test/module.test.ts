import { beforeEach, describe, expect, it } from 'vitest'
import { collabState, decodeRecordFile, encodeRecordFile, validateCollab, type CollabProblem } from '../src/core/index.js'
import { updateRecord } from '../src/node/index.js'
import { fileOf, filesOf, moduleId, moduleRecord, peopleText, snapshotOf, task, taskId, textOf } from './fixtures.js'
import { repoOnDisk } from './repo-on-disk.js'

const messagesOf = (problems: CollabProblem[]) => problems.map((problem) => `${problem.file} ${problem.message}`)

describe('模块记录', () => {
  it('键序是 id、type、author、title、due、owner、detail，没有的字段不写', () => {
    const text = encodeRecordFile({ ...moduleRecord, detail: '14 路 ΣΔ 采样' })
    expect(Object.keys(JSON.parse(text) as object)).toEqual(['id', 'type', 'author', 'title', 'due', 'owner', 'detail'])
    expect(Object.keys(JSON.parse(encodeRecordFile(moduleRecord)) as object)).toEqual(['id', 'type', 'author', 'title', 'due', 'owner'])
  })

  it('标题、截止日必填，日期是 YYYY-MM-DD', () => {
    const { due: _due, ...withoutDue } = moduleRecord
    expect(() => decodeRecordFile(textOf(withoutDue))).toThrow('module 记录缺少字段 due')
    expect(() => decodeRecordFile(textOf({ ...moduleRecord, due: '10月底' }))).toThrow('YYYY-MM-DD')
  })

  it('模块没有开始日', () => {
    expect(() => decodeRecordFile(textOf({ ...moduleRecord, start: '2026-09-20' }))).toThrow('module 记录里认不出的字段 start')
  })

  it('读出状态时模块单独列出，按 id 排好', () => {
    const later = { ...moduleRecord, id: '20260921090000-m9z8y7x', title: '主控板' }
    const state = collabState(snapshotOf(filesOf(later, moduleRecord)))
    expect(state.problems).toEqual([])
    expect(state.modules.map((entry) => entry.title)).toEqual(['采样板', '主控板'])
  })

  it('负责人不在人员列表里报成问题', () => {
    expect(messagesOf(validateCollab(snapshotOf(filesOf({ ...moduleRecord, owner: 'frank' }))))).toEqual([`${fileOf(moduleRecord)} 负责人 frank 不在 site/people.json 里`])
  })
})

describe('任务所属的模块', () => {
  it('任务的 module 写模块的记录 id，读出状态时原样带上', () => {
    const state = collabState(snapshotOf(filesOf(moduleRecord, { ...task, module: moduleId })))
    expect(state.problems).toEqual([])
    expect(state.tasks[0]!.module).toBe(moduleId)
  })

  it('module 不是记录 id 的写法，读不出', () => {
    expect(() => decodeRecordFile(textOf({ ...task, module: '采样板' }))).toThrow('字段 module 必须是记录 id')
  })

  it('模块的文件读不出时，指向它的任务不再报成模块不存在', () => {
    const conflicted = '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> origin/main\n'
    const state = collabState(snapshotOf({ [fileOf(moduleRecord)]: conflicted, ...filesOf({ ...task, module: moduleId }) }))
    expect(state.problems.map((problem) => problem.file)).toEqual([fileOf(moduleRecord)])
  })
})

describe('别人能改什么', () => {
  let repo: string
  beforeEach(() => {
    repo = repoOnDisk(filesOf(moduleRecord, task), peopleText)
  })

  it('别人改模块的标题、负责人、截止日：允许；改说明：不允许', async () => {
    await updateRecord({ repo, person: 'carol-test', body: { id: moduleId, fields: { title: '采样板 v2', owner: 'carol-test', due: '2026-11-05' } } })
    await expect(updateRecord({ repo, person: 'carol-test', body: { id: moduleId, fields: { detail: '改一下' } } })).rejects.toThrow(
      `carol-test 改了 godcreator 的记录 ${moduleId} 的 detail；别人的 module 记录只能改 title、owner、due`,
    )
  })

  it('别人把任务归进一个模块：允许', async () => {
    await updateRecord({ repo, person: 'bob-test', body: { id: taskId, fields: { module: moduleId } } })
  })
})
