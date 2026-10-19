import { formatUtc8 } from '@godcreator/utc8-time'
import { parse } from 'yaml'
import { reactionsField, reactionsOf, type Reactions } from './reactions.js'

/**
 * 评论在磁盘上的形状：评论目录下一串一个文件夹 <threadId>/，串头是 index.mdx，回复是 <replyId>.mdx，
 * 同目录还可以放附件。每个文件是 frontmatter 加 MDX 正文；作者只存人员 id
 */
export const THREAD_HEAD_FILE = 'index.mdx'

/** 串头与回复共用的 id 形状：20261012t153000-ab12 */
export const COMMENT_ID_PATTERN = /^\d{8}t\d{6}-[0-9a-z]{2,8}$/

/** 写评论被拒：请求里缺东西、id 形状不对、要回复或删除的评论不存在、已解决的再标已解决。status 是要回给浏览器的 HTTP 状态码 */
export class CommentWriteRejected extends Error {
  readonly status: number

  constructor(status: 400 | 404 | 409, message: string) {
    super(message)
    this.status = status
  }
}

/** id 里的时刻是东八区（UTC+8），不随写评论那台电脑的时区变 */
export function newCommentId(now = new Date()): string {
  const stamp = formatUtc8(now, 'yyyyMMddtHHmmss')
  const random = Math.random().toString(36).slice(2, 6)
  return `${stamp}-${random}`
}

/** id 先过形状校验再拼路径，杜绝路径穿越 */
export function assertCommentId(id: string, what: string): void {
  if (!COMMENT_ID_PATTERN.test(id)) throw new CommentWriteRejected(400, `${what} 不是合法 id：${JSON.stringify(id)}`)
}

/**
 * 写出一个评论文件。不变式：每个值写成 JSON 字符串，它同时是 YAML 双引号标量，按 YAML 读回（parseCommentFile、
 * fumadocs-mdx 的 frontmatter）得到原值；换行等控制字符都被转义，每个字段占一行
 */
export function serializeCommentFile(fields: Record<string, string>, body: string): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  return `---\n${lines.join('\n')}\n---\n\n${body.trimEnd()}\n`
}

/** 一串评论标为已解决的记录：谁（人员 id）、什么时候（ISO 时刻） */
export interface ThreadResolution {
  by: string
  at: string
}

