import { useEffect, useState, type ReactNode } from 'react'
import type { Person } from '@godcreator/docsite-identity'
import type { CommentEntry, Commenter, CommentThread } from '../comments.js'
import { commentLinkOf } from '../comment-links.js'
import { CommentEditor, CommentItem, PeopleContext, postComment, recentThreadToOpen, rememberThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'

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
  /** 评论接口的地址，默认 /api/comments */
  apiUrl?: string
  /** 一次写入真正成功后调（create/reply/edit/delete/resolve/reopen 都算）：宿主在这里重新读取数据并刷新页面；失败的请求不调 */
  onWritten?: (written: { thread: string; file: string }) => void
}

type StatusFilter = 'open' | 'resolved' | 'all'

function lastActivityOf(thread: CommentThread<CommentEntry>) {
  return thread.replies.at(-1)?.createdAt ?? thread.head.createdAt
}

const chipClassName = 'rounded-md border border-[var(--docsite-comments-border)] px-2 py-0.5 text-xs'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`${chipClassName} ${active ? 'border-[var(--docsite-comments-primary)] bg-[var(--docsite-comments-primary)] text-[var(--docsite-comments-primary-foreground)]' : 'text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]'}`}>
      {children}
    </button>
  )
}

/**
 * 全部评论页：全站的评论串按最近活动排，筛选状态、页面、和我有关的。
 * 每张卡片的打开入口单独放在说明行里（去这一页的链接、不挂在页面上的展开按钮），
 * 正文预览不再整个包在链接或按钮里：评论正文里自己的链接、组件不会被外层交互吞掉，也是合法 HTML
 */
export function AllComments<Entry extends CommentEntry>({ threads, people, commenter, aboutMe, pageTitles, renderBody, apiUrl = '/api/comments', onWritten }: AllCommentsProps<Entry>) {
  const api: CommentApi = { url: apiUrl, onWritten }
  const [status, setStatus] = useState<StatusFilter>('open')
  const [onlyAboutMe, setOnlyAboutMe] = useState(false)
  const [page, setPage] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string>()
  // 发起、回复后宿主刷新页面，刷新后重新展开刚才那串
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
          <select value={page} onChange={(event) => setPage(event.target.value)} className={`${chipClassName} ms-auto bg-[var(--docsite-comments-background)]`}>
            <option value="">所有页面</option>
            <option value="-">不挂在页面上的</option>
            {pages.map((url) => (
              <option key={url} value={url}>
                {pageTitles[url] ?? url}
              </option>
            ))}
          </select>
        </div>
        {shown.length === 0 && <p className="text-sm text-[var(--docsite-comments-muted-foreground)]">没有这样的评论</p>}
        {shown.map((thread) => {
          const where = thread.head.page === undefined ? '不挂在页面上' : (pageTitles[thread.head.page] ?? thread.head.page)
          const expanded = expandedId === thread.id
          return (
            <div key={thread.id} className="rounded-xl border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] p-3">
              {expanded ? (
                <ThreadView thread={thread} renderBody={renderBody} commenter={commenter} api={api} note={where} onClose={() => setExpandedId(undefined)} />
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-[var(--docsite-comments-muted-foreground)]">
                    {thread.head.page === undefined ? (
                      <button type="button" onClick={() => setExpandedId(thread.id)} className="truncate text-[var(--docsite-comments-primary)] hover:underline">
                        {where} · 展开
                      </button>
                    ) : (
                      <a href={commentLinkOf(thread.head.page, thread.id)} className="truncate text-[var(--docsite-comments-primary)] hover:underline">
                        {where}
                      </a>
                    )}
                    {thread.head.status === 'resolved' && <span className="rounded bg-[var(--docsite-comments-muted)] px-1.5">已解决</span>}
                    {thread.replies.length > 0 && <span className="ms-auto shrink-0">{thread.replies.length} 条回复</span>}
                  </div>
                  <CommentItem entry={thread.head} thread={thread.id} renderBody={renderBody} commenter={commenter} api={api} clamped />
                </>
              )}
            </div>
          )
        })}
      </div>
    </PeopleContext>
  )
}
