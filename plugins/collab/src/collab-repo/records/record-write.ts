import { collabPathInRepo, readRecords, recordFileOf, type RecordType } from '@godcreator/collab'
import { createRecord, deleteRecords, readCollabSnapshot, updateRecord } from '@godcreator/collab/node'
import { CollabRejected, rethrowAsCollabRejected } from '../../errors.js'
import type { Project } from '../../project/project.js'
import { argsOf, repoOf } from '../../commands.js'

/** 建记录、改记录的命令的回执；file 是记录文件相对仓根的路径，用 / 分隔 */
export type RecordWritten = { id: string; file: string }

/** 一条写记录的命令只写哪一种记录：noun 是报错里给人看的叫法，命令名是 collab.<type>.update */
export type WritableRecordKind = { type: RecordType; noun: string }

/** 写入规则在记录模型里（网站也走这一份），这里只把它的拒绝换成插件的拒绝，消息原样 */
async function rejectAsCollab<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    rethrowAsCollabRejected(error)
  }
}

const repoPathOf = (file: string) => `${collabPathInRepo}/${file}`

/** collab.<type>.update 的参数：fields 的形状交给写入规则查 */
export function recordUpdateArgsOf(args: unknown, kind: WritableRecordKind): { repo: string; id: string; fields: unknown } {
  const { repo, id, fields } = argsOf(args, ['repo', 'id', 'fields'])
  if (typeof id !== 'string') throw new CollabRejected(`id 要是${kind.noun}的记录 id，收到 ${JSON.stringify(id)}`)
  return { repo: repoOf({ repo }), id, fields }
}

/** 建一条记录写进工作区，作者是本机身份；body 里的字段格式交给写入规则查 */
export async function createRecordInWorkingTree(project: Project, body: Record<string, unknown>): Promise<RecordWritten> {
  const { id } = await rejectAsCollab(() => createRecord({ repo: project.repo, person: project.person, body }))
  return { id, file: repoPathOf(recordFileOf(id)) }
}

/** 改工作区里一条 kind 那种记录的字段；别人的记录能改哪些字段由写入规则里的校验决定，这里不另判 */
export async function updateRecordOfKind(project: Project, kind: WritableRecordKind, id: string, fields: unknown): Promise<RecordWritten> {
  const located = readRecords(await readCollabSnapshot(project.repo)).records.filter((entry) => entry.record.id === id)
  const otherKind = located.find((entry) => entry.record.type !== kind.type)
  if (otherKind !== undefined) {
    throw new CollabRejected(`${id} 是一条 ${otherKind.record.type} 记录，不是${kind.noun}；collab.${kind.type}.update 只改${kind.noun}`)
  }
  await rejectAsCollab(() => updateRecord({ repo: project.repo, person: project.person, body: { id, fields } }))
  // 走到这里 updateRecord 已确认这个 id 恰好对应一个文件
  return { id, file: repoPathOf(located[0]!.file) }
}

/** 删记录的命令的回执；files 是删掉的记录文件相对仓根的路径，用 / 分隔 */
export type RecordsDeleted = { ids: string[]; files: string[] }

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

/** collab.<type>.delete 的参数：ids 是记录 id 的数组；空数组、重复的 id 交给写入规则查 */
export function recordDeleteArgsOf(args: unknown, kind: WritableRecordKind): { repo: string; ids: string[] } {
  const { repo, ids } = argsOf(args, ['repo', 'ids'])
  if (!isStringArray(ids)) throw new CollabRejected(`ids 要是${kind.noun}记录 id 的数组，收到 ${JSON.stringify(ids)}`)
  return { repo: repoOf({ repo }), ids }
}

/**
 * 删工作区里 kind 那种记录的文件；ids 里混了别的种类就整次拒绝。谁能删、模块下还有任务时怎么办由写入规则决定，这里不另判。
 * projectLeads 是协作仓的负责人（Gitea 上协作仓的协作者），由调用方从 Gitea 读来
 */
export async function deleteRecordsOfKind(project: Project, kind: WritableRecordKind, ids: string[], projectLeads: string[]): Promise<RecordsDeleted> {
  const otherKinds = readRecords(await readCollabSnapshot(project.repo)).records.filter((entry) => ids.includes(entry.record.id) && entry.record.type !== kind.type)
  if (otherKinds.length > 0) {
    const described = otherKinds.map((entry) => `${entry.record.id} 是一条 ${entry.record.type} 记录`).join('、')
    throw new CollabRejected(`${described}，不是${kind.noun}；collab.${kind.type}.delete 只删${kind.noun}`)
  }
  const { files } = await rejectAsCollab(() => deleteRecords({ repo: project.repo, person: project.person, body: { ids }, projectLeads }))
  return { ids, files: files.map(repoPathOf) }
}
