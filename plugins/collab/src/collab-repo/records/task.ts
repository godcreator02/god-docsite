import { type Project } from '../../project/project.js'
import {
  createRecordInWorkingTree,
  deleteRecordsOfKind,
  recordDeleteArgsOf,
  recordUpdateArgsOf,
  updateRecordOfKind,
  type RecordsDeleted,
  type RecordWritten,
  type WritableRecordKind,
} from './record-write.js'
import { argsOf, repoOf } from '../../commands.js'

const taskKind: WritableRecordKind = { type: 'task', noun: '任务' }

/** collab.task.create 的参数：除 repo 以外都是任务的字段；没有 status，新任务一律是 todo。字段的格式交给写入规则查 */
export function taskCreateArgsOf(args: unknown): { repo: string; fields: Record<string, unknown> } {
  const { repo, ...fields } = argsOf(args, ['repo', 'title', 'owner', 'due', 'page', 'detail', 'module'])
  return { repo: repoOf({ repo }), fields }
}

export function taskUpdateArgsOf(args: unknown): { repo: string; id: string; fields: unknown } {
  return recordUpdateArgsOf(args, taskKind)
}

/** 建一条任务写进工作区：作者是本机身份，status 是 todo */
export function createTask(project: Project, fields: Record<string, unknown>): Promise<RecordWritten> {
  return createRecordInWorkingTree(project, { type: 'task', status: 'todo', ...fields })
}

export function updateTask(project: Project, id: string, fields: unknown): Promise<RecordWritten> {
  return updateRecordOfKind(project, taskKind, id, fields)
}

export function taskDeleteArgsOf(args: unknown): { repo: string; ids: string[] } {
  return recordDeleteArgsOf(args, taskKind)
}

export function deleteTasks(project: Project, ids: string[], projectLeads: string[]): Promise<RecordsDeleted> {
  return deleteRecordsOfKind(project, taskKind, ids, projectLeads)
}
