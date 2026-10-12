import { personOf, type Person } from '@godcreator/docsite-identity/server'
import { threadsForPage, type CommentEntryLike, type ThreadSummary } from '@godcreator/docsite-comments'
import { commentCollection } from './source.server'

/**
 * 路由 loader 的评论数据：集合条目交给评论包的纯模型分组（逐请求执行，不做模块顶层分组），
 * 站点再把 authorId 解析成可信的 {id,name}（模型不认识人员表）
 */
export interface NamedAuthor {
  id: string
  name: string
}

export interface PageThreadView {
  id: string
  headPath: string
  page: string
  anchor?: string
  author: NamedAuthor
  createdAt: string
  replies: Array<{ id: string; path: string; author: NamedAuthor; createdAt: string }>
}

/** 评论集合没写 schema：frontmatter 字段运行时直接在条目上，按 unknown 收窄后交给模型 */
function commentEntries(): CommentEntryLike[] {
  return commentCollection.map((entry) => {
    const raw = entry as unknown as Record<string, unknown>
    return {
      path: entry.info.path,
      authorId: typeof raw.author === 'string' ? raw.author : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      ...(typeof raw.page === 'string' ? { page: raw.page } : {}),
      ...(typeof raw.anchor === 'string' && raw.anchor !== '' ? { anchor: raw.anchor } : {}),
    }
  })
}

function withAuthors(thread: ThreadSummary): PageThreadView {
  const authorOf = (authorId: string): NamedAuthor => {
    const person: Person = personOf(currentPeople(), authorId)
    return { id: person.id, name: person.name }
  }
  return {
    id: thread.id,
    headPath: thread.headPath,
    page: thread.page,
    ...(thread.anchor !== undefined ? { anchor: thread.anchor } : {}),
    author: authorOf(thread.authorId),
    createdAt: thread.createdAt,
    replies: thread.replies.map((reply) => ({ ...reply, author: authorOf(reply.authorId) })),
  }
}

import { sitePeople } from '@godcreator/docsite-identity/server'
const currentPeople = () => sitePeople()

/** 本页评论（page 是页面在 docs 集合里的路径，如 "index.mdx"） */
export function pageThreads(page: string): PageThreadView[] {
  return threadsForPage(commentEntries(), page).map(withAuthors)
}

/** 全站评论按页分组：全站评论页与站内评论链接卡片用 */
export function allPageThreads(): Map<string, PageThreadView[]> {
  const byPage = new Map<string, ThreadSummary[]>()
  for (const entry of commentEntries()) {
    if (entry.page === undefined) continue
    const threads = threadsForPage([entry], entry.page)
    const existing = byPage.get(entry.page) ?? []
    for (const thread of threads) if (!existing.some((other) => other.id === thread.id)) existing.push(thread)
    byPage.set(entry.page, existing)
  }
  return new Map([...byPage].map(([page, threads]) => [page, threads.map(withAuthors)]))
}
