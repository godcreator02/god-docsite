/**
 * 评论的存储格式。一个评论串一个文件夹：index.md（或 index.mdx）是发起的那条，frontmatter 写它批的是哪一页、哪段原文或哪一块；
 * 同一文件夹里其余的 .md / .mdx 每个是一条回复。网页上写的评论存成 .md（纯文字里的 < 和 { 不会被当成 JSX）；
 * 要放 TSX 组件的评论写成 .mdx，可以引用同一文件夹里的组件。图片放在同一文件夹里。
 * 项目在 collections.ts 里用 fumadocs-mdx 的 defineCollections 列出这些文件，schema 传 commentFrontmatterSchema
 */

export type CommentStatus = 'open' | 'resolved'

/** 写评论的人。开发服务里取本机 git 的 user.name；发布站只读，没有写评论的人 */
export type Commenter = { name: string }

/** 整块评论能批的几类块：图片、代码块、表格、其余的组件 */
export type CommentBlockKind = 'image' | 'code' | 'table' | 'component'
export const commentBlockKinds: readonly CommentBlockKind[] = ['image', 'code', 'table', 'component']

/**
 * 整块评论批的那一块：它前面最近的标题（id，页面开头没有标题时是空字符串）下，同一类块里的第 index 个（从 1 数）。
 * text 是那一块的文字开头（图片是 alt），用来核对：块挪了位置、对不上 text 时当作原文找不到了
 */
export type CommentBlockAnchor = { kind: CommentBlockKind; heading: string; index: number; text: string }

/** 发起评论串的那条（index.md / index.mdx） */
export type CommentThreadFrontmatter = {
  kind: 'thread'
  author: string
  /** ISO 时间 */
  createdAt: string
  /** 被批页面的地址，如 /writing */
  page: string
  status: CommentStatus
  /** 被批的原文，要和页面上显示的文字一字不差；quote 与 block 都不写就是批整页 */
  quote?: string
  /** 原文前后紧挨着的几个字：原文在页面上出现好几次时靠它们认出是哪一处 */
  quotePrefix?: string
  quoteSuffix?: string
  /** 被批的那一块（图片、代码块、表格、组件） */
  block?: CommentBlockAnchor
  resolvedBy?: string
  resolvedAt?: string
}

/** 一条回复 */
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

const threadKeys = ['author', 'createdAt', 'page', 'status', 'quote', 'quotePrefix', 'quoteSuffix', 'block', 'resolvedBy', 'resolvedAt']
const replyKeys = ['author', 'createdAt']
const blockKeys = ['kind', 'heading', 'index', 'text']
const statuses: readonly CommentStatus[] = ['open', 'resolved']

function nonEmptyString(data: Record<string, unknown>, key: string, issues: Issue[]) {
  const value = data[key]
  if (typeof value === 'string' && value.trim() !== '') return value
  issues.push({ message: `${key} 要是非空字符串`, path: [key] })
  return ''
}

function optionalString(data: Record<string, unknown>, key: string, issues: Issue[]) {
  const value = data[key]
  if (value === undefined || typeof value === 'string') return value
  issues.push({ message: `${key} 要是字符串`, path: [key] })
  return undefined
}

/** YAML 把不加引号的 2026-10-10T12:00:00+08:00 读成 Date，加了引号是字符串，两种都收，统一成 ISO 时间 */
function isoTime(data: Record<string, unknown>, key: string, issues: Issue[]) {
  const value = data[key]
  const time = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined
  if (time && !Number.isNaN(time.getTime())) return time.toISOString()
  issues.push({ message: `${key} 要是时间，如 2026-10-10T12:00:00+08:00`, path: [key] })
  return ''
}

function unknownKeyIssues(data: Record<string, unknown>, allowedKeys: string[], prefix = ''): Issue[] {
  return Object.keys(data)
    .filter((key) => !allowedKeys.includes(key))
    .map((key) => ({ message: `认不出 ${prefix}${key}，能写的只有 ${allowedKeys.join('、')}`, path: [key] }))
}

function validateBlock(value: unknown, issues: Issue[]): CommentBlockAnchor | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push({ message: 'block 要写成 { kind, heading, index, text }', path: ['block'] })
    return undefined
  }
  const block = value as Record<string, unknown>
  issues.push(...unknownKeyIssues(block, blockKeys, 'block.'))
  const { kind, heading, index, text } = block
  const before = issues.length
  if (!commentBlockKinds.includes(kind as CommentBlockKind)) issues.push({ message: `block.kind 要是 ${commentBlockKinds.join('、')} 之一`, path: ['block', 'kind'] })
  if (typeof heading !== 'string') issues.push({ message: 'block.heading 要是字符串（页面开头没有标题时写空字符串）', path: ['block', 'heading'] })
  if (!Number.isInteger(index) || (index as number) < 1) issues.push({ message: 'block.index 要是从 1 数的整数', path: ['block', 'index'] })
  if (typeof text !== 'string') issues.push({ message: 'block.text 要是字符串', path: ['block', 'text'] })
  if (issues.length > before) return undefined
  return { kind: kind as CommentBlockKind, heading: heading as string, index: index as number, text: text as string }
}

