import { existsSync } from 'node:fs'
import path from 'node:path'
import { pageAddressOf, type CommentFileOnDisk, type Reactions } from '@godcreator/comments'
import { readCommentThreads, type CommentThreadOnDisk } from '@godcreator/comments/node'
import { mentionsOf, type Person } from '@godcreator/identity'
import { sitePeople } from '@godcreator/identity/node'
import { DocsiteRejected, messageOf } from './errors.js'

export type CommentFilter = { page?: string; about?: string }

/** reactions 只在有人点过表情时有：表情 → 点了的人员 id */
export type StoredComment = { author: string; createdAt: string; body: string; reactions?: Reactions }

/** 评论目录里的一串，照文件原样：作者是人员 id，不认人、不算 @ */
export type StoredThread = {
  id: string
  page: string
  anchor?: string
  author: string
  createdAt: string
  status: 'open' | 'resolved'
  resolvedBy?: string
  resolvedAt?: string
  body: string
  reactions?: Reactions
  replies: StoredComment[]
}

/** mentions：正文与回复里 @ 了的人员 id，按站点的 people.json 认 */
export type ListedThread = Omit<StoredThread, 'replies'> & { mentions: string[]; replies: Array<StoredComment & { mentions: string[] }> }

function storedCommentOf(entry: CommentFileOnDisk): StoredComment {
  return { author: entry.authorId, createdAt: entry.createdAt, body: entry.body, ...(entry.reactions !== undefined ? { reactions: entry.reactions } : {}) }
}

function storedThreadOf({ head, replies }: CommentThreadOnDisk): StoredThread {
  return {
    id: head.path.split('/')[0]!,
    page: head.page ?? '',
    ...(head.anchor !== undefined ? { anchor: head.anchor } : {}),
    author: head.authorId,
    createdAt: head.createdAt,
    ...(head.resolved !== undefined ? { status: 'resolved' as const, resolvedBy: head.resolved.by, resolvedAt: head.resolved.at } : { status: 'open' as const }),
    body: head.body,
    ...(head.reactions !== undefined ? { reactions: head.reactions } : {}),
    replies: replies.map(storedCommentOf),
  }
}

/**
 * 读一个评论目录里的全部评论串（不要站点在运行）：论文、资料这类材料旁边的 comments/ 也是这个形状。
 * 目录不存在就是还没人写过，回空
 */
export async function readComments(commentsDir: string): Promise<StoredThread[]> {
  if (!existsSync(commentsDir)) return []
  let threads: CommentThreadOnDisk[]
  try {
    threads = await readCommentThreads(commentsDir)
  } catch (error) {
    throw new DocsiteRejected(`读评论目录 ${commentsDir} 失败：${messageOf(error)}`)
  }
  return threads.map(storedThreadOf)
}


/**
 * 读站点目录里的评论（不要站点在运行）：按挂的页面、和谁有关筛。page 写页面在内容目录里的路径（如 "writing/collapse-test.mdx"），
 * 或以 / 开头的页面地址（如 "/writing/collapse-test"，功能页如 "/papers/<UUID>/paper"）
 */
export async function listComments(siteDir: string, filter: CommentFilter): Promise<ListedThread[]> {
  let people: Person[]
  let threads: CommentThreadOnDisk[]
  try {
    people = sitePeople(siteDir)
    threads = await readCommentThreads(path.join(siteDir, 'comments'))
  } catch (error) {
    throw new DocsiteRejected(messageOf(error))
  }
  return threads
    .filter((thread) => filter.page === undefined || thread.head.page === filter.page || (filter.page.startsWith('/') && thread.head.page !== undefined && decodeURI(pageAddressOf(thread.head.page)) === decodeURI(filter.page)))
    .map((thread) => {
      if (!people.some((person) => person.id === thread.head.authorId)) throw new DocsiteRejected(`评论作者不在 people.json 里：${thread.head.path}（${thread.head.authorId}）`)
      const stored = storedThreadOf(thread)
      const replies = stored.replies.map((reply) => ({ ...reply, mentions: mentionsOf(reply.body, people) }))
      const mentions = [...new Set([...mentionsOf(stored.body, people), ...replies.flatMap((reply) => reply.mentions)])]
      return { ...stored, mentions, replies }
    })
    .filter((thread) => filter.about === undefined || thread.mentions.includes(filter.about) || thread.author === filter.about)
}
export type CommentWrite =
  | { op: 'create'; page: string; body: string; as?: string; anchor?: string }
  | { op: 'reply'; thread: string; body: string; as?: string }
  | { op: 'resolve' | 'reopen'; thread: string; as?: string }

const intentOfStatusOp = { resolve: 'resolve-thread', reopen: 'reopen-thread' } as const

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
  } else if (write.op === 'reply') {
    form.set('intent', 'reply')
    form.set('threadId', write.thread)
    form.set('body', write.body)
  } else {
    form.set('intent', intentOfStatusOp[write.op])
    form.set('threadId', write.thread)
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
  if (write.op === 'resolve' || write.op === 'reopen') return { thread: write.thread }
  if (write.op === 'reply') {
    if (typeof result.replyId !== 'string') throw new DocsiteRejected(`站点的评论接口没有回 replyId：${JSON.stringify(result)}`)
    return { thread: write.thread, reply: result.replyId }
  }
  if (typeof result.threadId !== 'string') throw new DocsiteRejected(`站点的评论接口没有回 threadId：${JSON.stringify(result)}`)
  return { thread: result.threadId }
}
