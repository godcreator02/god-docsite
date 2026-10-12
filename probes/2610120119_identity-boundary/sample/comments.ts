/**
 * 评论业务测试桩：纯函数，内存态由宿主持有。
 * 按跨任务共享约定，作者只收结构化的 { id, name }——评论模块不认识身份码、Origin、as，
 * 也不 import 身份包；身份与授权由宿主在调这里之前完成
 */
export type CommentAuthor = { id: string; name: string }

export type Comment = { id: string; author: CommentAuthor; body: string; at: string }

/** 业务输入不合法：status 是要回给浏览器的 HTTP 状态码（与身份层的 WriteAccessError 分层，各管各的） */
export class CommentInputError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function commentBodyProblem(body: string): string | null {
  if (body.trim() === '') return '评论正文不能是空的'
  if (body.length > 2000) return '评论正文最长 2000 字'
  return null
}

/** 加一条评论：返回新数组，不改输入。作者字段按白名单重造，上游对象带什么都不会跟进来 */
export function addComment(existing: readonly Comment[], author: CommentAuthor, body: string): { comments: Comment[]; added: Comment } {
  const problem = commentBodyProblem(body)
  if (problem) throw new CommentInputError(400, problem)
  const added: Comment = {
    id: crypto.randomUUID(),
    author: { id: author.id, name: author.name },
    body,
    at: new Date().toISOString(),
  }
  return { comments: [...existing, added], added }
}
