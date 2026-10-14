import { mentionsOf } from '@godcreator/docsite-identity'
import type { CollabState, TaskState } from './state.js'
import type { Person } from './people.js'

/**
 * 一串评论读出来的样子：评论包 readCommentThreads 的结果（只用到这几项），浏览器里也能构造。
 * 评论模型没有已解决状态：每串都算
 */
export type CommentThreadOnFile = {
  id: string
  head: { authorId: string; page?: string; file: string; body: string }
  replies: Array<{ authorId: string; file: string; body: string }>
}

/** 一条评论在哪：评论串文件夹名 / 文件名，如 2026-10-10-3f9a2c/index.mdx */
export function commentRefOf(thread: string, file: string): string {
  return `${thread}/${file}`
}

/** 点到一串评论时去哪：挂在页面上的去那一页并打开它，不挂在页面上的去全部评论页并展开它 */
export function commentDestinationOf(thread: Pick<CommentThreadOnFile, 'id'> & { head: { page?: string | undefined } }): string {
  return `${thread.head.page ?? '/comments'}?${new URLSearchParams({ comment: thread.id })}`
}

/** @ 了我的一条：在发起的那条（comment）还是回复（reply）里 */
export type MentionOfMe = { in: 'comment' | 'reply'; comment: string; author: string; text: string; page: string }
/** 别人在我参与的评论串里的回复 */
export type ReplyToMe = { comment: string; author: string; text: string; threadId: string; page: string }

export type InboxItems = {
  /** 负责人是我、还没做完的任务 */
  tasks: TaskState[]
  /** 别人写的、正文 @ 了我的（@<id>） */
  mentions: MentionOfMe[]
  /** 别人在我发起或回复过之后写的回复 */
  repliesToMe: ReplyToMe[]
}

function mentionsOfMe(thread: CommentThreadOnFile, person: string, people: readonly Person[]): MentionOfMe[] {
  const page = commentDestinationOf(thread)
  const entries = [{ ...thread.head, in: 'comment' as const }, ...thread.replies.map((reply) => ({ ...reply, in: 'reply' as const }))]
  return entries
    .filter((entry) => entry.authorId !== person && mentionsOf(entry.body, people).includes(person))
    .map((entry) => ({ in: entry.in, comment: commentRefOf(thread.id, entry.file), author: entry.authorId, text: entry.body, page }))
}

function repliesToMeIn(thread: CommentThreadOnFile, person: string): ReplyToMe[] {
  const page = commentDestinationOf(thread)
  let joined = thread.head.authorId === person
  const replies: ReplyToMe[] = []
  for (const reply of thread.replies) {
    if (reply.authorId === person) joined = true
    else if (joined) replies.push({ comment: commentRefOf(thread.id, reply.file), author: reply.authorId, text: reply.body, threadId: thread.id, page })
  }
  return replies
}

/** 现在该这个人处理的：没有「已读」，任务做完就不再列出 */
export function inboxOf(state: Pick<CollabState, 'tasks'>, threads: readonly CommentThreadOnFile[], person: string, people: readonly Person[]): InboxItems {
  return {
    tasks: state.tasks.filter((task) => task.owner === person && task.status !== 'done'),
    mentions: threads.flatMap((thread) => mentionsOfMe(thread, person, people)),
    repliesToMe: threads.flatMap((thread) => repliesToMeIn(thread, person)),
  }
}
