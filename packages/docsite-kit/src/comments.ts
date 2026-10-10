/**
 * 评论的存储格式。一个评论串一个文件夹：index.mdx 是发起的那条，frontmatter 写它批的是哪一页、哪段原文；
 * 同一文件夹里其余的 .mdx 每个是一条回复。正文是 MDX，可以引用同一文件夹里的图片与 TSX 组件。
 * 项目在 collections.ts 里用 fumadocs-mdx 的 defineCollections 列出这些文件，schema 传 commentFrontmatterSchema
 */

export type CommentStatus = 'open' | 'resolved'

/** 发起评论串的那条（index.mdx） */
export type CommentThreadFrontmatter = {
  kind: 'thread'
  author: string
  /** ISO 时间 */
  createdAt: string
  /** 被批页面的地址，如 /writing */
  page: string
  /** 被批的原文，要和页面上显示的文字一字不差；不写就是批整页 */
  quote?: string
  status: CommentStatus
}

/** 一条回复（index.mdx 以外的 .mdx） */
export type CommentReplyFrontmatter = { kind: 'reply'; author: string; createdAt: string }

export type CommentFrontmatter = CommentThreadFrontmatter | CommentReplyFrontmatter

type Issue = { message: string; path?: ReadonlyArray<PropertyKey> }

/** Standard Schema（fumadocs-mdx 认的校验接口）里用得到的部分 */
export type CommentFrontmatterSchema = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => { value: CommentFrontmatter; issues?: undefined } | { issues: ReadonlyArray<Issue> }
    readonly types?: { readonly input: unknown; readonly output: CommentFrontmatter }
  }
}

const threadKeys = ['author', 'createdAt', 'page', 'quote', 'status']
const replyKeys = ['author', 'createdAt']
const statuses: readonly CommentStatus[] = ['open', 'resolved']

function nonEmptyString(data: Record<string, unknown>, key: string, issues: Issue[]) {
  const value = data[key]
  if (typeof value === 'string' && value.trim() !== '') return value
  issues.push({ message: `${key} 要是非空字符串`, path: [key] })
  return ''
}

/** YAML 把不加引号的 2026-10-10T12:00:00+08:00 读成 Date，加了引号是字符串，两种都收，统一成 ISO 时间 */
function isoTime(data: Record<string, unknown>, issues: Issue[]) {
  const value = data.createdAt
  const time = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined
  if (time && !Number.isNaN(time.getTime())) return time.toISOString()
  issues.push({ message: 'createdAt 要是时间，如 2026-10-10T12:00:00+08:00', path: ['createdAt'] })
  return ''
}

function unknownKeyIssues(data: Record<string, unknown>, allowedKeys: string[]): Issue[] {
  return Object.keys(data)
    .filter((key) => !allowedKeys.includes(key))
    .map((key) => ({ message: `认不出 ${key}，能写的只有 ${allowedKeys.join('、')}`, path: [key] }))
}

function validateThread(data: Record<string, unknown>) {
  const issues = unknownKeyIssues(data, threadKeys)
  const author = nonEmptyString(data, 'author', issues)
  const createdAt = isoTime(data, issues)
  const page = nonEmptyString(data, 'page', issues)
  if (page !== '' && !page.startsWith('/')) issues.push({ message: 'page 写页面地址，以 / 开头，如 /writing', path: ['page'] })
  const quote = data.quote === undefined ? undefined : nonEmptyString(data, 'quote', issues)
  const status = data.status as CommentStatus
  if (!statuses.includes(status)) issues.push({ message: `status 要是 ${statuses.join(' 或 ')}`, path: ['status'] })
  if (issues.length > 0) return { issues }
  const value: CommentThreadFrontmatter = { kind: 'thread', author, createdAt, page, status }
  if (quote !== undefined) value.quote = quote
  return { value }
}

function validateReply(data: Record<string, unknown>) {
  const issues = unknownKeyIssues(data, replyKeys)
  const author = nonEmptyString(data, 'author', issues)
  const createdAt = isoTime(data, issues)
  if (issues.length > 0) return { issues }
  return { value: { kind: 'reply' as const, author, createdAt } }
}

function isThreadFile(file: string) {
  return /(^|[\\/])index\.mdx$/.test(file)
}

/** 交给 defineCollections 的 schema：fumadocs-mdx 传入文件路径，index.mdx 按发起的那条校验，其余按回复校验 */
export function commentFrontmatterSchema({ path }: { path: string }): CommentFrontmatterSchema {
  const validateFields = isThreadFile(path) ? validateThread : validateReply
  return {
    '~standard': {
      version: 1,
      vendor: 'docsite-kit',
      validate(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return { issues: [{ message: '评论文件开头要有 frontmatter' }] }
        return validateFields(value as Record<string, unknown>)
      },
    },
  }
}

/** 集合里的一项：frontmatter 加文件信息；info.path 相对评论目录，如 2026-10-10-search/index.mdx */
export type CommentEntry = CommentFrontmatter & { info: { path: string } }

export type CommentThread<Entry extends CommentEntry> = {
  /** 文件夹名 */
  id: string
  head: Entry & CommentThreadFrontmatter
  /** 按 createdAt 排 */
  replies: Array<Entry & CommentReplyFrontmatter>
}

function isThreadEntry<Entry extends CommentEntry>(entry: Entry): entry is Entry & CommentThreadFrontmatter {
  return entry.kind === 'thread'
}

function byCreatedAt(a: { createdAt: string }, b: { createdAt: string }) {
  return a.createdAt.localeCompare(b.createdAt)
}

/** 把集合里的文件按文件夹分成评论串，按发起时间排。文件不在「评论串文件夹/文件名.mdx」这一层、或者文件夹里没有 index.mdx 时报错，一次列出全部 */
export function commentThreadsOf<Entry extends CommentEntry>(entries: readonly Entry[]): CommentThread<Entry>[] {
  const problems: string[] = []
  const heads = new Map<string, Entry & CommentThreadFrontmatter>()
  const repliesOf = new Map<string, Array<Entry & CommentReplyFrontmatter>>()
  for (const entry of entries) {
    const segments = entry.info.path.split('/')
    if (segments.length !== 2) {
      problems.push(`${entry.info.path} 要放在评论串自己的文件夹里，一层，如 2026-10-10-search/index.mdx`)
      continue
    }
    const id = segments[0]!
    if (isThreadEntry(entry)) heads.set(id, entry)
    else repliesOf.set(id, [...(repliesOf.get(id) ?? []), entry as Entry & CommentReplyFrontmatter])
  }
  for (const id of repliesOf.keys()) if (!heads.has(id)) problems.push(`评论串 ${id} 只有回复，没有发起的 index.mdx`)
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return [...heads.entries()]
    .map(([id, head]) => ({ id, head, replies: (repliesOf.get(id) ?? []).sort(byCreatedAt) }))
    .sort((a, b) => byCreatedAt(a.head, b.head))
}

/** 评论批的页面不存在时报错，一次列出全部；pageUrls 是站点全部页面的地址 */
export function assertCommentPagesExist(threads: ReadonlyArray<CommentThread<CommentEntry>>, pageUrls: readonly string[]) {
  const known = new Set(pageUrls)
  const orphans = threads.filter((thread) => !known.has(thread.head.page))
  if (orphans.length > 0) throw new Error(orphans.map((thread) => `评论串 ${thread.id} 批的页面 ${thread.head.page} 不存在`).join('\n'))
}
