/**
 * 评论的存储格式。一个评论串一个文件夹：index.md（或 index.mdx）是发起的那条，frontmatter 写它批的是哪一页、哪一块、块里的哪几个字；
 * 同一文件夹里其余的 .md / .mdx 每个是一条回复。网页上写的评论存成 .md（纯文字里的 < 和 { 不会被当成 JSX）；
 * 要放 TSX 组件的评论写成 .mdx，可以引用同一文件夹里的组件。图片放在同一文件夹里。
 * 项目在 collections.ts 里用 fumadocs-mdx 的 defineCollections 列出这些文件，schema 传 commentFrontmatterSchema。
 *
 * 被批的块在页面源文件里有一个标记 <CommentAnchor id="…" />：段落、列表项的标记写在开头，
 * 代码块、表格、组件的标记单独一行写在它前面。评论串的 anchor 写这个 id
 */

export type CommentStatus = 'open' | 'resolved'

/** 写评论的人。开发服务里取本机 git 的 user.name；发布站只读，没有写评论的人 */
export type Commenter = { name: string }

/** 页面源文件里标出被批的块的组件名；MDX 页面里由编译插件换成块上的属性，TSX 页面里是基础包的 CommentAnchor 组件 */
export const commentAnchorComponent = 'CommentAnchor'
export const commentAnchorIdPattern = /^[\w-]+$/

/** 带标记的块在网页上的属性，值是标记的 id */
export const commentAnchorAttribute = 'data-comment-anchor'
/** 能评论的块在网页上的属性，值是 formatCommentBlockSpec 写出的源码位置（TSX 页面手放的标记是空字符串） */
export const commentBlockAttribute = 'data-comment-block'
/** 代码块、表格、组件外面包的那层元素的 class：styles.css 给它 display: contents，不占版面 */
export const commentBlockWrapperClass = 'docsite-comment-block'

/**
 * 一块在源文件里的位置：标记插在哪（inline 是插在段落、列表项的文字开头；flow 是单独一行插在块前面），
 * 起止的行号列号（从 1 数），以及这一块源码的指纹
 */
export type CommentBlockSpec = {
  placement: 'inline' | 'flow'
  start: { line: number; column: number }
  end: { line: number; column: number }
  hash: string
}

/** 发起评论串的那条（index.md / index.mdx） */
export type CommentThreadFrontmatter = {
  kind: 'thread'
  author: string
  /** ISO 时间 */
  createdAt: string
  /** 被批页面的地址，如 /writing */
  page: string
  status: CommentStatus
  /** 被批的块的标记 id；不写就是批整页 */
  anchor?: string
  /** 批的是这一块里的哪几个字，要和页面上显示的文字一字不差；不写就是批整块 */
  quote?: string
  /** quote 在这一块的文字里第几次出现，从 1 数 */
  quoteIndex?: number
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

const threadKeys = ['author', 'createdAt', 'page', 'status', 'anchor', 'quote', 'quoteIndex', 'resolvedBy', 'resolvedAt']
const replyKeys = ['author', 'createdAt']
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

function unknownKeyIssues(data: Record<string, unknown>, allowedKeys: string[]): Issue[] {
  return Object.keys(data)
    .filter((key) => !allowedKeys.includes(key))
    .map((key) => ({ message: `认不出 ${key}，能写的只有 ${allowedKeys.join('、')}`, path: [key] }))
}

function validateThread(data: Record<string, unknown>) {
  const issues = unknownKeyIssues(data, threadKeys)
  const author = nonEmptyString(data, 'author', issues)
  const createdAt = isoTime(data, 'createdAt', issues)
  const page = nonEmptyString(data, 'page', issues)
  if (page !== '' && !page.startsWith('/')) issues.push({ message: 'page 写页面地址，以 / 开头，如 /writing', path: ['page'] })
  const status = data.status as CommentStatus
  if (!statuses.includes(status)) issues.push({ message: `status 要是 ${statuses.join(' 或 ')}`, path: ['status'] })
  const anchor = data.anchor === undefined ? undefined : nonEmptyString(data, 'anchor', issues)
  if (anchor && !commentAnchorIdPattern.test(anchor)) issues.push({ message: `anchor 只能有字母、数字、- 和 _，现在是 ${anchor}`, path: ['anchor'] })
  const quote = data.quote === undefined ? undefined : nonEmptyString(data, 'quote', issues)
  if (quote !== undefined && anchor === undefined) issues.push({ message: 'quote 要和 anchor 一起写：先标出是哪一块，再写块里的哪几个字', path: ['quote'] })
  const quoteIndex = data.quoteIndex
  if (quote !== undefined && (!Number.isInteger(quoteIndex) || (quoteIndex as number) < 1)) issues.push({ message: 'quoteIndex 要是从 1 数的整数：quote 在这一块的文字里第几次出现', path: ['quoteIndex'] })
  if (quote === undefined && quoteIndex !== undefined) issues.push({ message: 'quoteIndex 要和 quote 一起写', path: ['quoteIndex'] })
  const resolvedBy = optionalString(data, 'resolvedBy', issues)
  const resolvedAt = data.resolvedAt === undefined ? undefined : isoTime(data, 'resolvedAt', issues)
  if (issues.length > 0) return { issues }
  const value: CommentThreadFrontmatter = { kind: 'thread', author, createdAt, page, status }
  if (anchor !== undefined) value.anchor = anchor
  if (quote !== undefined) {
    value.quote = quote
    value.quoteIndex = quoteIndex as number
  }
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

/** 评论串按批的页面分组：内容页路由按页面地址取 */
export function commentThreadsByPage<Entry extends CommentEntry>(threads: ReadonlyArray<CommentThread<Entry>>) {
  const threadsOfPage = new Map<string, CommentThread<Entry>[]>()
  for (const thread of threads) threadsOfPage.set(thread.head.page, [...(threadsOfPage.get(thread.head.page) ?? []), thread])
  return threadsOfPage
}

/** quote 在 text 里第 quoteIndex 次（从 1 数）出现的位置；出现不到那么多次时返回 undefined */
export function nthIndexOf(text: string, quote: string, quoteIndex: number): number | undefined {
  let at = -1
  for (let count = 0; count < quoteIndex; count++) {
    at = text.indexOf(quote, at + 1)
    if (at === -1) return undefined
  }
  return at
}

/** text 里从 start 开始的这一处 quote 是第几次出现（从 1 数） */
export function occurrenceIndexAt(text: string, quote: string, start: number) {
  let count = 0
  for (let at = text.indexOf(quote); at !== -1 && at <= start; at = text.indexOf(quote, at + 1)) count++
  return count
}
