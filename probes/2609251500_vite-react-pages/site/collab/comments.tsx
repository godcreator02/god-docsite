import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Comment, CommentAnchor, SitePage } from './data'

const canWrite = import.meta.env.DEV
const authorStorageKey = 'collab-author'

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

const skippedTags = new Set(['STYLE', 'SCRIPT'])

export function findAnchorElement(root: HTMLElement, anchor: CommentAnchor): HTMLElement | null {
  if (anchor.selector) return root.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(anchor.selector)}"]`)
  if (!anchor.quote) return null
  const quote = normalizeText(anchor.quote)
  let innermost: HTMLElement | null = null
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (skippedTags.has(element.tagName)) continue
    if (anchor.tag && element.tagName.toLowerCase() !== anchor.tag) continue
    if (!normalizeText(element.textContent ?? '').includes(quote)) continue
    if (!innermost || innermost.contains(element)) innermost = element
  }
  return innermost
}

function anchorForElement(element: HTMLElement): CommentAnchor {
  const insp = element.closest('[data-insp-path]')?.getAttribute('data-insp-path') ?? undefined
  const ownAnchor = element.getAttribute('data-anchor')
  if (ownAnchor) return { selector: ownAnchor, insp }
  const quote = normalizeText(element.textContent ?? '').slice(0, 40)
  if (quote) return { quote, tag: element.tagName.toLowerCase(), insp }
  const section = element.closest('[data-anchor]')?.getAttribute('data-anchor')
  if (section) return { selector: section, insp }
  throw new Error('这个元素没有文字，也不在任何 data-anchor 区块里，无法定位')
}

