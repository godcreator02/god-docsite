import { isPlainObject } from '../plain-object.js'

/** 协作记录（记录文件、人员列表）格式不对时抛出；消息写明错在哪，给人和 AI 直接看 */
export class CollabFormatError extends Error {
  override name = 'CollabFormatError'
}

export type RecordType = 'task' | 'module'
export type TaskStatus = 'todo' | 'doing' | 'done'

type RecordBase<T extends RecordType> = { id: string; type: T; author: string }

export type TaskRecord = RecordBase<'task'> & {
  status: TaskStatus
  title: string
  owner?: string
  due?: string
  /** 和这件事有关的页面地址，如 /plan/control-plan */
  page?: string
  detail?: string
  /** 所属模块的记录 id */
  module?: string
}
/** 模块：一块大的工作，只有截止日，画在任务页的甘特图上；具体的小任务用 module 字段归进来。模块不存状态，进度由它的任务算出 */
export type ModuleRecord = RecordBase<'module'> & {
  title: string
  due: string
  owner?: string
  detail?: string
}

export type CollabRecord = TaskRecord | ModuleRecord

export type FieldKind = 'text' | 'recordId' | 'personId' | 'date' | 'taskStatus'
type FieldSpec = { key: string; kind: FieldKind; required: boolean }

const required = (key: string, kind: FieldKind): FieldSpec => ({ key, kind, required: true })
const optional = (key: string, kind: FieldKind): FieldSpec => ({ key, kind, required: false })

/** 每种记录在 id、type、author 之后的字段，顺序就是写出时的键序 */
export const recordFields: Record<RecordType, FieldSpec[]> = {
  task: [
    required('status', 'taskStatus'),
    required('title', 'text'),
    optional('owner', 'personId'),
    optional('due', 'date'),
    optional('page', 'text'),
    optional('detail', 'text'),
    optional('module', 'recordId'),
  ],
  module: [required('title', 'text'), required('due', 'date'), optional('owner', 'personId'), optional('detail', 'text')],
}

/** 别人的记录只能改这些字段；作者能改自己记录里除 id、type、author 以外的任何字段 */
export const fieldsAnyoneMayChange: Record<RecordType, string[]> = {
  task: ['status', 'owner', 'due', 'title', 'module'],
  module: ['title', 'owner', 'due'],
}

export const taskStatuses: TaskStatus[] = ['todo', 'doing', 'done']

const recordIdPattern = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-[a-z0-9]{7}$/
const idSuffixPattern = /^[a-z0-9]{7}$/
const idSuffixAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function isRecordId(value: unknown): value is string {
  return typeof value === 'string' && recordIdPattern.test(value)
}

function randomIdSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  return Array.from(bytes, (byte) => idSuffixAlphabet[byte % idSuffixAlphabet.length]).join('')
}

/** 14 位作者电脑上的本地时间（年月日时分秒）加 `-` 加 7 位小写字母数字；时间只给人看，不参与任何判断 */
export function newRecordId(now: Date = new Date(), suffix: string = randomIdSuffix()): string {
  if (!idSuffixPattern.test(suffix)) throw new CollabFormatError(`id 的随机段必须是 7 位小写字母数字，收到 ${suffix}`)
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  const localTime = `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${localTime}-${suffix}`
}

/** 读出 id 里记的本地时刻，形如 `2026-09-25 14:32:01` */
export function recordTime(id: string): string {
  const match = recordIdPattern.exec(id)
  if (!match) throw new CollabFormatError(`不是记录 id：${id}`)
  const [, year, month, day, hour, minute, second] = match
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const conflictMarkerPattern = /^(<{7}|={7}|>{7}|\|{7})( |$)/

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function checkField(key: string, kind: FieldKind, value: unknown): unknown {
  switch (kind) {
    case 'text':
    case 'personId':
      if (!isNonEmptyString(value)) throw new CollabFormatError(`字段 ${key} 必须是非空字符串`)
      return value
    case 'recordId':
      if (!isRecordId(value)) throw new CollabFormatError(`字段 ${key} 必须是记录 id，收到 ${JSON.stringify(value)}`)
      return value
    case 'date':
      if (typeof value !== 'string' || !datePattern.test(value)) throw new CollabFormatError(`字段 ${key} 必须是 YYYY-MM-DD 格式的日期，收到 ${JSON.stringify(value)}`)
      return value
    case 'taskStatus':
      if (typeof value !== 'string' || !(taskStatuses as string[]).includes(value)) throw new CollabFormatError(`字段 ${key} 只能是 ${taskStatuses.join('、')}，收到 ${JSON.stringify(value)}`)
      return value
  }
}

/** 校验一条记录并按规定键序重新组装：id、type、author 在前，其余照 recordFields 的顺序，没有的字段不出现 */
function checkRecord(value: unknown): CollabRecord {
  if (!isPlainObject(value)) throw new CollabFormatError('记录必须是一个 JSON 对象')
  if (value.type === undefined) throw new CollabFormatError('缺少字段 type')
  if (typeof value.type !== 'string' || !(value.type in recordFields)) throw new CollabFormatError(`认不出的记录类型 ${String(value.type)}：collab/records/ 里只有任务 task 与模块 module，评论在站点的 comments/ 里`)
  const type = value.type as RecordType
  const specs = recordFields[type]
  const allowedKeys = new Set(['id', 'type', 'author', ...specs.map((spec) => spec.key)])
  const unknownKey = Object.keys(value).sort().find((key) => !allowedKeys.has(key))
  if (unknownKey) throw new CollabFormatError(`${type} 记录里认不出的字段 ${unknownKey}`)

  if (value.id === undefined) throw new CollabFormatError('缺少字段 id')
  if (!isRecordId(value.id)) throw new CollabFormatError(`id 格式不对：${JSON.stringify(value.id)}（应为 14 位本地时间加 - 加 7 位小写字母数字）`)
  if (value.author === undefined) throw new CollabFormatError('缺少字段 author')
  if (!isNonEmptyString(value.author)) throw new CollabFormatError('字段 author 必须是非空字符串')

  const record: Record<string, unknown> = { id: value.id, type, author: value.author }
  for (const spec of specs) {
    const fieldValue = value[spec.key]
    if (fieldValue === undefined) {
      if (spec.required) throw new CollabFormatError(`${type} 记录缺少字段 ${spec.key}`)
      continue
    }
    record[spec.key] = checkField(spec.key, spec.kind, fieldValue)
  }
  return record as CollabRecord
}

/** 一个文件一条记录：两格缩进、一个字段一行、中文不转义、以换行结尾；同一条记录每次编码出的字节相同 */
export function encodeRecordFile(record: CollabRecord): string {
  return `${JSON.stringify(checkRecord(record), null, 2)}\n`
}

export function decodeRecordFile(content: string): CollabRecord {
  const markerLines = content
    .split('\n')
    .flatMap((line, index) => (conflictMarkerPattern.test(line) ? [index + 1] : []))
  if (markerLines.length > 0) {
    throw new CollabFormatError(`git 合并冲突没解决完（第 ${markerLines.join('、')} 行是冲突标记）：让 AI 按两边的意思改好这条记录`)
  }
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    throw new CollabFormatError(`不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  return checkRecord(value)
}
