import type { CommentRange } from './comment-ranges.js'
import { peopleFile, type Person } from '@godcreator/docsite-identity'

/**
 * 评论的存储格式。一个评论串一个文件夹：index.mdx 是发起的那条，frontmatter 写它批的是哪一页、哪段原文或哪个元素；
 * 同一文件夹里其余的 .mdx 每个是一条回复。评论一律是 MDX，网页上写的也一样：能写组件、引用同一文件夹里的组件。图片放在同一文件夹里。
 * 批一段文字或一个元素时，文件夹里还有 snapshot.txt：发起评论那一刻整页的文字（怎么算见 page-text-rules.ts），range 是在它里面数的位置。
 * 项目在 collections.ts 里用 fumadocs-mdx 的 defineCollections 列出这些文件，schema 传 commentFrontmatterSchema
 */

export type { CommentRange }

export type CommentStatus = 'open' | 'resolved'

/** 写评论的人：开发服务里是本机身份码在人员列表里对应的那个人；发布站只读，没有写评论的人 */
export type Commenter = Person

/** 批一个元素时，那个元素是哪类：图片（含 SVG、画布、视频）、公式、代码块、表格、一段文字或其中的行内元素、其余的组件 */
export type CommentElementKind = 'image' | 'formula' | 'code' | 'table' | 'text' | 'component'
export const commentElementKinds: readonly CommentElementKind[] = ['image', 'formula', 'code', 'table', 'text', 'component']

/** 评论串文件夹里的页面文字快照 */
export const commentSnapshotFile = 'snapshot.txt'