async function postCollab(action: string, body: Record<string, unknown>) {
  const response = await fetch(`/__collab${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

type Box = { top: number; left: number; width: number; height: number }

function boxOf(element: HTMLElement, container: HTMLElement): Box {
  const rect = element.getBoundingClientRect()
  const base = container.getBoundingClientRect()
  return { top: rect.top - base.top, left: rect.left - base.left, width: rect.width, height: rect.height }
}

function useCommentBoxes(containerRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>, comments: Comment[]) {
  const [boxes, setBoxes] = useState<Record<string, Box | null>>({})
  const measure = useCallback(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return
    const next: Record<string, Box | null> = {}
    for (const comment of comments) {
      const element = findAnchorElement(content, comment.anchor)
      next[comment.id] = element ? boxOf(element, container) : null
    }
    setBoxes(next)
  }, [comments, containerRef, contentRef])

  useLayoutEffect(measure, [measure])
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, contentRef])
  return boxes
}

function usePicker(active: boolean, contentRef: RefObject<HTMLElement | null>, containerRef: RefObject<HTMLElement | null>, onPick: (element: HTMLElement) => void) {
  const [hoverBox, setHoverBox] = useState<Box | null>(null)
  useEffect(() => {
    const content = contentRef.current
    const container = containerRef.current
    if (!active || !content || !container) {
      setHoverBox(null)
      return
    }
    const onMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      setHoverBox(target === content ? null : boxOf(target, container))
    }
    const onClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const target = event.target as HTMLElement
      if (target !== content) onPick(target)
    }
    content.addEventListener('mousemove', onMove)
    content.addEventListener('click', onClick, true)
    return () => {
      content.removeEventListener('mousemove', onMove)
      content.removeEventListener('click', onClick, true)
    }
  }, [active, contentRef, containerRef, onPick])
  return hoverBox
}

function readAuthor() {
  try {
    return localStorage.getItem(authorStorageKey) ?? ''
  } catch {
    return ''
  }
}

function rememberAuthor(author: string) {
  try {
    localStorage.setItem(authorStorageKey, author)
  } catch {
    // 本地存储不可用时只是下次要重新填名字
  }
}

export function CommentFrame({ page, children }: { page: SitePage; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const comments = page.collab.comments
  const [showResolved, setShowResolved] = useState(false)
  const visibleComments = useMemo(() => comments.filter((c) => showResolved || c.status === 'open'), [comments, showResolved])
  const boxes = useCommentBoxes(containerRef, contentRef, visibleComments)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [draftAnchor, setDraftAnchor] = useState<CommentAnchor | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onPick = useCallback((element: HTMLElement) => {
    try {
      setDraftAnchor(anchorForElement(element))
      setError(null)
    } catch (pickError) {
      setError((pickError as Error).message)
    }
    setPicking(false)
  }, [])
  const hoverBox = usePicker(picking, contentRef, containerRef, onPick)

  const run = async (action: string, body: Record<string, unknown>) => {
    try {
      await postCollab(action, { page: page.key, ...body })
      setError(null)
      return true
    } catch (postError) {
      setError((postError as Error).message)
      return false
    }
  }

  const scrollToComment = (comment: Comment) => {
    setSelectedId(comment.id)
    const element = contentRef.current && findAnchorElement(contentRef.current, comment.anchor)
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="flex min-w-0 items-start">
      <div ref={containerRef} className="relative min-w-0 flex-1">
        <div ref={contentRef} className={picking ? 'cursor-crosshair' : undefined}>
          {children}
        </div>
        <div className="pointer-events-none absolute inset-0">
          {visibleComments.map((comment, index) => {
            const box = boxes[comment.id]
            if (!box) return null
            const selected = comment.id === selectedId
            return (
              <div key={comment.id}>
                <div
                  className={`absolute rounded-sm border-2 border-dashed ${selected ? 'border-pink-600 bg-pink-500/10' : 'border-pink-500/70'}`}
                  style={{ top: box.top - 3, left: box.left - 3, width: box.width + 6, height: box.height + 6 }}
                />
                <button
                  type="button"
                  className="pointer-events-auto absolute flex size-5 items-center justify-center rounded-full bg-pink-600 text-[11px] font-semibold text-white"
                  style={{ top: box.top - 12, left: box.left + box.width - 6 }}
                  onClick={() => scrollToComment(comment)}
                >
                  {index + 1}
                </button>
              </div>
            )
          })}
          {hoverBox && (
            <div
              className="absolute rounded-sm border-2 border-sky-500 bg-sky-500/10"
              style={{ top: hoverBox.top, left: hoverBox.left, width: hoverBox.width, height: hoverBox.height }}
            />
          )}
        </div>
      </div>
      <CommentRail
        comments={visibleComments}
        allCount={comments.length}
        boxes={boxes}
        selectedId={selectedId}
        onSelect={scrollToComment}
        showResolved={showResolved}
        onToggleResolved={() => setShowResolved(!showResolved)}
        picking={picking}
        onStartPicking={() => setPicking(!picking)}
        draftAnchor={draftAnchor}
        onCancelDraft={() => setDraftAnchor(null)}
        error={error}
        run={run}
        onDraftSaved={() => setDraftAnchor(null)}
      />
    </div>
  )
}

type RailProps = {
  comments: Comment[]
  allCount: number
  boxes: Record<string, Box | null>
  selectedId: string | null
  onSelect: (comment: Comment) => void
  showResolved: boolean
  onToggleResolved: () => void
  picking: boolean
  onStartPicking: () => void
  draftAnchor: CommentAnchor | null
  onCancelDraft: () => void
  onDraftSaved: () => void
  error: string | null
  run: (action: string, body: Record<string, unknown>) => Promise<boolean>
}

function CommentRail(props: RailProps) {
  const { comments, allCount, boxes, selectedId, onSelect, showResolved, onToggleResolved, picking, onStartPicking, draftAnchor, error, run } = props
  const [author, setAuthor] = useState(readAuthor)
  const [draftText, setDraftText] = useState('')

  const saveDraft = async () => {
    if (!draftAnchor) return
    rememberAuthor(author)
    if (await run('/comments', { anchor: draftAnchor, author, text: draftText })) {
      setDraftText('')
      props.onDraftSaved()
    }
  }

  return (
    <aside className="sticky top-14 hidden max-h-[calc(100dvh-3.5rem)] w-80 shrink-0 overflow-y-auto border-l border-fd-border bg-fd-card p-3 text-sm lg:block">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">批注（{comments.length}/{allCount}）</h2>
        <label className="flex items-center gap-1 text-xs text-fd-muted-foreground">
          <input type="checkbox" checked={showResolved} onChange={onToggleResolved} />
          显示已解决
        </label>
      </div>
      {canWrite && (
        <div className="mb-3 space-y-2">
          <button
            type="button"
            onClick={onStartPicking}
            className={`w-full rounded-md border px-2 py-1 ${picking ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-fd-border hover:bg-fd-accent'}`}
          >
            {picking ? '点页面上的元素（再点一次取消）' : '＋ 添加批注'}
          </button>
          {draftAnchor && (
            <div className="space-y-2 rounded-md border border-sky-500 p-2">
              <p className="text-xs text-fd-muted-foreground">
                位置：{draftAnchor.selector ? `区块 ${draftAnchor.selector}` : `「${draftAnchor.quote}」`}
              </p>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="你的名字"
                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1"
              />
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="批注内容"
                rows={3}
                className="w-full rounded border border-fd-border bg-fd-background px-2 py-1"
              />
              <div className="flex gap-2">
                <button type="button" onClick={saveDraft} className="rounded bg-sky-600 px-3 py-1 text-white">
                  保存
                </button>
                <button type="button" onClick={props.onCancelDraft} className="rounded border border-fd-border px-3 py-1">
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="mb-3 rounded bg-red-500/10 p-2 text-xs text-red-600">{error}</p>}
      <ol className="space-y-2">
        {comments.map((comment, index) => (
          <CommentItem
            key={comment.id}
            number={index + 1}
            comment={comment}
            located={Boolean(boxes[comment.id])}
            selected={comment.id === selectedId}
            onSelect={() => onSelect(comment)}
            author={author}
            run={run}
          />
        ))}
      </ol>
      {comments.length === 0 && <p className="text-fd-muted-foreground">这一页还没有批注。</p>}
    </aside>
  )
}

function CommentItem(props: {
  number: number
  comment: Comment
  located: boolean
  selected: boolean
  onSelect: () => void
  author: string
  run: RailProps['run']
}) {
  const { number, comment, located, selected, onSelect, author, run } = props
  const [replyText, setReplyText] = useState('')
  const resolved = comment.status === 'resolved'
  return (
    <li
      className={`rounded-md border p-2 ${selected ? 'border-pink-600' : 'border-fd-border'} ${resolved ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-fd-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-pink-600 text-[11px] font-semibold text-white">{number}</span>
        <span className="font-medium text-fd-foreground">{comment.author}</span>
        <span>{comment.createdAt}</span>
        {resolved && <span className="rounded bg-emerald-500/15 px-1 text-emerald-700 dark:text-emerald-300">已解决</span>}
        {!located && <span className="rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300">找不到原位置</span>}
      </div>
      <p className="whitespace-pre-wrap">{comment.text}</p>
      {comment.replies.map((reply, i) => (
        <div key={i} className="mt-2 border-l-2 border-fd-border pl-2">
          <p className="text-xs text-fd-muted-foreground">
            {reply.author} · {reply.createdAt}
          </p>
          <p className="whitespace-pre-wrap">{reply.text}</p>
        </div>
      ))}
      {comment.anchor.insp && <p className="mt-1 break-all font-mono text-[10px] text-fd-muted-foreground">{comment.anchor.insp}</p>}
      {canWrite && selected && (
        <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={author ? `以 ${author} 的名义回复` : '先在上方「添加批注」里填名字'}
            rows={2}
            className="w-full rounded border border-fd-border bg-fd-background px-2 py-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!author}
              className="rounded border border-fd-border px-2 py-0.5 disabled:opacity-40"
              onClick={async () => {
                if (await run('/comments/reply', { id: comment.id, author, text: replyText })) setReplyText('')
              }}
            >
              回复
            </button>
            <button
              type="button"
              className="rounded border border-fd-border px-2 py-0.5"
              onClick={() => run('/comments/status', { id: comment.id, status: resolved ? 'open' : 'resolved' })}
            >
              {resolved ? '重新打开' : '标为已解决'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
