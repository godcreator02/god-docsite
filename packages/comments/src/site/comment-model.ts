/**
 * 评论界面的数据形状与写入约定。
 *
 * 与宿主的分工：宿主路由的 loader 用 pageThreadsOf 读出本页评论（作者已解析成 {id,name}），
 * 界面里的表单按下面的字段 POST 到 action 参数给的地址，那个地址的路由 action 调 handleCommentWrite（外部契约，两边同改）：
 *   intent=create-thread：page、body、anchor?（批整页不带）
 *   intent=reply：threadId、body
 *   intent=delete-reply：threadId、replyId
 *   intent=delete-thread：threadId
 *   intent=resolve-thread、reopen-thread：threadId
 *   intent=add-reaction、remove-reaction：threadId、replyId?（点在串头不带）、emoji（reactionEmojis 里的一个）
 * 返回 { ok: true, … } 或 { ok: false, error: 文案 }（失败随状态码）。
 * 界面只接收可写或只读的结果（commentsAccessOf），不认识身份码；头像由宿主经 AvatarComponent 传进来。
 * 署名（as）只给 agent 经命令用，网页界面里不出现。评论正文由宿主编译（fumadocs-mdx 集合），经 BodyComponent 按路径渲染。
 */
import type { ComponentType } from 'react'
import type { ReactionEmoji } from '../core/reactions.js'

/** 评论作者：宿主解析过的可信组合（模型文件里存的是 authorId 字符串） */
export interface CommentWriter {
  id: string
  name: string
}

/** 一个表情回应：点了它的人按点的先后排，至少一人 */
export interface CommentReaction {
  emoji: ReactionEmoji
  people: CommentWriter[]
}

export interface PageThreadReplySummary {
  id: string
  /** 相对评论集合目录的路径，交给 BodyComponent 渲染正文 */
  path: string
  author: CommentWriter
  createdAt: string
  /** 表情回应，按 reactionEmojis 的顺序；没人点过就没有 */
  reactions?: CommentReaction[]
}

export interface PageThreadSummary {
  id: string
  headPath: string
  /** 评论挂的页面（页面在 docs 集合里的路径，或功能包页面的地址） */
  page: string
  /** 锚定的目标：元素 id、划字评论的 JSON（见模型 parseCommentAnchor）或缺省（批整页） */
  anchor?: string
  author: CommentWriter
  createdAt: string
  /** 标为已解决的人与时刻；没有就是未解决 */
  resolved?: { by: CommentWriter; at: string }
  /** 串头的表情回应，按 reactionEmojis 的顺序；没人点过就没有 */
  reactions?: CommentReaction[]
  replies: PageThreadReplySummary[]
}

/** 本页评论的写入口状态：可写或只读（原因给界面与测试用） */
export type CommentsAccess = { kind: 'writable'; writer: CommentWriter } | { kind: 'readonly'; reasonCode: string; reasonText: string }

/** 头像组件的形状：宿主从身份包把 Avatar 包一层传进来（评论包不依赖身份包） */
export type CommentAvatar = ComponentType<CommentWriter & { size?: number }>

/** 宿主的评论正文组件：按集合内路径渲染（fumadocs 的 client loader），正文按需加载 */
export type CommentBodyComponent = ComponentType<{ path: string }>

/** action 返回形状的运行时收窄：失败时的文案，成功或还没返回是 null */
export function errorOf(data: unknown): string | null {
  if (data !== null && typeof data === 'object' && 'ok' in data && (data as { ok: unknown }).ok === false) {
    const error = (data as { error?: unknown }).error
    return typeof error === 'string' ? error : '写入被拒绝'
  }
  return null
}

/** 一串最近有人说话的时刻：最后一条回复的时间，没有回复就是串头的时间 */
export function lastActivityOf(thread: PageThreadSummary): string {
  return thread.replies.at(-1)?.createdAt ?? thread.createdAt
}
