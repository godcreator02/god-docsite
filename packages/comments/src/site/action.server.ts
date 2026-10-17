import { authorizeWrite, WriteAccessError, type Person, type SiteIdentity } from '@godcreator/identity'
import { data } from 'react-router'
import { CommentWriteRejected } from '../core/comment-file.js'
import { isReactionEmoji, reactionEmojis, type ReactionEmoji } from '../core/reactions.js'
import { createReply, createThread, deleteReply, deleteThread, setReaction, setThreadStatus } from '../node/store.js'

export const commentIntents = ['create-thread', 'reply', 'delete-reply', 'delete-thread', 'resolve-thread', 'reopen-thread', 'add-reaction', 'remove-reaction'] as const
export type CommentIntent = (typeof commentIntents)[number]

/** 写入结果：评论界面按 ok 判断成败，失败时显示 error（外部契约，见 comment-model.ts 的字段约定） */
export type CommentWriteResult =
  | { ok: true; intent: CommentIntent; threadId?: string; replyId?: string }
  | { ok: false; error: string }

export type CommentWriteOptions = {
  request: Request
  /** 站点的评论目录（评论集合的目录） */
  commentsDir: string
  /** 站点的人员列表：as 只能是其中登记的 agent */
  people: readonly Person[]
  /** 本机身份：没有人时只读，写入 403 */
  identity: SiteIdentity<Person>
  /** 站点的可信 origin：请求的 Origin 头要和它完全一样 */
  trustedOrigin: string
}

/** 每种 intent 收的表单字段（intent 与 as 之外）；写了别的字段就拒绝 */
const fieldsOfIntent: Record<CommentIntent, readonly string[]> = {
  'create-thread': ['page', 'body', 'anchor'],
  reply: ['threadId', 'body'],
  'delete-reply': ['threadId', 'replyId'],
  'delete-thread': ['threadId'],
  'resolve-thread': ['threadId'],
  'reopen-thread': ['threadId'],
  'add-reaction': ['threadId', 'replyId', 'emoji'],
  'remove-reaction': ['threadId', 'replyId', 'emoji'],
}

/** 表单里收到的表情：不是能点的那几个就拒绝 */
function reactionEmojiField(form: FormData): ReactionEmoji {
  const emoji = textField(form, 'emoji')
  if (!isReactionEmoji(emoji)) throw new CommentWriteRejected(400, `表情 ${JSON.stringify(emoji)} 不能点，能点的只有 ${reactionEmojis.join(' ')}`)
  return emoji
}

function isCommentIntent(value: string): value is CommentIntent {
  return (commentIntents as readonly string[]).includes(value)
}

function assertKnownFields(form: FormData, intent: CommentIntent): void {
  const known = ['intent', 'as', ...fieldsOfIntent[intent]]
  const unknownField = [...form.keys()].find((name) => !known.includes(name))
  if (unknownField !== undefined) throw new CommentWriteRejected(400, `${intent} 认不出字段 ${unknownField}，能写的只有 ${known.join('、')}`)
}

/** 表单里的一个文字字段：缺了或是文件都拒绝 */
function textField(form: FormData, name: string): string {
  const value = form.get(name)
  if (value === null) throw new CommentWriteRejected(400, `缺 ${name} 字段`)
  if (typeof value !== 'string') throw new CommentWriteRejected(400, `${name} 要是文字，收到的是文件`)
  return value
}

/** 表单里可以不写的文字字段：缺了或是空串都当没写 */
function optionalTextField(form: FormData, name: string): string | undefined {
  if (form.get(name) === null) return undefined
  const value = textField(form, name)
  return value === '' ? undefined : value
}

async function formOf(request: Request): Promise<FormData> {
  try {
    return await request.formData()
  } catch (error) {
    if (error instanceof TypeError) throw new CommentWriteRejected(400, `请求体要是表单：${error.message}`)
    throw error
  }
}

async function performCommentWrite(form: FormData, commentsDir: string, author: Person): Promise<CommentWriteResult> {
  const intent = textField(form, 'intent')
  if (!isCommentIntent(intent)) throw new CommentWriteRejected(400, `认不出 intent ${JSON.stringify(intent)}，能写的只有 ${commentIntents.join('、')}`)
  assertKnownFields(form, intent)
  switch (intent) {
    case 'create-thread': {
      const anchor = optionalTextField(form, 'anchor')
      const created = await createThread(commentsDir, {
        page: textField(form, 'page'),
        authorId: author.id,
        body: textField(form, 'body'),
        ...(anchor !== undefined ? { anchor } : {}),
      })
      return { ok: true, intent, threadId: created.id }
    }
    case 'reply': {
      const threadId = textField(form, 'threadId')
      const created = await createReply(commentsDir, threadId, { authorId: author.id, body: textField(form, 'body') })
      return { ok: true, intent, threadId, replyId: created.id }
    }
    case 'delete-reply':
      await deleteReply(commentsDir, textField(form, 'threadId'), textField(form, 'replyId'))
      return { ok: true, intent }
    case 'delete-thread':
      await deleteThread(commentsDir, textField(form, 'threadId'))
      return { ok: true, intent }
    case 'resolve-thread': {
      const threadId = textField(form, 'threadId')
      await setThreadStatus(commentsDir, threadId, 'resolved', { by: author.id })
      return { ok: true, intent, threadId }
    }
    case 'reopen-thread': {
      const threadId = textField(form, 'threadId')
      await setThreadStatus(commentsDir, threadId, 'open')
      return { ok: true, intent, threadId }
    }
    case 'add-reaction':
    case 'remove-reaction': {
      const threadId = textField(form, 'threadId')
      const replyId = optionalTextField(form, 'replyId')
      await setReaction(commentsDir, threadId, { ...(replyId !== undefined ? { replyId } : {}), emoji: reactionEmojiField(form), by: author.id, on: intent === 'add-reaction' })
      return { ok: true, intent, threadId, ...(replyId !== undefined ? { replyId } : {}) }
    }
  }
}

/**
 * 评论写入的路由 action：核对 Origin 与身份（as 只给 agent，表单里的空 as 当没写），再按 intent 建串、回复、删除、标为已解决、重新打开、加上或撤掉表情。
 * 返回值路由 action 直接 return：成功 { ok: true, intent, threadId?, replyId? }；
 * 来源或身份不对、请求字段不对、目标评论不存在时 { ok: false, error } 并带上 4xx 状态码；别的错原样抛出
 */
export async function handleCommentWrite({ request, commentsDir, people, identity, trustedOrigin }: CommentWriteOptions) {
  try {
    const form = await formOf(request)
    const asField = form.get('as')
    const author = authorizeWrite(request, { identity, people, as: asField === '' ? undefined : asField, origin: trustedOrigin })
    return data<CommentWriteResult>(await performCommentWrite(form, commentsDir, author))
  } catch (error) {
    if (error instanceof WriteAccessError || error instanceof CommentWriteRejected) {
      return data<CommentWriteResult>({ ok: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
