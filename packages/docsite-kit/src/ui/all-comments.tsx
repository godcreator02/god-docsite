import { useEffect, useState, type ReactNode } from 'react'
import type { CommentEntry, Commenter, CommentThread, Person } from '../comments.js'
import { linkedCommentParam } from '../site-link-targets.js'
import { CommentEditor, CommentItem, PeopleContext, postComment, recentThreadToOpen, rememberThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'

/** 从全部评论页去一串评论批的那一页 */
export function commentLinkOf(page: string, thread: string) {
  return `${page}?${new URLSearchParams({ [linkedCommentParam]: thread })}`
}

export type AllCommentsProps<Entry extends CommentEntry> = {
  /** 全站的评论串（commentThreadsOf） */
  threads: ReadonlyArray<CommentThread<Entry>>
  /** 站点人员列表 */
  people: readonly Person[]
  /** 写评论的人；只读时是 null */
  commenter: Commenter | null
  /** 和我有关的评论串（服务端用 commentThreadIdsAbout 算）：我发起的、我回复过的、@ 了我的 */
  aboutMe: readonly string[]
  /** 页面地址到标题 */
  pageTitles: Readonly<Record<string, string>>
  renderBody: (entry: Entry) => ReactNode
  apiUrl?: string
}

type StatusFilter = 'open' | 'resolved' | 'all'

function lastActivityOf(thread: CommentThread<CommentEntry>) {
  return thread.replies.at(-1)?.createdAt ?? thread.head.createdAt
}

const chipClassName = 'rounded-md border px-2 py-0.5 text-xs'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`${chipClassName} ${active ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground' : 'text-fd-muted-foreground hover:bg-fd-accent'}`}>
      {children}
    </button>
  )
}

/**
 * 全部评论页：全站的评论串按最近活动排，筛选状态、页面、和我有关的。挂在页面上的点了去那一页并打开它；
 * 不挂在页面上的就在这里展开、回复，也在这里发起
 */
export function AllComments<Entry extends CommentEntry>({ threads, people, commenter, aboutMe, pageTitles, renderBody, apiUrl = '/api/comments' }: AllCommentsProps<Entry>) {
  const api: CommentApi = { url: apiUrl }
  const [status, setStatus] = useState<StatusFilter>('open')
  const [onlyAboutMe, setOnlyAboutMe] = useState(false)
  const [page, setPage] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string>()
  // 发起、回复后开发服务整页刷新，刷新后重新展开刚才那串
  useEffect(() => setExpandedId(recentThreadToOpen()), [])
  const pages = [...new Set(threads.flatMap((thread) => (thread.head.page === undefined ? [] : [thread.head.page])))].sort()
  const shown = threads
    .filter((thread) => status === 'all' || thread.head.status === status)
    .filter((thread) => !onlyAboutMe || aboutMe.includes(thread.id))
    .filter((thread) => page === '' || (page === '-' ? thread.head.page === undefined : thread.head.page === page))
    .sort((a, b) => lastActivityOf(b).localeCompare(lastActivityOf(a)))
  return (
    <PeopleContext value={people}>
      <div className="flex flex-col gap-4">
        {commenter && (
          <CommentEditor
            placeholder="发起一条不挂在页面上的评论（写 @id 提到某人）"
            submitLabel="发起"
            onSubmit={async (body, images) => {
              const { thread } = await postComment(api, { op: 'create', body }, images)
              rememberThreadToOpen(thread)
            }}
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={status === 'open'} onClick={() => setStatus('open')}>未解决</Chip>
          <Chip active={status === 'resolved'} onClick={() => setStatus('resolved')}>已解决</Chip>
          <Chip active={status === 'all'} onClick={() => setStatus('all')}>全部</Chip>
          {commenter && (
            <Chip active={onlyAboutMe} onClick={() => setOnlyAboutMe(!onlyAboutMe)}>
              和我有关
            </Chip>
          )}
          <select value={page} onChange={(event) => setPage(event.target.value)} className={`${chipClassName} ms-auto bg-fd-background`}>
            <option value="">所有页面</option>
            <option value="-">不挂在页面上的</option>
            {pages.map((url) => (
              <option key={url} value={url}>
                {pageTitles[url] ?? url}
              </option>
            ))}
          </select>
        </div>
        {shown.length === 0 && <p className="text-sm text-fd-muted-foreground">没有这样的评论</p>}
        {shown.map((thread) => {
          const where = thread.head.page === undefined ? '不挂在页面上' : (pageTitles[thread.head.page] ?? thread.head.page)
          const expanded = expandedId === thread.id
          return (
            <div key={thread.id} className="rounded-xl border bg-fd-card p-3">
              {expanded ? (
                <ThreadView thread={thread} renderBody={renderBody} commenter={commenter} api={api} note={where} onClose={() => setExpandedId(undefined)} />
              ) : (
                <a
                  href={thread.head.page === undefined ? undefined : commentLinkOf(thread.head.page, thread.id)}
                  onClick={thread.head.page === undefined ? () => setExpandedId(thread.id) : undefined}
                  className="flex cursor-pointer flex-col gap-1.5 no-underline"
                >
                  <span className="flex items-center gap-2 text-xs text-fd-muted-foreground">
                    <span className="truncate">{where}</span>
                    {thread.head.status === 'resolved' && <span className="rounded bg-fd-muted px-1.5">已解决</span>}
                    {thread.replies.length > 0 && <span className="ms-auto shrink-0">{thread.replies.length} 条回复</span>}
                  </span>
                  <CommentItem entry={thread.head} thread={thread.id} renderBody={renderBody} commenter={commenter} api={api} clamped />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </PeopleContext>
  )
}
