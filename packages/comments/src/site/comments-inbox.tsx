/**
 * 本页评论的收件箱：右下角「评论」按钮弹出的列表（CommentsDock 管开关）。
 * 一行一串，按批在正文里、整页、找不到原文筛；点一行交给宿主打开那一串；可写时底部是批整页的输入框
 */
import { useState, type KeyboardEvent } from 'react'
import type { CommentAvatar, CommentBodyComponent, CommentsAccess, PageThreadSummary } from './comment-model.js'
import { CommentAvatarOf, CommentBody, CommentIcon, CommentTime, Composer, ThreadQuote, type CommentWriteSuccess, type ThreadPlace } from './comment-parts.js'

export interface InboxItem {
  thread: PageThreadSummary
  place: ThreadPlace
  note?: string
}

type InboxFilter = 'all' | ThreadPlace

const filterLabels: Array<[InboxFilter, string]> = [
  ['all', '全部'],
  ['body', '正文里'],
  ['page', '整页'],
  ['missing', '找不到原文'],
]

export interface CommentsInboxProps {
  items: InboxItem[]
  pagePath: string
  action: string
  access: CommentsAccess
  BodyComponent: CommentBodyComponent
  AvatarComponent?: CommentAvatar
  openThreadId: string | null
  onOpenThread: (threadId: string) => void
  onClose: () => void
  onThreadCreated: (threadId: string) => void
}

export function CommentsInbox({ items, pagePath, action, access, BodyComponent, AvatarComponent, openThreadId, onOpenThread, onClose, onThreadCreated }: CommentsInboxProps) {
  const [filter, setFilter] = useState<InboxFilter>('all')
  const countOf = (key: InboxFilter) => (key === 'all' ? items.length : items.filter((item) => item.place === key).length)
  const tabs = filterLabels.filter(([key]) => key === 'all' || countOf(key) > 0)
  const shownFilter = tabs.some(([key]) => key === filter) ? filter : 'all'
  const shown = shownFilter === 'all' ? items : items.filter((item) => item.place === shownFilter)
  return (
    <div data-comments-inbox="" data-comment-count={items.length} role="dialog" aria-label="本页评论" className="docsite-inbox">
      <header className="docsite-inbox-head">
        <span>本页评论</span>
        <button type="button" data-comment-inbox-close="" className="docsite-icon-button" title="收起" aria-label="收起本页评论" onClick={onClose}>
          <CommentIcon name="close" />
        </button>
      </header>
      {access.kind === 'readonly' ? (
        <p data-readonly-reason={access.reasonCode} className="docsite-readonly-reason">
          <CommentIcon name="lock" />
          <span>{access.reasonText}</span>
        </p>
      ) : null}
      <div role="tablist" className="docsite-inbox-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={shownFilter === key} data-inbox-filter={key} onClick={() => setFilter(key)}>
            {label}
            <span>{countOf(key)}</span>
          </button>
        ))}
      </div>
      <div className="docsite-inbox-list">
        {shown.length === 0 ? <p className="docsite-inbox-empty">这一页还没有评论</p> : null}
        {shown.map((item) => (
          <InboxRow key={item.thread.id} item={item} open={item.thread.id === openThreadId} BodyComponent={BodyComponent} AvatarComponent={AvatarComponent} onOpen={onOpenThread} />
        ))}
      </div>
      {access.kind === 'writable' ? (
        <div className="docsite-inbox-foot">
          <Composer
            action={action}
            fields={{ intent: 'create-thread', page: pagePath }}
            placeholder="评论整页…"
            writer={access.writer}
            AvatarComponent={AvatarComponent}
            formAttributes={{ 'data-new-thread-form': '' }}
            onSent={(result: CommentWriteSuccess) => {
              if (result.threadId !== undefined) onThreadCreated(result.threadId)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function InboxRow({
  item,
  open,
  BodyComponent,
  AvatarComponent,
  onOpen,
}: {
  item: InboxItem
  open: boolean
  BodyComponent: CommentBodyComponent
  AvatarComponent?: CommentAvatar
  onOpen: (threadId: string) => void
}) {
  const { thread } = item
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen(thread.id)
  }
  return (
    <div
      role="button"
      tabIndex={0}
      data-comment-row={thread.id}
      aria-current={open ? 'true' : undefined}
      className={open ? 'docsite-inbox-row docsite-inbox-row-open' : 'docsite-inbox-row'}
      onClick={() => onOpen(thread.id)}
      onKeyDown={onKeyDown}
    >
      <CommentAvatarOf author={thread.author} AvatarComponent={AvatarComponent} size={28} />
      <div className="docsite-inbox-row-main">
        <div className="docsite-inbox-row-top">
          <span className="docsite-comment-authorname">{thread.author.name}</span>
          <CommentTime at={thread.createdAt} />
          {thread.replies.length > 0 ? (
            <span className="docsite-inbox-row-replies" title={`${thread.replies.length} 条回复`}>
              <CommentIcon name="message" />
              {thread.replies.length}
            </span>
          ) : null}
        </div>
        <ThreadQuote place={item.place} note={item.note} />
        <div className="docsite-inbox-row-body">
          <CommentBody path={thread.headPath} BodyComponent={BodyComponent} />
        </div>
      </div>
    </div>
  )
}
