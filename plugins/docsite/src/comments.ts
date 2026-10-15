import path from 'node:path'
import type { CommentFileOnDisk } from '@godcreator/comments'
import { readCommentThreads } from '@godcreator/comments/node'
import { mentionsOf, type Person } from '@godcreator/identity'
import { sitePeople } from '@godcreator/identity/node'
import { DocsiteRejected } from './errors.js'

export type CommentFilter = { page?: string; about?: string }

type ListedComment = { author: string; createdAt: string; body: string; mentions: string[] }

export type ListedThread = { id: string; page: string; anchor?: string; author: string; createdAt: string; body: string; mentions: string[]; replies: ListedComment[] }

function listedOf(entry: CommentFileOnDisk, people: readonly Person[]): ListedComment {
  return { author: entry.authorId, createdAt: entry.createdAt, body: entry.body, mentions: mentionsOf(entry.body, people) }
}

/** 读站点目录里的评论（不要站点在运行）：按挂的页面、和谁有关筛。page 是页面在内容目录里的路径（如 "writing/collapse-test.mdx"） */
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
 * 表单字段：和网页评论面板同一套（comments 包的 handleCommentWrite 认的字段），所以要站点在运行。
 * page 是页面在内容目录里的路径（如 writing/collapse-test.mdx），和 docsite.comments 的筛选用同一写法；anchor 是页面元素的 id，可省
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

/**
 * 评论写入路由的数据地址（外部契约）：平台模板 app/routes.ts 里 route('comments') 的 action，
 * 加 React Router 单次请求的 .data 后缀才回 action 的返回值，不加回的是整页 HTML
 */
export const commentWriteDataPath = '/comments.data'

/**
 * 解 React Router 单次请求回的 turbo-stream：首行是扁平的值表，对象写成 { "_<键的下标>": <值的下标> }。
 * 评论写入的结果只有字符串与布尔，只解这几种；遇到数组、带类型标记的值或特殊下标就报错
 */
export function decodeFlatTurboStream(text: string): unknown {
  const values = JSON.parse(text.split('\n', 1)[0]!) as unknown
  if (!Array.isArray(values)) throw new Error('首行不是值表')
  const valueAt = (index: unknown): unknown => {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= values.length) throw new Error(`下标 ${JSON.stringify(index)} 不在值表里`)
    const value: unknown = values[index]
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) throw new Error('解不了数组与带类型标记的值')
    return Object.fromEntries(
      Object.entries(value).map(([key, at]) => {
        if (!/^_\d+$/.test(key)) throw new Error(`对象的键 ${key} 不是 _<下标>`)
        return [String(valueAt(Number(key.slice(1)))), valueAt(at)]
      }),
    )
  }
  return valueAt(0)
}

type CommentWriteResult = { ok: true; threadId?: string; replyId?: string } | { ok: false; error: string }

function commentWriteResultOf(status: number, text: string): CommentWriteResult {
  let decoded: unknown
  try {
    decoded = decodeFlatTurboStream(text)
  } catch (error) {
    throw new DocsiteRejected(`站点的评论接口回了 ${status}，内容解不出（${error instanceof Error ? error.message : String(error)}）：${text.slice(0, 500)}`)
  }
  const result = typeof decoded === 'object' && decoded !== null ? (decoded as { data?: unknown }).data : undefined
  if (typeof result !== 'object' || result === null || typeof (result as { ok?: unknown }).ok !== 'boolean') {
    throw new DocsiteRejected(`站点的评论接口回了 ${status}，不是 { ok, … } 的结果：${text.slice(0, 500)}`)
  }
  return result as CommentWriteResult
}

/** 经运行中的站点写评论：POST 表单到评论写入路由，Origin 头写站点地址（站点只认来自可信 origin 的写入）；接口拒绝时把它的原话报出来 */
export async function writeComment(siteUrl: string, write: CommentWrite): Promise<{ thread: string; reply?: string }> {
  const origin = new URL(siteUrl).origin
  const response = await fetch(new URL(commentWriteDataPath, siteUrl), { method: 'POST', body: commentFormOf(write), headers: { origin } })
  const result = commentWriteResultOf(response.status, await response.text())
  if (!result.ok) throw new DocsiteRejected(`站点的评论接口拒绝了（${response.status}）：${result.error}`)
  if (write.op === 'reply') {
    if (typeof result.replyId !== 'string') throw new DocsiteRejected(`站点的评论接口没有回 replyId：${JSON.stringify(result)}`)
    return { thread: write.thread, reply: result.replyId }
  }
  if (typeof result.threadId !== 'string') throw new DocsiteRejected(`站点的评论接口没有回 threadId：${JSON.stringify(result)}`)
  return { thread: result.threadId }
}