/** 发起评论串的那条（index.mdx） */
export type CommentThreadFrontmatter = {
  kind: 'thread'
  author: string
  /** ISO 时间 */
  createdAt: string
  /** 被批页面的地址，如 /writing；不写就是不挂在页面上的评论，只在全部评论页上 */
  page?: string
  status: CommentStatus
  /** 批一段文字：被批的原文，等于快照里 range 那一段；quote 与 element 都不写就是批整页 */
  quote?: string
  /** 批一个元素：那个元素是哪类 */
  element?: CommentElementKind
  /** 批的是快照里的第几个字到第几个字（不含后一个），写了 quote 或 element 就要写 */
  range?: CommentRange
  /**
   * 被批的内容在几层可收起的容器里（标签页、折叠块、文件夹）时，打开每一层要点的按钮在快照里的位置，由外到里。
   * 被批的内容收起来、在页面上找不到或看不见时，按顺序点开这些按钮再找
   */
  openers?: CommentRange[]
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

const threadKeys = ['author', 'createdAt', 'page', 'status', 'quote', 'element', 'range', 'openers', 'resolvedBy', 'resolvedAt']
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

function unknownKeyIssues(data: Record<string, unknown>, allowedKeys: string[], prefix = ''): Issue[] {
  return Object.keys(data)
    .filter((key) => !allowedKeys.includes(key))
    .map((key) => ({ message: `认不出 ${prefix}${key}，能写的只有 ${allowedKeys.join('、')}`, path: [key] }))
}

/** range 写成 [start, end]：两个从 0 数的整数，start 小于 end */
export function isCommentRange(value: unknown): value is CommentRange {
  return Array.isArray(value) && value.length === 2 && value.every((at) => Number.isInteger(at) && at >= 0) && value[0] < value[1]
}

/** openers 写成 [[start, end], …]，至少一个 */
export function isCommentOpeners(value: unknown): value is CommentRange[] {
  return Array.isArray(value) && value.length > 0 && value.every(isCommentRange)
}

function validateThread(data: Record<string, unknown>) {
  const issues = unknownKeyIssues(data, threadKeys)
  const author = nonEmptyString(data, 'author', issues)
  const createdAt = isoTime(data, 'createdAt', issues)
  const page = data.page === undefined ? undefined : nonEmptyString(data, 'page', issues)
  if (page && !page.startsWith('/')) issues.push({ message: 'page 写页面地址，以 / 开头，如 /writing', path: ['page'] })
  if (page === undefined && (data.quote !== undefined || data.element !== undefined)) issues.push({ message: '写了 quote 或 element 就要写 page：批的是哪一页', path: ['page'] })
  const status = data.status as CommentStatus
  if (!statuses.includes(status)) issues.push({ message: `status 要是 ${statuses.join(' 或 ')}`, path: ['status'] })
  const quote = data.quote === undefined ? undefined : nonEmptyString(data, 'quote', issues)
  const element = data.element as CommentElementKind | undefined
  if (element !== undefined && !commentElementKinds.includes(element)) issues.push({ message: `element 要是 ${commentElementKinds.join('、')} 之一`, path: ['element'] })
  if (data.quote !== undefined && data.element !== undefined) issues.push({ message: 'quote 和 element 只能写一个：批一段文字写 quote，批一个元素写 element', path: ['element'] })
  const range = data.range
  if (range !== undefined && !isCommentRange(range)) issues.push({ message: 'range 要写成 [start, end]：快照里从 0 数的两个位置，start 小于 end', path: ['range'] })
  if ((data.quote !== undefined || data.element !== undefined) && range === undefined) issues.push({ message: '写了 quote 或 element 就要写 range：批的是快照里的哪一段', path: ['range'] })
  if (data.quote === undefined && data.element === undefined && range !== undefined) issues.push({ message: 'range 要和 quote 或 element 一起写；都不写是批整页', path: ['range'] })
  const openers = data.openers
  if (openers !== undefined && !isCommentOpeners(openers)) issues.push({ message: 'openers 要写成 [[start, end], …]：每个按钮在快照里从 0 数的两个位置，由外到里', path: ['openers'] })
  if (openers !== undefined && range === undefined) issues.push({ message: 'openers 要和 range 一起写', path: ['openers'] })
  const resolvedBy = optionalString(data, 'resolvedBy', issues)
  const resolvedAt = data.resolvedAt === undefined ? undefined : isoTime(data, 'resolvedAt', issues)
  if (issues.length > 0) return { issues }
  const value: CommentThreadFrontmatter = { kind: 'thread', author, createdAt, status }
  if (page !== undefined) value.page = page
  if (quote !== undefined) value.quote = quote
  if (element !== undefined) value.element = element
  if (range !== undefined) value.range = range as CommentRange
  if (openers !== undefined) value.openers = openers as CommentRange[]
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

/** 发起评论串的那个文件名：index.mdx */
export function isThreadHeadFile(file: string) {
  return /(^|[\\/])index\.mdx$/.test(file)
}

/** 交给 defineCollections 的 schema：fumadocs-mdx 传入文件路径，index.mdx 按发起的那条校验，其余按回复校验；评论文件只能是 .mdx */
export function commentFrontmatterSchema({ path }: { path: string }): CommentFrontmatterSchema {
  const validateFields = isThreadHeadFile(path) ? validateThread : validateReply
  return {
    '~standard': {
      version: 1,
      vendor: 'docsite-comments',
      validate(value) {
        if (!path.endsWith('.mdx')) return { issues: [{ message: '评论文件一律写成 .mdx：把扩展名改成 .mdx' }] }
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

/** 评论文件的文件名（不含文件夹），如 index.mdx、2026-10-10t0631-x7k2.mdx */
export function commentFileName(entry: CommentEntry) {
  return entry.info.path.split('/')[1]!
}

/**
 * 把集合里的文件按文件夹分成评论串，按发起时间排。文件不在「评论串文件夹/文件名」这一层、
 * 文件夹里没有发起的那条时报错，一次列出全部
 */
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

/** 评论串按批的页面分组：内容页路由按页面地址取；不挂在页面上的不在里面 */
export function commentThreadsByPage<Entry extends CommentEntry>(threads: ReadonlyArray<CommentThread<Entry>>) {
  const threadsOfPage = new Map<string, CommentThread<Entry>[]>()
  for (const thread of threads) {
    const { page } = thread.head
    if (page !== undefined) threadsOfPage.set(page, [...(threadsOfPage.get(page) ?? []), thread])
  }
  return threadsOfPage
}

/** 功能包路由的 path（如 tasks/:recordId，不带开头的 /）换成认页面地址的正则：:参数是一段，* 是余下的全部 */
export function commentRoutePatternOf(routePath: string) {
  const segments = routePath.split('/').map((segment) => (segment === '*' ? '.+' : segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  return new RegExp(`^/${segments.join('/')}$`)
}

/**
 * 能批的页面：content/ 里的页面（pageUrls），和功能包里标了 comments 的路由（commentRoutes，写路由的 path）下的页面。
 * 路由下的页面不查那条记录还在不在：删了任务，批它那一页的评论照样留着
 */
export function commentablePagesOf(pageUrls: readonly string[], commentRoutes: readonly string[] = []) {
  const known = new Set(pageUrls)
  const patterns = commentRoutes.map(commentRoutePatternOf)
  return (url: string) => known.has(url) || patterns.some((pattern) => pattern.test(url))
}

/** 评论批的页面不能批时报错，一次列出全部 */
export function assertCommentPagesExist(threads: ReadonlyArray<CommentThread<CommentEntry>>, pageUrls: readonly string[], commentRoutes: readonly string[] = []) {
  const isCommentable = commentablePagesOf(pageUrls, commentRoutes)
  const orphans = threads.filter((thread) => thread.head.page !== undefined && !isCommentable(thread.head.page))
  if (orphans.length > 0) throw new Error(orphans.map((thread) => `评论串 ${thread.id} 批的页面 ${thread.head.page} 不存在`).join('\n'))
}

/** 评论的 author、resolvedBy 不在人员列表里时报错，一次列出全部 */
export function assertCommentAuthorsKnown(threads: ReadonlyArray<CommentThread<CommentEntry>>, people: readonly Person[]) {
  const known = new Set(people.map((person) => person.id))
  const problems: string[] = []
  for (const thread of threads) {
    for (const entry of [thread.head, ...thread.replies]) {
      if (!known.has(entry.author)) problems.push(`${entry.info.path} 的 author ${entry.author} 不在 ${peopleFile} 里`)
    }
    const { resolvedBy } = thread.head
    if (resolvedBy !== undefined && !known.has(resolvedBy)) problems.push(`${thread.head.info.path} 的 resolvedBy ${resolvedBy} 不在 ${peopleFile} 里`)
  }
  if (problems.length > 0) throw new Error(problems.join('\n'))
}

/** frontmatter 与快照对不上时说明哪里不对：range 或 openers 超出了快照，或者 quote 不等于快照里 range 那一段 */
export function snapshotMismatchOf(head: Pick<CommentThreadFrontmatter, 'quote' | 'range' | 'openers'>, snapshot: string): string | undefined {
  if (!head.range) return undefined
  const [start, end] = head.range
  if (end > snapshot.length) return `range [${start}, ${end}] 超出了快照（共 ${snapshot.length} 个字）`
  if (head.quote !== undefined && snapshot.slice(start, end) !== head.quote) return `quote 和快照里 range 那一段不一样：快照里是「${snapshot.slice(start, end)}」`
  const outside = head.openers?.find(([, openerEnd]) => openerEnd > snapshot.length)
  if (outside) return `openers 里的 [${outside[0]}, ${outside[1]}] 超出了快照（共 ${snapshot.length} 个字）`
  return undefined
}
