import { parsePeople } from './people.js'
import { isPlainObject } from './plain-object.js'
import { CollabFormatError, encodeRecordFile, fieldsAnyoneMayChange, newRecordId, type CollabRecord } from './records.js'
import { newFormatProblems, readRecords, recordFileOf, type CollabSnapshot, type LocatedRecord } from './state.js'

/** 写入请求不合规：身份没有或不在人员列表里、记录格式不对、写入后多出了新问题；消息直接给人看 */
export class WriteRejected extends Error {
  override name = 'WriteRejected'
}

/** 一次写入要对 collab/ 做的改动：write 是要写的文件与内容，remove 是要删的文件，路径都相对 collab/ */
export type WritePlan = { write: Array<{ file: string; content: string }>; remove: string[] }

type PlanRequest = { snapshot: CollabSnapshot; person: string | null; body: Record<string, unknown> }

/** 身份要在人员列表里 */
function requirePerson(person: string | null, snapshot: CollabSnapshot): string {
  if (person === null) throw new WriteRejected('没有本机身份，写不了：站点要经 gwb-docsite 启动，本 home 的身份码要在 site/people.json 里')
  if (snapshot.people === null) throw new WriteRejected('site/people.json 不存在')
  if (!parsePeople(snapshot.people).some((entry) => entry.id === person)) throw new WriteRejected(`身份 ${person} 不在 site/people.json 里`)
  return person
}

function encodeOrReject(record: Record<string, unknown>): string {
  try {
    return encodeRecordFile(record as CollabRecord)
  } catch (error) {
    if (error instanceof CollabFormatError) throw new WriteRejected(error.message)
    throw error
  }
}

/** 只拦这次写入带来的新格式问题；collab/ 里原本就有的问题照旧列在网站顶部的提示栏里 */
function rejectNewProblems(before: CollabSnapshot, after: CollabSnapshot) {
  const fresh = newFormatProblems(before, after)
  if (fresh.length > 0) throw new WriteRejected(fresh.map((problem) => problem.message).join('；'))
}

function changedKeys(before: CollabRecord, after: Record<string, unknown>): string[] {
  const valueOf = (record: Record<string, unknown>, key: string) => JSON.stringify(record[key])
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => valueOf(before, key) !== valueOf(after, key))
}

/** 作者能改自己记录里除 id、type、author 以外的任何字段；别人的记录只能改 fieldsAnyoneMayChange 里的那几个 */
function rejectForbiddenChanges(record: CollabRecord, changed: Record<string, unknown>, actor: string) {
  if (actor === record.author) return
  const allowed = fieldsAnyoneMayChange[record.type]
  const forbidden = changedKeys(record, changed).filter((key) => !allowed.includes(key))
  if (forbidden.length === 0) return
  throw new WriteRejected(`${actor} 改了 ${record.author} 的记录 ${record.id} 的 ${forbidden.join('、')}；别人的 ${record.type} 记录只能改 ${allowed.join('、')}`)
}

function withFile(snapshot: CollabSnapshot, file: string, content: string): CollabSnapshot {
  return { ...snapshot, files: { ...snapshot.files, [file]: content } }
}

/** 新建一条记录：补上 id 与作者，计划写成新文件 records/<id>.json；id 是新记录的 id */
export function planCreate({ snapshot, person, body }: PlanRequest): { plan: WritePlan; id: string } {
  const author = requirePerson(person, snapshot)
  for (const key of ['id', 'author']) {
    if (key in body) throw new WriteRejected(`新记录的 id 与 author 由写入规则补上，不能自带 ${key}`)
  }
  const id = newRecordId()
  const content = encodeOrReject({ ...body, id, author })
  const file = recordFileOf(id)
  rejectNewProblems(snapshot, withFile(snapshot, file, content))
  return { plan: { write: [{ file, content }], remove: [] }, id }
}

function parseUpdateBody(body: Record<string, unknown>): { id: string; fields: Record<string, unknown> } {
  const unknownKey = Object.keys(body).find((key) => key !== 'id' && key !== 'fields')
  if (unknownKey) throw new WriteRejected(`修改请求里认不出的字段 ${unknownKey}；只接受 id 与 fields`)
  const { id, fields } = body
  if (typeof id !== 'string') throw new WriteRejected('修改请求要给出记录的 id')
  if (!isPlainObject(fields) || Object.keys(fields).length === 0) {
    throw new WriteRejected('修改请求的 fields 要是一个至少含一个字段的对象')
  }
  for (const key of ['id', 'type', 'author']) {
    if (key in fields) throw new WriteRejected(`记录的 ${key} 不能改`)
  }
  return { id, fields: fields as Record<string, unknown> }
}

