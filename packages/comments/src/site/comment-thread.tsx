/**
 * 一串评论的完整样子：批的位置、串头、回复（长串折起中间的）、每条评论下的表情回应、「复制给 AI」（调用方给了提示词时）、回复框；可写时悬停一条评论露出加表情与删除，悬停串头还露出标为已解决或重新打开。
 * 正文旁的浮窗（CommentsDock）与全站评论表格展开的那一行都用它
 */
import { useState, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import { AddReactionButton, ReactionBar } from './comment-emoji.js'
import { errorOf, type CommentAvatar, type CommentBodyComponent, type CommentWriter, type PageThreadSummary } from './comment-model.js'
import { CommentBody, CommentHeading, CommentIcon, Composer, ThreadQuote, type CommentWriteSuccess, type ThreadPlace } from './comment-parts.js'
import { CopyForAiButton } from './copy-for-ai-button.js'

/** 回复超过这么多条时只露第一条和最后一条，中间的折成「另外 N 条回复」 */
const repliesShownWhenFolded = 2

export interface CommentThreadProps {
  thread: PageThreadSummary
  /** 写入提交到的地址；只读时不用 */
  action: string
  /** 可写时的署名人；缺省就是只读，没有回复框与删除 */
  writer?: CommentWriter
  BodyComponent: CommentBodyComponent
  AvatarComponent?: CommentAvatar
  place: ThreadPlace
  /** 批的位置写给人看的那句；place 是 body 且不给就不显示那一行 */
  note?: string
  /** 回复多时折起中间的 */
  foldReplies?: boolean
  /** 给了就在回复框上方放「复制给 AI」，复制的就是它 */
  aiPrompt?: string
  /** 给了就在右上角放收起按钮 */
  onClose?: () => void
  onReplySent?: (result: CommentWriteSuccess) => void
}

export function CommentThread({ thread, action, writer, BodyComponent, AvatarComponent, place, note, foldReplies = false, aiPrompt, onClose, onReplySent }: CommentThreadProps) {
  const [unfolded, setUnfolded] = useState(false)
  const folded = foldReplies && !unfolded && thread.replies.length > repliesShownWhenFolded
  const shownReplies = folded ? [thread.replies.at(-1)!] : thread.replies
  const writable = writer !== undefined
  return (
    <section data-comment-card={thread.id} data-thread-status={thread.resolved ? 'resolved' : 'open'} className="docsite-thread">
      {onClose ? (
        <button type="button" data-comment-thread-close="" className="docsite-icon-button docsite-thread-close" title="收起（Esc）" aria-label="收起这一串" onClick={onClose}>
          <CommentIcon name="close" />
        </button>
      ) : null}
      <ThreadQuote place={place} note={note} />
      <div className="docsite-thread-comments">
        <OneComment
          author={thread.author}
          createdAt={thread.createdAt}
          path={thread.headPath}
          BodyComponent={BodyComponent}
          AvatarComponent={AvatarComponent}
          reactions={<ReactionBar action={action} target={{ threadId: thread.id }} reactions={thread.reactions ?? []} writer={writer} />}
          hoverActions={
            writable ? (
              <>
                <AddReactionButton action={action} target={{ threadId: thread.id }} reactions={thread.reactions ?? []} writer={writer} />
                <ThreadStatusButton action={action} thread={thread} />
                <DeleteButton action={action} fields={{ intent: 'delete-thread', threadId: thread.id }} marker={{ 'data-delete-thread': thread.id }} title="删除整串（含回复）" />
              </>
            ) : null
          }
        />
        {folded ? (
          <button type="button" data-expand-replies={thread.id} className="docsite-more-replies" onClick={() => setUnfolded(true)}>
            <CommentIcon name="expand" />
            另外 {thread.replies.length - 1} 条回复
          </button>
        ) : null}
        {shownReplies.map((reply) => (
          <div key={reply.id} data-reply={reply.id}>
            <OneComment
              author={reply.author}
              createdAt={reply.createdAt}
              path={reply.path}
              BodyComponent={BodyComponent}
              AvatarComponent={AvatarComponent}
              reactions={<ReactionBar action={action} target={{ threadId: thread.id, replyId: reply.id }} reactions={reply.reactions ?? []} writer={writer} />}
              hoverActions={
                writable ? (
                  <>
                    <AddReactionButton action={action} target={{ threadId: thread.id, replyId: reply.id }} reactions={reply.reactions ?? []} writer={writer} />
                    <DeleteButton action={action} fields={{ intent: 'delete-reply', threadId: thread.id, replyId: reply.id }} marker={{ 'data-delete-reply': reply.id }} title="删除这条回复" />
                  </>
                ) : null
              }
            />
          </div>
        ))}
      </div>
      {aiPrompt !== undefined ? (
        <div className="docsite-thread-ai" data-thread-ai={thread.id}>
          <CopyForAiButton prompt={aiPrompt} copiedNotice="已复制，粘贴给你的 AI" title="把这一串写成提示词复制下来，粘贴给你用的 AI：它读完整串、核实以后回复在这里" />
        </div>
      ) : null}
      {writable ? (
        <div className="docsite-thread-reply">
          <Composer
            action={action}
            fields={{ intent: 'reply', threadId: thread.id }}
            placeholder="回复…"
            writer={writer}
            AvatarComponent={AvatarComponent}
            formAttributes={{ 'data-reply-form': thread.id }}
            onSent={onReplySent}
          />
        </div>
      ) : null}
    </section>
  )
}

function OneComment({
  author,
  createdAt,
  path,
  BodyComponent,
  AvatarComponent,
  reactions,
  hoverActions,
}: {
  author: CommentWriter
  createdAt: string
  path: string
  BodyComponent: CommentBodyComponent
  AvatarComponent?: CommentAvatar
  reactions: ReactNode
  hoverActions: ReactNode
}) {
  return (
    <div className="docsite-comment">
      {hoverActions ? <div className="docsite-comment-actions">{hoverActions}</div> : null}
      <CommentHeading author={author} createdAt={createdAt} AvatarComponent={AvatarComponent} />
      <div className="docsite-comment-body">
        <CommentBody path={path} BodyComponent={BodyComponent} />
        {reactions}
      </div>
    </div>
  )
}

/** 未解决的串是「标为已解决」，已解决的是「重新打开」：按钮名写在 title 与 aria-label 上 */
function ThreadStatusButton({ action, thread }: { action: string; thread: PageThreadSummary }) {
  const fetcher = useFetcher()
  const error = errorOf(fetcher.data)
  const label = thread.resolved ? '重新打开' : '标为已解决'
  const title = thread.resolved ? `${thread.resolved.by.name} 标为已解决；点了重新打开` : '标为已解决：它带来的 @ 与回复不再算待办'
  return (
    <fetcher.Form method="post" action={action}>
      <input type="hidden" name="intent" value={thread.resolved ? 'reopen-thread' : 'resolve-thread'} />
      <input type="hidden" name="threadId" value={thread.id} />
      <button type="submit" className="docsite-icon-button" title={title} aria-label={label} disabled={fetcher.state !== 'idle'} data-thread-status-toggle={thread.id}>
        <CommentIcon name={thread.resolved ? 'reopen' : 'check'} />
      </button>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  )
}

function DeleteButton({ action, fields, marker, title }: { action: string; fields: Record<string, string>; marker: Record<`data-${string}`, string>; title: string }) {
  const fetcher = useFetcher()
  const error = errorOf(fetcher.data)
  return (
    <fetcher.Form method="post" action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="docsite-icon-button" title={title} aria-label={title} disabled={fetcher.state !== 'idle'} {...marker}>
        <CommentIcon name="trash" />
      </button>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  )
}