/** 一个评论文件读出来的内容：frontmatter 字段加正文；path 是相对评论目录的路径。resolved 只有串头会有，reactions 只在有人点过表情时有 */
export interface CommentFileOnDisk {
  path: string
  page?: string
  anchor?: string
  authorId: string
  createdAt: string
  resolved?: ThreadResolution
  reactions?: Reactions
  body: string
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/**
 * 串头 frontmatter 里的状态：status 是 "open" 或 "resolved"，不写等于 "open"；
 * resolved 时 resolvedBy（人员 id）与 resolvedAt（ISO 时刻）都要有，open 时两项都不能有
 */
export const threadStatusFields = ['status', 'resolvedBy', 'resolvedAt'] as const

/** 按 frontmatter 字段读出串的状态；file 用于报错时点名 */
export function threadResolutionOf(file: string, fields: Readonly<Record<string, unknown>>): ThreadResolution | undefined {
  const status = optionalStringField(file, fields, 'status') ?? 'open'
  const by = optionalStringField(file, fields, 'resolvedBy')
  const at = optionalStringField(file, fields, 'resolvedAt')
  if (status === 'open') {
    if (by !== undefined || at !== undefined) throw new Error(`${file} 的 status 是 open，不能有 resolvedBy / resolvedAt`)
    return undefined
  }
  if (status !== 'resolved') throw new Error(`${file} 的 status 只能是 open 或 resolved，收到 ${JSON.stringify(status)}`)
  if (by === undefined || by === '' || at === undefined || at === '') throw new Error(`${file} 的 status 是 resolved，要有 resolvedBy 与 resolvedAt`)
  return { by, at }
}

/** 按串的状态写 frontmatter 字段：三项换成新状态，放在原来 status 的位置（没有就放最后），别的字段次序不变 */
export function withThreadResolution(fields: Readonly<Record<string, string>>, resolved: ThreadResolution | undefined): Record<string, string> {
  const statusEntries: Array<[string, string]> = resolved === undefined ? [['status', 'open']] : [['status', 'resolved'], ['resolvedBy', resolved.by], ['resolvedAt', resolved.at]]
  const entries = Object.entries(fields)
  const statusIndex = entries.findIndex(([key]) => key === 'status')
  const before = statusIndex === -1 ? entries : entries.slice(0, statusIndex)
  const after = statusIndex === -1 ? [] : entries.slice(statusIndex)
  const isStatusField = ([key]: [string, string]) => (threadStatusFields as readonly string[]).includes(key)
  return Object.fromEntries([...before.filter((entry) => !isStatusField(entry)), ...statusEntries, ...after.filter((entry) => !isStatusField(entry))])
}

function frontmatterFieldsOf(file: string, yamlText: string): Record<string, unknown> {
  let fields: unknown
  try {
    // core schema：不把 2026-10-12T08:00:00Z 这类值转成 Date，读回的都是写进去的字符串
    fields = parse(yamlText, { schema: 'core' })
  } catch (error) {
    throw new Error(`${file} 的 frontmatter 不是合法 YAML：${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) throw new Error(`${file} 的 frontmatter 要是「字段: 值」的映射`)
  return fields as Record<string, unknown>
}

function optionalStringField(file: string, fields: Record<string, unknown>, key: string): string | undefined {
  const value = fields[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${file} 的 ${key} 要是字符串，收到 ${JSON.stringify(value)}`)
  return value
}

function requiredStringField(file: string, fields: Record<string, unknown>, key: string): string {
  const value = optionalStringField(file, fields, key)
  if (value === undefined || value === '') throw new Error(`${file} 缺 ${key} 字段`)
  return value
}

function frontmatterAndBodyOf(file: string, text: string): { fields: Record<string, unknown>; body: string } {
  const match = frontmatterPattern.exec(text)
  if (!match) throw new Error(`${file} 没有 frontmatter`)
  return { fields: frontmatterFieldsOf(file, match[1]!), body: text.slice(match[0].length).trim() }
}

/** 回复不带状态：状态只记在串头上 */
function assertNoThreadStatus(file: string, fields: Readonly<Record<string, unknown>>): void {
  const statusField = threadStatusFields.find((key) => fields[key] !== undefined)
  if (statusField !== undefined) throw new Error(`${file} 是回复，不能有 ${statusField}：状态只写在串头 ${THREAD_HEAD_FILE} 里`)
}

/** 读一个评论文件的文字；file 是相对评论目录的路径，报错时点名它。不是评论文件的形状直接报错 */
export function parseCommentFile(file: string, text: string): CommentFileOnDisk {
  const { fields, body } = frontmatterAndBodyOf(file, text)
  const page = optionalStringField(file, fields, 'page')
  const anchor = optionalStringField(file, fields, 'anchor')
  const isThreadHead = file.replaceAll('\\', '/').split('/').at(-1) === THREAD_HEAD_FILE
  if (!isThreadHead) assertNoThreadStatus(file, fields)
  const resolved = isThreadHead ? threadResolutionOf(file, fields) : undefined
  const reactions = reactionsOf(file, fields[reactionsField])
  return {
    path: file.replaceAll('\\', '/'),
    ...(page !== undefined ? { page } : {}),
    ...(anchor !== undefined && anchor !== '' ? { anchor } : {}),
    authorId: requiredStringField(file, fields, 'author'),
    createdAt: requiredStringField(file, fields, 'createdAt'),
    ...(resolved !== undefined ? { resolved } : {}),
    ...(Object.keys(reactions).length > 0 ? { reactions } : {}),
    body,
  }
}

/** 改写串头用：frontmatter 的全部字段（都要是字符串，serializeCommentFile 写出来的就是这样）与正文 */
export function parseCommentFileForRewrite(file: string, text: string): { fields: Record<string, string>; body: string } {
  const { fields, body } = frontmatterAndBodyOf(file, text)
  const stringFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (typeof value !== 'string') throw new Error(`${file} 的 ${key} 要是字符串，收到 ${JSON.stringify(value)}`)
      return [key, value]
    }),
  )
  return { fields: stringFields, body }
}
