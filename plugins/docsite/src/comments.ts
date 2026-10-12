import path from 'node:path'
import { mentionsOf, type Person } from '@godcreator/docsite-identity'
import { sitePeople } from '@godcreator/docsite-identity/server'
import { readCommentThreads, type CommentFileOnDisk } from '@godcreator/docsite-comments/server'
import { DocsiteRejected } from './errors.js'

export type CommentFilter = { page?: string; about?: string }

type ListedComment = { author: string; createdAt: string; body: string; mentions: string[] }

export type ListedThread = { id: string; page: string; anchor?: string; author: string; createdAt: string; body: string; mentions: string[]; replies: ListedComment[] }

function listedOf(entry: CommentFileOnDisk, people: readonly Person[]): ListedComment {
  return { author: entry.authorId, createdAt: entry.createdAt, body: entry.body, mentions: mentionsOf(entry.body, people) }
}

/** 读站点目录里的评论（不要站点在运行）：按挂的页面、和谁有关筛。page 是页面在 docs 集合里的路径（如 "writing/collapse-test.mdx"） */
export async function listComments(siteDir: string, filter: CommentFilter): Promise<ListedThread[]> {
  let people: Person[]
  let threads: Awaited<ReturnType<typeof readCommentThreads>>
  try {
    people = sitePeople(siteDir)
    threads = await readCommentThreads(path.join(siteDir, 'comments'))
  } catch (error) {
    throw new DocsiteRejected(error instanceof Error ? error.message : String(error))
  }
  return threads
    .filter((thread) => filter.page === undefined || thread.head.page === filter.page)
    .map((thread) => {
      const mentions = [...mentionsOf(thread.head.body, people), ...thread.replies.flatMap((reply) => mentionsOf(reply.body, people))]
      const author = people.find((person) => person.id === thread.head.authorId)
      if (author === undefined) throw new DocsiteRejected(`评论作者不在 people.json 里：${thread.head.path}（${thread.head.authorId}）`)
      return {
        id: thread.head.path.split('/')[0]!,
        page: thread.head.page ?? '',
        ...(thread.head.anchor !== undefined ? { anchor: thread.head.anchor } : {}),
        author: thread.head.authorId,
        createdAt: thread.head.createdAt,
        body: thread.head.body,
        mentions: [...new Set(mentions)],
        replies: thread.replies.map((reply) => listedOf(reply, people)),
      }
    })
    .filter((thread) => filter.about === undefined || thread.mentions.includes(filter.about) || thread.author === filter.about)
}

export type CommentWrite =
  | { op: 'create'; page: string; body: string; as?: string; anchor?: string }
  | { op: 'reply'; thread: string; body: string; as?: string }

/**
 * 表单字段：和网页同一个评论接口（页面路由的 action），所以要站点在运行。
 * page 是页面在 docs 集合里的路径（如 writing/collapse-test.mdx），和网页表单、docsite.comments 的筛选用同一写法；
 * anchor 是页面元素的 id，可省
 */
export function commentFormOf(write: CommentWrite): FormData {
  const form = new FormData()
  if (write.op === 'create') {
    form.set('intent', 'create-thread')
    form.set('page', write.page)
    form.set('body', write.body)
    if (write.anchor !== undefined) form.set('anchor', write.anchor)
  } else {
    form.set('intent', 'reply')
    form.set('threadId', write.thread)
    form.set('body', write.body)
  }
  if (write.as !== undefined) form.set('as', write.as)
  return form
}

/** 经运行中的开发服务写评论（POST 到站点根那条页面路由的 action，action 不依赖 POST 路径）；接口拒绝时把它的原话报出来 */
export async function writeComment(siteUrl: string, write: CommentWrite): Promise<{ thread: string }> {
  const response = await fetch(new URL('/', siteUrl), { method: 'POST', body: commentFormOf(write) })
  if (!response.ok) throw new DocsiteRejected(`站点的评论接口拒绝了（${response.status}）：${await response.text()}`)
  const result = (await response.json()) as { threadId?: string }
  if (typeof result.threadId !== 'string') throw new DocsiteRejected(`站点的评论接口没有回 threadId：${JSON.stringify(result)}`)
  return { thread: result.threadId }
}
