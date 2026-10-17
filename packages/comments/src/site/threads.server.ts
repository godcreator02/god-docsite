import { personOf, type Person } from '@godcreator/identity'
import { threadResolutionOf } from '../core/comment-file.js'
import { reactionEmojis, reactionsField, reactionsOf, type Reactions } from '../core/reactions.js'
import { threadsByPage, threadsForPage, type CommentEntryLike, type ThreadSummary } from '../core/threads.js'
import type { CommentReaction, CommentWriter, PageThreadSummary } from './comment-model.js'
import type { CommentsTableRow } from './comments-table.js'

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
  const reactions = reactionsOf(`评论 ${entry.info.path}`, (entry as unknown as Record<string, unknown>)[reactionsField])
  return {
    path: entry.info.path,
    authorId: requiredFrontmatterStringOf(entry, 'author'),
    createdAt: requiredFrontmatterStringOf(entry, 'createdAt'),
    ...(page !== undefined ? { page } : {}),
    ...(anchor !== undefined && anchor !== '' ? { anchor } : {}),
    ...(resolved !== undefined ? { resolved } : {}),
    ...(Object.keys(reactions).length > 0 ? { reactions } : {}),
  }
}

/** 表情回应换成界面要的形状：按 reactionEmojis 的顺序，人从 id 换成 {id, name} */
function commentReactionsOf(reactions: Reactions | undefined, writerOf: (personId: string) => CommentWriter): { reactions?: CommentReaction[] } {
  if (reactions === undefined) return {}
  return { reactions: reactionEmojis.flatMap((emoji) => (reactions[emoji] === undefined ? [] : [{ emoji, people: reactions[emoji].map(writerOf) }])) }
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
    ...commentReactionsOf(thread.reactions, writerOf),
    replies: thread.replies.map((reply) => ({
      id: reply.id,
      path: reply.path,
      author: writerOf(reply.authorId),
      createdAt: reply.createdAt,
      ...commentReactionsOf(reply.reactions, writerOf),
    })),
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

/** 站点的一个内容页：评论归属键（docs 集合里的路径）、标题、地址 */
export type CommentsTablePage = { key: string; title: string; url: string }

/**
 * 全站评论表的行：内容页的串写那一页的标题与地址；功能包页面（报告页、协作页）的串归属键就是地址，标题也写地址。
 * 归属的内容页已经不在站里的串不列
 */
export function commentsTableRowsOf(byPage: ReadonlyMap<string, PageThreadSummary[]>, contentPages: readonly CommentsTablePage[]): CommentsTableRow[] {
  const contentRows = contentPages.flatMap((page) => (byPage.get(page.key) ?? []).map((thread) => ({ thread, pageTitle: page.title, pageUrl: page.url })))
  const featurePageRows = [...byPage]
    .filter(([page]) => page.startsWith('/'))
    .flatMap(([page, threads]) => threads.map((thread) => ({ thread, pageTitle: page, pageUrl: page })))
  return [...contentRows, ...featurePageRows]
}
