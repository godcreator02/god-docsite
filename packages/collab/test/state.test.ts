import { describe, expect, it } from 'vitest'
import { collabState } from '../src/task-model/index.js'
import { cleanSnapshot, fileOf, filesOf, moduleId, moduleRecord, snapshotOf, task, taskId, textOf } from './fixtures.js'

describe('读出当前状态', () => {
  it('任务与模块照原样列出，没有问题', () => {
    const state = collabState(cleanSnapshot)
    expect(state.problems).toEqual([])
    expect(state.tasks).toEqual([{ id: taskId, author: 'godcreator', status: 'todo', title: '补 ADC 通道对比', owner: 'carol-test', due: '2026-10-10' }])
    expect(state.modules).toEqual([{ id: moduleId, author: 'godcreator', title: '采样板', due: '2026-10-31', owner: 'bob-test' }])
  })

  it('按 id 排好，和文件的先后无关', () => {
    const later = { ...task, id: '20260926090000-bbbbbbb' }
    const state = collabState(snapshotOf(filesOf(later, task)))
    expect(state.tasks.map((entry) => entry.id)).toEqual([taskId, '20260926090000-bbbbbbb'])
  })

  it('任务所属的模块不存在、或者不是模块，列成问题', () => {
    const toMissing = { ...task, module: '20260925000000-zzzzzzz' }
    const toTask = { ...task, id: '20260925170000-ccccccc', module: taskId }
    const state = collabState(snapshotOf(filesOf(toMissing, toTask)))
    expect(state.problems).toEqual([
      { file: fileOf(toMissing), message: '任务所属的模块 20260925000000-zzzzzzz 不存在' },
      { file: fileOf(toTask), message: `任务所属的模块 ${taskId} 不是一个模块` },
    ])
  })

  it('重复的 id 只认第一次出现的，其余列成问题', () => {
    const copiedFile = 'records/20260926000000-zzzzzzz.json'
    const state = collabState(snapshotOf({ ...filesOf(task), [copiedFile]: textOf(task) }))
    expect(state.tasks).toHaveLength(1)
    expect(state.problems).toEqual([{ file: copiedFile, message: `id ${taskId} 重复（第一次出现在 ${fileOf(task)}）` }])
  })

  it('不在 records/ 下的文件不当记录读，列成认不出的文件', () => {
    const state = collabState(snapshotOf({ ...filesOf(task), 'people.json': '[]\n' }))
    expect(state.tasks).toHaveLength(1)
    expect(state.problems).toEqual([{ file: 'people.json', message: expect.stringMatching(/^认不出的文件/) }])
  })

  it('没解决完的 git 冲突：那个文件列成问题，其余文件照常读出；指向它的任务不再报模块不存在', () => {
    const conflicted = textOf(moduleRecord).replace('  "title": "采样板",\n', '<<<<<<< HEAD\n  "title": "采样板 A",\n=======\n  "title": "采样板 B",\n>>>>>>> 1a2b3c4\n')
    const inModule = { ...task, module: moduleId }
    const state = collabState(snapshotOf({ ...filesOf(inModule), [fileOf(moduleRecord)]: conflicted }))
    expect(state.problems).toEqual([{ file: fileOf(moduleRecord), message: expect.stringMatching(/冲突/) }])
    expect(state.tasks).toHaveLength(1)
  })
})
