/**
 * 全站评论的表格（只读）：一行一串，按最近有人说话的时刻排，点一行在下面展开整串（./comment-thread），点页面名去那一页。
 * 批的位置只按锚点的种类写（元素、划字带原文、整页）：被批的元素还在不在、原文改没改，要打开那一页才量得出来
 */
import { Fragment, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { parseCommentAnchor } from '../core/anchor.js'
import { lastActivityOf, type CommentAvatar, type CommentBodyComponent, type PageThreadSummary } from './comment-model.js'
import { CommentAvatarOf, CommentBody, CommentIcon, CommentTime, type ThreadPlace } from './comment-parts.js'
import { CommentThread } from './comment-thread.js'

export interface CommentsTableRow {
  thread: PageThreadSummary
  pageTitle: string
  pageUrl: string
}

export interface CommentsTableProps {
  rows: CommentsTableRow[]
  BodyComponent: CommentBodyComponent
  AvatarComponent?: CommentAvatar
}

/** 位置那一格：种类标签，划字的再带原文 */
function placeCellOf(thread: PageThreadSummary): { place: ThreadPlace; label: string; quote?: string } {
  const anchor = parseCommentAnchor(thread.anchor)
  if (anchor.kind === 'page') return { place: 'page', label: '整页' }
  if (anchor.kind === 'element') return { place: 'body', label: '元素' }
  if (anchor.kind === 'text') return { place: 'body', label: '划字', quote: anchor.quote }
  return { place: 'missing', label: '锚点认不出' }
}

export function CommentsTable({ rows, BodyComponent, AvatarComponent }: CommentsTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const sorted = [...rows].sort((a, b) => lastActivityOf(b.thread).localeCompare(lastActivityOf(a.thread)))
  const toggle = (threadId: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return next
    })
  return (
    <div className="docsite-comments-table not-prose">
      <p className="docsite-comments-table-meta">按最近有人说话排 · {rows.length} 串 · 这里只读，写评论去对应页面</p>
      <table>
        <thead>
          <tr>
            <th className="docsite-comments-table-comment">评论</th>
            <th>页面</th>
            <th>位置</th>
            <th>作者</th>
            <th className="docsite-comments-table-number">回复</th>
            <th>最近</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ thread, pageTitle, pageUrl }) => {
            const open = expanded.has(thread.id)
            const cell = placeCellOf(thread)
            const onKeyDown = (event: KeyboardEvent) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              toggle(thread.id)
            }
            return (
              <Fragment key={thread.id}>
                <tr data-comment-row={thread.id} tabIndex={0} aria-expanded={open} onClick={() => toggle(thread.id)} onKeyDown={onKeyDown}>
                  <td>
                    <div className="docsite-comments-table-preview">
                      <CommentIcon name={open ? 'chevronDown' : 'chevronRight'} />
                      <div className="docsite-comments-table-clip">
                        <CommentBody path={thread.headPath} BodyComponent={BodyComponent} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <Link to={pageUrl} className="docsite-comments-table-page" onClick={(event) => event.stopPropagation()}>
                      <CommentIcon name="page" />
                      {pageTitle}
                    </Link>
                  </td>
                  <td>
                    <span className={`docsite-place-chip docsite-place-chip-${cell.place}`}>{cell.label}</span>
                    {cell.quote ? <span className="docsite-comments-table-quote">{cell.quote}</span> : null}
                  </td>
                  <td>
                    <span className="docsite-comments-table-author">
                      <CommentAvatarOf author={thread.author} AvatarComponent={AvatarComponent} size={20} />
                      {thread.author.name}
                    </span>
                  </td>
                  <td className="docsite-comments-table-number">{thread.replies.length > 0 ? thread.replies.length : ''}</td>
                  <td>
                    <CommentTime at={lastActivityOf(thread)} />
                  </td>
                </tr>
                {open ? (
                  <tr className="docsite-comments-table-detail">
                    <td colSpan={6}>
                      <CommentThread thread={thread} action="" BodyComponent={BodyComponent} AvatarComponent={AvatarComponent} place={cell.place} {...(cell.quote ? { note: `「${cell.quote}」` } : {})} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
