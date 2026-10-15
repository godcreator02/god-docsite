import { COMMENT_ID_PATTERN, THREAD_HEAD_FILE, type ThreadResolution } from './comment-file.js'

/** 整理评论串要的一条评论：path 相对评论目录（如 `20261012t080000-seed1/index.mdx`），page、anchor 与 resolved 只有串头有 */
export interface CommentEntryLike {
  path: string
  authorId: string
  createdAt: string
  page?: string
  anchor?: string
  resolved?: ThreadResolution
}

export interface ReplySummary {
  id: string
  path: string
  authorId: string
  createdAt: string
}

export interface ThreadSummary {
  id: string
  headPath: string
  page: string
  authorId: string
  createdAt: string
  anchor?: string
  /** 标为已解决的记录；没有就是未解决 */
  resolved?: ThreadResolution
  replies: ReplySummary[]
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

function threadIdAndFileOf(entry: CommentEntryLike): [threadId: string, fileName: string] {
  const segments = entry.path.split('/')
  if (segments.length !== 2) throw new Error(`评论条目不在串文件夹里（期望 <threadId>/<file>.mdx）：${entry.path}`)
  const [threadId, fileName] = segments as [string, string]
  if (!COMMENT_ID_PATTERN.test(threadId)) throw new Error(`评论文件夹名不是合法 id：${entry.path}`)
  return [threadId, fileName]
}

/**
 * 把评论按文件夹分成评论串：串按创建时间排，回复按文件名排。
 * 数据不完整（回复没有串头、串头缺 page、一个文件夹两个串头）时直接报错并点名条目路径
 */
export function threadsOf(entries: readonly CommentEntryLike[]): ThreadSummary[] {
  const threadsById = new Map<string, ThreadSummary>()
  const replyEntries: Array<{ threadId: string; fileName: string; entry: CommentEntryLike }> = []
  for (const entry of entries) {
    const [threadId, fileName] = threadIdAndFileOf(entry)
    if (fileName !== THREAD_HEAD_FILE) {
      if (entry.resolved !== undefined) throw new Error(`回复不能带已解决状态，状态只写在串头 ${THREAD_HEAD_FILE} 里：${entry.path}`)
      replyEntries.push({ threadId, fileName, entry })
      continue
    }
    if (entry.page === undefined) throw new Error(`串头缺 page 字段：${entry.path}`)
    const existing = threadsById.get(threadId)
    if (existing) throw new Error(`串文件夹里有两个串头：${existing.headPath} 与 ${entry.path}`)
    threadsById.set(threadId, {
      id: threadId,
      headPath: entry.path,
      page: entry.page,
      authorId: entry.authorId,
      createdAt: entry.createdAt,
      ...(entry.anchor !== undefined && entry.anchor !== '' ? { anchor: entry.anchor } : {}),
      ...(entry.resolved !== undefined ? { resolved: entry.resolved } : {}),
      replies: [],
    })
  }
  for (const { threadId, fileName, entry } of replyEntries) {
    const thread = threadsById.get(threadId)
    if (!thread) throw new Error(`回复所在的串没有串头 index.mdx：${entry.path}`)
    thread.replies.push({ id: fileName.replace(/\.mdx$/, ''), path: entry.path, authorId: entry.authorId, createdAt: entry.createdAt })
  }
  for (const thread of threadsById.values()) thread.replies.sort((a, b) => compareText(a.id, b.id))
  return [...threadsById.values()].sort((a, b) => compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id))
}

/** 只留属于某一页的评论串 */
export function threadsForPage(entries: readonly CommentEntryLike[], page: string): ThreadSummary[] {
  return threadsOf(entries).filter((thread) => thread.page === page)
}

/** 全站评论串按页分组（每页的串保持 threadsOf 的顺序） */
export function threadsByPage(entries: readonly CommentEntryLike[]): Map<string, ThreadSummary[]> {
  const threadsOfPage = new Map<string, ThreadSummary[]>()
  for (const thread of threadsOf(entries)) {
    const pageThreads = threadsOfPage.get(thread.page)
    if (pageThreads) pageThreads.push(thread)
    else threadsOfPage.set(thread.page, [thread])
  }
  return threadsOfPage
}