/** id 对应的那条记录；没有、或者出现在不止一个文件里时拒绝 */
function locateOnlyRecord(records: LocatedRecord[], id: string): LocatedRecord {
  const matches = records.filter((entry) => entry.record.id === id)
  if (matches.length === 0) throw new WriteRejected(`没有 id 为 ${id} 的记录`)
  if (matches.length > 1) throw new WriteRejected(`id ${id} 出现了 ${matches.length} 次（${matches.map((entry) => entry.file).join('、')}），先把重复解决掉`)
  return matches[0]!
}

/** 修改一条记录的字段：计划改写它的文件；作者以外的人能改哪些字段由 rejectForbiddenChanges 判断 */
export function planUpdate({ snapshot, person, body }: PlanRequest): WritePlan {
  const { id, fields } = parseUpdateBody(body)
  const actor = requirePerson(person, snapshot)
  const { record, file } = locateOnlyRecord(readRecords(snapshot).records, id)
  const changed = { ...record, ...fields }
  rejectForbiddenChanges(record, changed, actor)
  const content = encodeOrReject(changed)
  rejectNewProblems(snapshot, withFile(snapshot, file, content))
  return { write: [{ file, content }], remove: [] }
}

function parseDeleteBody(body: Record<string, unknown>): string[] {
  const unknownKey = Object.keys(body).find((key) => key !== 'ids')
  if (unknownKey) throw new WriteRejected(`删除请求里认不出的字段 ${unknownKey}；只接受 ids`)
  const { ids } = body
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    throw new WriteRejected('删除请求的 ids 要是一个至少含一个记录 id 的字符串数组')
  }
  const recordIds = ids as string[]
  const repeated = recordIds.find((id, index) => recordIds.indexOf(id) !== index)
  if (repeated !== undefined) throw new WriteRejected(`ids 里 ${repeated} 写了不止一次`)
  return recordIds
}

function rejectUndeletable({ record }: LocatedRecord, actor: string, actorIsLead: boolean) {
  if (actor !== record.author && !actorIsLead) throw new WriteRejected(`${actor} 删不了 ${record.author} 的记录 ${record.id}；任务和模块只有作者和负责人能删`)
}

/** 要删的模块下还有没一起删的任务时拒绝并列出：任务归到哪里由人决定，不替人清空它的 module */
function rejectModulesWithRemainingTasks(records: LocatedRecord[], deletingIds: ReadonlySet<string>) {
  const blocked: string[] = []
  for (const { record: module } of records) {
    if (module.type !== 'module' || !deletingIds.has(module.id)) continue
    const remainingTasks = records.flatMap(({ record }) => (record.type === 'task' && record.module === module.id && !deletingIds.has(record.id) ? [record] : []))
    if (remainingTasks.length > 0) blocked.push(`模块 ${module.id}（${module.title}）下还有任务：${remainingTasks.map((task) => `${task.id}（${task.title}）`).join('、')}`)
  }
  if (blocked.length > 0) throw new WriteRejected(`${blocked.join('；')}；先把这些任务删掉或改到别的模块，再删模块`)
}

function withoutFiles(snapshot: CollabSnapshot, files: string[]): CollabSnapshot {
  const remaining = { ...snapshot.files }
  for (const file of files) delete remaining[file]
  return { ...snapshot, files: remaining }
}

/**
 * 计划删掉 ids 列出的任务与模块的记录文件，作者本人或负责人才能删；有一条删不了就整次拒绝，计划里一个文件都不删。
 * projectLeads 是协作仓的负责人（Gitea 上协作仓的协作者），由调用方从 Gitea 读来交给这里
 */
export function planDelete({ snapshot, person, body, projectLeads }: PlanRequest & { projectLeads: string[] }): WritePlan {
  const ids = parseDeleteBody(body)
  const actor = requirePerson(person, snapshot)
  const actorIsLead = projectLeads.includes(actor)
  const { records } = readRecords(snapshot)
  const deleting = ids.map((id) => locateOnlyRecord(records, id))
  for (const located of deleting) rejectUndeletable(located, actor, actorIsLead)
  rejectModulesWithRemainingTasks(records, new Set(ids))
  const files = deleting.map((located) => located.file)
  rejectNewProblems(snapshot, withoutFiles(snapshot, files))
  return { write: [], remove: files }
}