function validateThread(data: Record<string, unknown>) {
  const issues = unknownKeyIssues(data, threadKeys)
  const author = nonEmptyString(data, 'author', issues)
  const createdAt = isoTime(data, 'createdAt', issues)
  const page = nonEmptyString(data, 'page', issues)
  if (page !== '' && !page.startsWith('/')) issues.push({ message: 'page 写页面地址，以 / 开头，如 /writing', path: ['page'] })
  const status = data.status as CommentStatus
  if (!statuses.includes(status)) issues.push({ message: `status 要是 ${statuses.join(' 或 ')}`, path: ['status'] })
  const quote = data.quote === undefined ? undefined : nonEmptyString(data, 'quote', issues)
  const quotePrefix = optionalString(data, 'quotePrefix', issues)
  const quoteSuffix = optionalString(data, 'quoteSuffix', issues)
  if (quote === undefined && (quotePrefix !== undefined || quoteSuffix !== undefined)) issues.push({ message: 'quotePrefix、quoteSuffix 要和 quote 一起写', path: ['quote'] })
  const block = data.block === undefined ? undefined : validateBlock(data.block, issues)
  if (data.quote !== undefined && data.block !== undefined) issues.push({ message: 'quote 和 block 只能写一个：批一段文字写 quote，批一整块写 block', path: ['block'] })
  const resolvedBy = optionalString(data, 'resolvedBy', issues)
  const resolvedAt = data.resolvedAt === undefined ? undefined : isoTime(data, 'resolvedAt', issues)
  if (issues.length > 0) return { issues }
  const value: CommentThreadFrontmatter = { kind: 'thread', author, createdAt, page, status }
  if (quote !== undefined) value.quote = quote
  if (quotePrefix !== undefined) value.quotePrefix = quotePrefix
  if (quoteSuffix !== undefined) value.quoteSuffix = quoteSuffix
  if (block !== undefined) value.block = block
  if (resolvedBy !== undefined) value.resolvedBy = resolvedBy
  if (resolvedAt !== undefined) value.resolvedAt = resolvedAt
  return { value }
}

function validateReply(data: Record<string, unknown>) {
  const issues = unknownKeyIssues(data, replyKeys)
  const author = nonEmptyString(data, 'author', issues)
  const createdAt = isoTime(data, 'createdAt', issues)
  if (issues.length > 0) return { issues }
  return { value: { kind: 'reply' as const, author, createdAt } }
}

/** 发起评论串的那个文件名：index.md 或 index.mdx */
export function isThreadHeadFile(file: string) {
  return /(^|[\\/])index\.mdx?$/.test(file)
}

/** 交给 defineCollections 的 schema：fumadocs-mdx 传入文件路径，index.md / index.mdx 按发起的那条校验，其余按回复校验 */
export function commentFrontmatterSchema({ path }: { path: string }): CommentFrontmatterSchema {
  const validateFields = isThreadHeadFile(path) ? validateThread : validateReply
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

/** 集合里的一项：frontmatter 加文件信息；info.path 相对评论目录，如 2026-10-10-search/index.md */
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

/** 评论文件的文件名（不含文件夹），如 index.md、2026-10-10t0631-x7k2.md */
export function commentFileName(entry: CommentEntry) {
  return entry.info.path.split('/')[1]!
}

/**
 * 把集合里的文件按文件夹分成评论串，按发起时间排。文件不在「评论串文件夹/文件名」这一层、
 * 文件夹里没有发起的那条、或者 index.md 与 index.mdx 都有时报错，一次列出全部
 */
export function commentThreadsOf<Entry extends CommentEntry>(entries: readonly Entry[]): CommentThread<Entry>[] {
  const problems: string[] = []
  const heads = new Map<string, Entry & CommentThreadFrontmatter>()
  const repliesOf = new Map<string, Array<Entry & CommentReplyFrontmatter>>()
  for (const entry of entries) {
    const segments = entry.info.path.split('/')
    if (segments.length !== 2) {
      problems.push(`${entry.info.path} 要放在评论串自己的文件夹里，一层，如 2026-10-10-search/index.md`)
      continue
    }
    const id = segments[0]!
    if (isThreadEntry(entry)) {
      if (heads.has(id)) problems.push(`评论串 ${id} 里 index.md 和 index.mdx 只能有一个`)
      heads.set(id, entry)
    } else repliesOf.set(id, [...(repliesOf.get(id) ?? []), entry as Entry & CommentReplyFrontmatter])
  }
  for (const id of repliesOf.keys()) if (!heads.has(id)) problems.push(`评论串 ${id} 只有回复，没有发起的 index.md`)
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

/**
 * 原文在整页文字里从哪开始。只出现一次就是那一处；出现好几次时，取前后文都对得上的那一处。
 * 找不到、或者好几处都对不上前后文时返回 undefined，不去猜
 */
export function locateQuote(text: string, quote: string, prefix = '', suffix = ''): number | undefined {
  const starts: number[] = []
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) starts.push(at)
  if (starts.length === 1) return starts[0]
  return starts.find((start) => text.slice(0, start).endsWith(prefix) && text.slice(start + quote.length).startsWith(suffix))
}

/** 选中的原文前后各取几个字作前后文 */
export const quoteContextLength = 20
