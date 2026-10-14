import { parse } from 'yaml'

/**
 * 评论在磁盘上的形状：评论目录下一串一个文件夹 <threadId>/，串头是 index.mdx，回复是 <replyId>.mdx，
 * 同目录还可以放附件。每个文件是 frontmatter 加 MDX 正文；作者只存人员 id
 */
export const THREAD_HEAD_FILE = 'index.mdx'

/** 串头与回复共用的 id 形状：20261012t153000-ab12 */
export const COMMENT_ID_PATTERN = /^\d{8}t\d{6}-[0-9a-z]{2,8}$/

/** 写评论被拒：请求里缺东西、id 形状不对、要回复或删除的评论不存在。status 是要回给浏览器的 HTTP 状态码 */
export class CommentWriteRejected extends Error {
  readonly status: number

  constructor(status: 400 | 404, message: string) {
    super(message)
    this.status = status
  }
}

export function newCommentId(now = new Date()): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0')
  const stamp =
    `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}` +
    `t${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}`
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

/** 一个评论文件读出来的内容：frontmatter 字段加正文；path 是相对评论目录的路径 */
export interface CommentFileOnDisk {
  path: string
  page?: string
  anchor?: string
  authorId: string
  createdAt: string
  body: string
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

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

/** 读一个评论文件的文字；file 是相对评论目录的路径，报错时点名它。不是评论文件的形状直接报错 */
export function parseCommentFile(file: string, text: string): CommentFileOnDisk {
  const match = frontmatterPattern.exec(text)
  if (!match) throw new Error(`${file} 没有 frontmatter`)
  const fields = frontmatterFieldsOf(file, match[1]!)
  const page = optionalStringField(file, fields, 'page')
  const anchor = optionalStringField(file, fields, 'anchor')
  return {
    path: file.replaceAll('\\', '/'),
    ...(page !== undefined ? { page } : {}),
    ...(anchor !== undefined && anchor !== '' ? { anchor } : {}),
    authorId: requiredStringField(file, fields, 'author'),
    createdAt: requiredStringField(file, fields, 'createdAt'),
    body: text.slice(match[0].length).trim(),
  }
}
