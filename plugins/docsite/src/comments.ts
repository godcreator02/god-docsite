import path from 'node:path'
import { mentionsOf, type CommentReplyFrontmatter, type CommentThreadFrontmatter } from '@godcreator/docsite-kit/comments'
import { commentThreadIdsAbout, readCommentThreads, sitePeople, type CommentFile } from '@godcreator/docsite-kit/files'
import { DocsiteRejected } from './errors.js'

export type CommentFilter = { page?: string; status?: 'open' | 'resolved'; about?: string }

type ListedComment = { file: string; author: string; createdAt: string; body: string; mentions: string[] }

export type ListedThread = Omit<CommentThreadFrontmatter, 'kind'> & { id: string; file: string; body: string; mentions: string[]; replies: ListedComment[] }

function listedOf<Frontmatter extends CommentThreadFrontmatter | CommentReplyFrontmatter>(entry: CommentFile<Frontmatter>, people: Parameters<typeof mentionsOf>[1]) {
  const { kind: _kind, ...rest } = entry
  return { ...rest, mentions: mentionsOf(entry.body, people) }
}

/** 读站点目录里的评论（不要站点在运行）：按批的页面、状态、和谁有关筛 */
export async function listComments(siteDir: string, filter: CommentFilter): Promise<ListedThread[]> {
  let people
  let threads
  try {
    people = sitePeople(siteDir)
    threads = await readCommentThreads(path.join(siteDir, 'comments'))
  } catch (error) {
    throw new DocsiteRejected(error instanceof Error ? error.message : String(error))
  }
  const about = filter.about === undefined ? undefined : new Set(commentThreadIdsAbout(threads, filter.about, people))
  return threads
    .filter((thread) => filter.page === undefined || thread.head.page === filter.page)
    .filter((thread) => filter.status === undefined || thread.head.status === filter.status)
    .filter((thread) => about === undefined || about.has(thread.id))
    .map((thread) => ({ id: thread.id, ...listedOf(thread.head, people), replies: thread.replies.map((reply) => listedOf(reply, people)) }))
}

export type CommentWrite =
  | { op: 'create'; page?: string; quote?: string; occurrence?: number; body: string; as?: string }
  | { op: 'reply'; thread: string; body: string; as?: string }
  | { op: 'resolve' | 'reopen'; thread: string; as?: string }

/** 表单字段：和网页同一个评论接口（站点的 /api/comments），所以要站点在运行；批页面上的字用 { quote, occurrence } */
export function commentFormOf(write: CommentWrite): FormData {
  const form = new FormData()
  form.set('op', write.op)
  if (write.as !== undefined) form.set('as', write.as)
  if (write.op === 'create') {
    form.set('body', write.body)
    if (write.page !== undefined) {
      form.set('page', write.page)
      form.set('anchor', JSON.stringify(write.quote === undefined ? {} : { quote: write.quote, occurrence: write.occurrence ?? 1 }))
    }
    return form
  }
  form.set('thread', write.thread)
  if (write.op === 'reply') form.set('body', write.body)
  return form
}

/** 经运行中的开发服务写评论；接口拒绝时把它的原话报出来 */
export async function writeComment(siteUrl: string, write: CommentWrite): Promise<{ thread: string; file: string }> {
  const response = await fetch(new URL('/api/comments', siteUrl), { method: 'POST', body: commentFormOf(write) })
  if (!response.ok) throw new DocsiteRejected(`站点的评论接口拒绝了（${response.status}）：${await response.text()}`)
  return (await response.json()) as { thread: string; file: string }
}
