import { personOf, type Person } from '@godcreator/identity'
import { threadResolutionOf } from '../core/comment-file.js'
import { threadsByPage, threadsForPage, type CommentEntryLike, type ThreadSummary } from '../core/threads.js'
import type { CommentWriter, PageThreadSummary } from './comment-model.js'

/** 站点评论集合里的一条（fumadocs-mdx 集合条目）：info.path 相对评论目录，frontmatter 字段直接在条目上 */
export type CommentCollectionEntry = { info: { path: string } }

function frontmatterStringOf(entry: CommentCollectionEntry, key: string): string | undefined {
  const value = (entry as unknown as Record<string, unknown>)[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`评论 ${entry.info.path} 的 ${key} 要是字符串，收到 ${JSON.stringify(value)}`)
  return value
}

function requiredFrontmatterStringOf(entry: CommentCollectionEntry, key: string): string {
  const value = frontmatterStringOf(entry, key)
  if (value === undefined || value === '') throw new Error(`评论 ${entry.info.path} 缺 ${key} 字段`)
  return value
}

/** 集合条目换成整理评论串要的形状；字段缺了或类型不对直接报错并点名文件 */
function commentEntryOf(entry: CommentCollectionEntry): CommentEntryLike {
  const page = frontmatterStringOf(entry, 'page')
  const anchor = frontmatterStringOf(entry, 'anchor')
  const resolved = threadResolutionOf(`评论 ${entry.info.path}`, entry as unknown as Record<string, unknown>)
  return {
    path: entry.info.path,
    authorId: requiredFrontmatterStringOf(entry, 'author'),
    createdAt: requiredFrontmatterStringOf(entry, 'createdAt'),
    ...(page !== undefined ? { page } : {}),
    ...(anchor !== undefined && anchor !== '' ? { anchor } : {}),
    ...(resolved !== undefined ? { resolved } : {}),
  }
}

/** 评论界面要的一串：作者 id 换成人员列表里的 {id, name}（只取这两项，身份码不会带出去） */
function pageThreadOf(thread: ThreadSummary, people: readonly Person[]): PageThreadSummary {
  const writerOf = (authorId: string): CommentWriter => {
    const person = personOf(people, authorId)
    return { id: person.id, name: person.name }
  }
  return {
    id: thread.id,
    headPath: thread.headPath,
    page: thread.page,
    ...(thread.anchor !== undefined ? { anchor: thread.anchor } : {}),
    author: writerOf(thread.authorId),
    createdAt: thread.createdAt,
    ...(thread.resolved !== undefined ? { resolved: { by: writerOf(thread.resolved.by), at: thread.resolved.at } } : {}),
    replies: thread.replies.map((reply) => ({ id: reply.id, path: reply.path, author: writerOf(reply.authorId), createdAt: reply.createdAt })),
  }
}

export type PageThreadsOptions = {
  /** 站点评论集合的全部条目 */
  entries: readonly CommentCollectionEntry[]
  /** 站点的人员列表：评论作者都要在里面 */
  people: readonly Person[]
}

/** 页面 loader 用：某一页的评论串；page 是页面在 docs 集合里的路径（如 "index.mdx"）或功能包页面的地址 */
export function pageThreadsOf({ entries, people, page }: PageThreadsOptions & { page: string }): PageThreadSummary[] {
  return threadsForPage(entries.map(commentEntryOf), page).map((thread) => pageThreadOf(thread, people))
}

/** 全站评论按页分组（含回复）：全站评论页、站内评论链接用 */
export function threadsByPageOf({ entries, people }: PageThreadsOptions): Map<string, PageThreadSummary[]> {
  return new Map(
    [...threadsByPage(entries.map(commentEntryOf))].map(([page, threads]) => [page, threads.map((thread) => pageThreadOf(thread, people))]),
  )
}
