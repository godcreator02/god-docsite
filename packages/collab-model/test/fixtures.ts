import type { CollabRecord, CollabSnapshot, ModuleRecord, TaskRecord } from '../src/task-model/index.js'

/** site/people.json：基础包的人员列表格式，协作站里 id 就是 Gitea 用户名 */
export const peopleText = `${JSON.stringify([
  { id: 'godcreator', name: '负责人', codes: ['leadcode0001'], gitea: 'godcreator' },
  { id: 'bob-test', name: '小王', codes: ['bobcode00001'], gitea: 'bob-test' },
  { id: 'carol-test', name: '小李', gitea: 'carol-test' },
  { id: 'claude', name: 'Claude', agent: true },
])}\n`

export const taskId = '20260925160530-t5v9w3d'

/** 下面几条记录的键都按规范键序写，textOf 编码出的就是规范写法 */
export const task: TaskRecord = { id: taskId, type: 'task', author: 'godcreator', status: 'todo', title: '补 ADC 通道对比', owner: 'carol-test', due: '2026-10-10' }

export const moduleId = '20260920090000-m1a2b3c'
export const moduleRecord: ModuleRecord = { id: moduleId, type: 'module', author: 'godcreator', title: '采样板', due: '2026-10-31', owner: 'bob-test' }

export const fileOf = (record: { id: string }) => `records/${record.id}.json`
export const textOf = (record: object) => `${JSON.stringify(record, null, 2)}\n`

export function filesOf(...records: CollabRecord[]): Record<string, string> {
  return Object.fromEntries(records.map((record) => [fileOf(record), textOf(record)]))
}

export function snapshotOf(files: Record<string, string>, people: string | null = peopleText): CollabSnapshot {
  return { people, files }
}

export const cleanSnapshot = snapshotOf(filesOf(task, moduleRecord))
