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

const moduleKind: WritableRecordKind = { type: 'module', noun: '模块' }

/** collab.module.create 的参数：除 repo 以外都是模块的字段；模块不存状态，也没有开始日。字段的格式交给写入规则查 */
export function moduleCreateArgsOf(args: unknown): { repo: string; fields: Record<string, unknown> } {
  const { repo, ...fields } = argsOf(args, ['repo', 'title', 'due', 'owner', 'detail'])
  return { repo: repoOf({ repo }), fields }
}

export function moduleUpdateArgsOf(args: unknown): { repo: string; id: string; fields: unknown } {
  return recordUpdateArgsOf(args, moduleKind)
}

/** 建一条模块写进工作区：作者是本机身份 */
export function createModule(project: Project, fields: Record<string, unknown>): Promise<RecordWritten> {
  return createRecordInWorkingTree(project, { type: 'module', ...fields })
}

export function updateModule(project: Project, id: string, fields: unknown): Promise<RecordWritten> {
  return updateRecordOfKind(project, moduleKind, id, fields)
}

export function moduleDeleteArgsOf(args: unknown): { repo: string; ids: string[] } {
  return recordDeleteArgsOf(args, moduleKind)
}

export function deleteModules(project: Project, ids: string[], projectLeads: string[]): Promise<RecordsDeleted> {
  return deleteRecordsOfKind(project, moduleKind, ids, projectLeads)
}
