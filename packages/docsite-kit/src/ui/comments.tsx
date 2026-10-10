import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { ThemeSwitch } from '@fumadocs/base-ui/layouts/shared/slots/theme-switch'
import type { CommentBlockAnchor, CommentEntry, Commenter, CommentThread } from '../comments.js'
import { anchorLabelOf, blockContaining, blocksOf, placeOfThread, quoteAnchorOfRange, type PageBlock, type ThreadPlace } from './comment-anchors.js'
import { CommentEditor, CommenterChip, CommentItem, postComment, recentThreadToOpen, rememberThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'

/** 页面正文的容器带上这个属性，评论在它里面找被批的原文：<DocsBody {...commentScopeProps}> */
export const commentScopeAttribute = 'data-comment-scope'
export const commentScopeProps = { [commentScopeAttribute]: '' }

/** 原文高亮用 CSS Custom Highlight API，不改正文的 DOM；颜色在 styles.css 的 ::highlight() 里 */
const quoteHighlight = 'docsite-comment'
const activeQuoteHighlight = 'docsite-comment-active'
/** 整块评论批的块加这个属性，styles.css 给它画框 */
const commentedBlockAttribute = 'data-commented-block'

const cardWidth = 360
const badgeHeight = 24

type NewAnchor = { quote: string; quotePrefix: string; quoteSuffix: string } | { block: CommentBlockAnchor } | Record<string, never>

/** 正文上评论的几样东西在评论层里的位置（相对评论层左上角） */
type Placement = {
  /** 没被解决、找得到原文的评论串：右侧评论数按钮的高度，卡片弹出的位置 */
  anchored: Map<string, { badgeTop: number; cardTop: number; cardLeft: number }>
  /** 原文找不到了的评论串 */
  missing: Set<string>
}

type PendingAction = { top: number; anchor: NewAnchor; label: string; cardTop: number; cardLeft: number }

export type PageCommentsProps<Entry extends CommentEntry> = {
  /** 这一页的地址 */
  page: string
  /** 这一页的评论串 */
  threads: ReadonlyArray<CommentThread<Entry>>
  /** 写评论的人；发布站传 null，只能看 */
  commenter: Commenter | null
  /** 渲染一条评论的正文；项目在这里把 MDX 组件传给编译好的正文 */
  renderBody: (entry: Entry) => ReactNode
  /** 评论接口的地址，默认 /api/comments */
  apiUrl?: string
  /** 正文：<DocsBody {...commentScopeProps}>…</DocsBody> */
  children: ReactNode
}

function clampCardLeft(left: number, width: number) {
  return Math.max(0, Math.min(left, width - cardWidth))
}

function rectOfPlace(place: ThreadPlace) {
  if (place.type === 'text') return { first: place.range.getClientRects()[0] ?? place.range.getBoundingClientRect(), whole: place.range.getBoundingClientRect() }
  if (place.type === 'block') {
    const rect = place.element.getBoundingClientRect()
    return { first: rect, whole: rect }
  }
  return undefined
}

function paintHighlights(openRanges: Range[], activeRange: Range | undefined) {
  CSS.highlights.set(quoteHighlight, new Highlight(...openRanges))
  if (activeRange) CSS.highlights.set(activeQuoteHighlight, new Highlight(activeRange))
  else CSS.highlights.delete(activeQuoteHighlight)
}

function containsPoint(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function samePlacement(a: Placement, b: Placement) {
  if (a.anchored.size !== b.anchored.size || a.missing.size !== b.missing.size) return false
  for (const [id, spot] of a.anchored) {
    const other = b.anchored.get(id)
    if (!other || other.badgeTop !== spot.badgeTop || other.cardTop !== spot.cardTop || other.cardLeft !== spot.cardLeft) return false
  }
  for (const id of a.missing) if (!b.missing.has(id)) return false
  return true
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

/**
 * 页面上的评论（照 Notion）：被批的文字标黄、被批的整块画框，正文右侧对应的高度上有评论数按钮，点按钮或点标黄的文字弹出这串评论。
 * 能写评论时（开发服务里），选中正文里的文字浮出「评论」按钮；鼠标移到图片、代码块、表格、组件上，右侧出现「评论这一块」按钮。
 * 右下角的「评论」按钮打开这一页全部评论的列表，分未解决、已解决，也能评论整页
 */
export function PageComments<Entry extends CommentEntry>({ page, threads, commenter, renderBody, apiUrl = '/api/comments', children }: PageCommentsProps<Entry>) {
  const api: CommentApi = { url: apiUrl }
  const layerRef = useRef<HTMLDivElement>(null)
  const blocksRef = useRef<PageBlock[]>([])
  const [openId, setOpenId] = useState<string>()
  const [placement, setPlacement] = useState<Placement>({ anchored: new Map(), missing: new Set() })
  const [selectionAction, setSelectionAction] = useState<PendingAction>()
  const [blockAction, setBlockAction] = useState<PendingAction>()
  const [draft, setDraft] = useState<PendingAction>()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelThreadId, setPanelThreadId] = useState<string>()
  const writable = commenter !== null
  const showGutter = writable || threads.length > 0

  // 发评论后开发服务整页刷新，刷新后重新打开刚才那串
  useEffect(() => {
    const thread = recentThreadToOpen()
    if (thread && threads.some((candidate) => candidate.id === thread)) setOpenId(thread)
  }, [threads])

  const scopeOf = () => {
    const scope = layerRef.current!.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
    if (!scope) throw new Error(`评论找不到正文：PageComments 里面的正文容器要带 ${commentScopeAttribute} 属性，如 <DocsBody {...commentScopeProps}>`)
    return scope
  }

  useEffect(() => {
    const layer = layerRef.current!
    const scope = scopeOf()
    const placeOf = new Map<string, ThreadPlace>()
    let frame = 0
    const measure = () => {
      const blocks = blocksOf(scope)
      blocksRef.current = blocks
      for (const element of scope.querySelectorAll(`[${commentedBlockAttribute}]`)) element.removeAttribute(commentedBlockAttribute)
      placeOf.clear()
      for (const thread of threads) placeOf.set(thread.id, placeOfThread(scope, blocks, thread.head))
      const openThreads = threads.filter((thread) => thread.head.status === 'open')
      const openRanges = openThreads.flatMap((thread) => {
        const place = placeOf.get(thread.id)!
        if (place.type === 'block') place.element.setAttribute(commentedBlockAttribute, thread.id === openId ? 'active' : '')
        return place.type === 'text' ? [place.range] : []
      })
      const activePlace = openId === undefined ? undefined : placeOf.get(openId)
      paintHighlights(openRanges, activePlace?.type === 'text' ? activePlace.range : undefined)

      const layerRect = layer.getBoundingClientRect()
      const anchored = new Map<string, { badgeTop: number; cardTop: number; cardLeft: number }>()
      const missing = new Set<string>()
      const spots = threads
        .map((thread) => ({ thread, rects: rectOfPlace(placeOf.get(thread.id)!) }))
        .filter((spot) => {
          if (placeOf.get(spot.thread.id)!.type === 'missing') missing.add(spot.thread.id)
          return spot.rects !== undefined && (spot.thread.head.status === 'open' || spot.thread.id === openId)
        })
        .sort((a, b) => a.rects!.first.top - b.rects!.first.top)
      let lastBadgeBottom = -Infinity
      for (const { thread, rects } of spots) {
        const badgeTop = Math.max(rects!.first.top - layerRect.top, lastBadgeBottom + 4)
        lastBadgeBottom = badgeTop + badgeHeight
        anchored.set(thread.id, { badgeTop, cardTop: rects!.whole.bottom - layerRect.top + 8, cardLeft: clampCardLeft(rects!.whole.left - layerRect.left, layerRect.width) })
      }
      const next = { anchored, missing }
      setPlacement((current) => (samePlacement(current, next) ? current : next))
    }
    const measureNextFrame = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const openFromQuote = (event: MouseEvent) => {
      if (!document.getSelection()?.isCollapsed) return
      for (const [id, place] of placeOf) {
        if (place.type === 'text' && [...place.range.getClientRects()].some((rect) => containsPoint(rect, event.clientX, event.clientY))) {
          setOpenId(id)
          return
        }
      }
    }
    const observer = new ResizeObserver(measureNextFrame)
    observer.observe(scope)
    scope.addEventListener('click', openFromQuote)
    window.addEventListener('resize', measureNextFrame)
    // 第一次直接排：标签页在后台时 requestAnimationFrame 不执行
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scope.removeEventListener('click', openFromQuote)
      window.removeEventListener('resize', measureNextFrame)
      CSS.highlights.delete(quoteHighlight)
      CSS.highlights.delete(activeQuoteHighlight)
      for (const element of scope.querySelectorAll(`[${commentedBlockAttribute}]`)) element.removeAttribute(commentedBlockAttribute)
    }
  }, [threads, openId])

  // 选中正文里的文字：松开鼠标时在选区上方浮出「评论」按钮
  useEffect(() => {
    if (!writable) return
    const layer = layerRef.current!
    const scope = scopeOf()
    const showForSelection = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return setSelectionAction(undefined)
      const range = selection.getRangeAt(0)
      if (!scope.contains(range.startContainer) || !scope.contains(range.endContainer) || range.toString().trim() === '') return setSelectionAction(undefined)
      const anchor = quoteAnchorOfRange(scope, range)
      const layerRect = layer.getBoundingClientRect()
      const first = range.getClientRects()[0] ?? range.getBoundingClientRect()
      const whole = range.getBoundingClientRect()
      setSelectionAction({
        top: first.top - layerRect.top - 34,
        anchor,
        label: `「${anchor.quote}」`,
        cardTop: whole.bottom - layerRect.top + 8,
        cardLeft: clampCardLeft(whole.left - layerRect.left, layerRect.width),
      })
    }
    const hideWhenCollapsed = () => {
      if (document.getSelection()?.isCollapsed) setSelectionAction(undefined)
    }
    scope.addEventListener('mouseup', showForSelection)
    document.addEventListener('selectionchange', hideWhenCollapsed)
    return () => {
      scope.removeEventListener('mouseup', showForSelection)
      document.removeEventListener('selectionchange', hideWhenCollapsed)
    }
  }, [writable])

  // 鼠标移到图片、代码块、表格、组件上：右侧出现「评论这一块」
  const showBlockAction = (target: EventTarget | null) => {
    if (!writable || !(target instanceof Node)) return
    if (target instanceof Element && target.closest('[data-comment-ui]')) return
    const block = blockContaining(blocksRef.current, target)
    if (!block) return setBlockAction(undefined)
    const layerRect = layerRef.current!.getBoundingClientRect()
    const rect = block.element.getBoundingClientRect()
    // 和已有的评论数按钮错开，排在它们下面
    const badgeTops = [...placement.anchored.values()].map((spot) => spot.badgeTop)
    let top = rect.top - layerRect.top
    while (badgeTops.some((badgeTop) => Math.abs(badgeTop - top) < badgeHeight + 4)) top += badgeHeight + 4
    if (blockAction && blockAction.top === top) return
    setBlockAction({
      top,
      anchor: { block: block.anchor },
      label: anchorLabelOf({ block: block.anchor }),
      cardTop: rect.bottom - layerRect.top + 8,
      cardLeft: clampCardLeft(rect.left - layerRect.left, layerRect.width),
    })
  }

  // 点评论卡片以外的地方关上卡片；写了一半的新评论不因此丢掉，要点「取消」或按 Esc
  useEffect(() => {
    if (openId === undefined) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-comment-ui]')) return
      setOpenId(undefined)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [openId])

  const startDraft = (action: PendingAction) => {
    setOpenId(undefined)
    setSelectionAction(undefined)
    setBlockAction(undefined)
    setDraft(action)
  }
  const createThread = async (anchor: NewAnchor, body: string, images: File[]) => {
    const { thread } = await postComment(api, { op: 'create', page, anchor: JSON.stringify(anchor), body }, images)
    rememberThreadToOpen(thread)
    setDraft(undefined)
    document.getSelection()?.removeAllRanges()
  }

  const openThread = openId === undefined ? undefined : threads.find((thread) => thread.id === openId)
  const openSpot = openId === undefined ? undefined : placement.anchored.get(openId)

  return (
    <div ref={layerRef} className={`relative ${showGutter ? 'pe-10' : ''}`} onMouseMove={(event) => showBlockAction(event.target)} onMouseLeave={() => setBlockAction(undefined)}>
      {children}
      {[...placement.anchored].map(([id, spot]) => {
        const thread = threads.find((candidate) => candidate.id === id)!
        return (
          <button
            key={id}
            type="button"
            data-comment-ui=""
            aria-label={`打开评论：${anchorLabelOf(thread.head)}`}
            onClick={() => setOpenId(id === openId ? undefined : id)}
            className={`absolute end-0 flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors ${id === openId ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground' : 'bg-fd-card text-fd-muted-foreground hover:text-fd-foreground'}`}
            style={{ top: spot.badgeTop }}
          >
            <MessageIcon />
            {1 + thread.replies.length}
          </button>
        )
      })}
      {blockAction && !draft && (
        <button
          type="button"
          data-comment-ui=""
          aria-label="评论这一块"
          title={`评论这一块：${blockAction.label}`}
          onClick={() => startDraft(blockAction)}
          className="absolute end-0 flex h-6 items-center gap-0.5 rounded-full border bg-fd-card px-1.5 text-xs text-fd-muted-foreground hover:text-fd-foreground"
          style={{ top: blockAction.top }}
        >
          <MessageIcon />+
        </button>
      )}
      {selectionAction && !draft && (
        <button
          type="button"
          data-comment-ui=""
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => startDraft(selectionAction)}
          className="absolute z-30 flex items-center gap-1 rounded-lg border bg-fd-popover px-2 py-1 text-xs text-fd-popover-foreground shadow-md hover:bg-fd-accent"
          style={{ top: selectionAction.top, left: selectionAction.cardLeft }}
        >
          <MessageIcon />
          评论
        </button>
      )}
      {draft && commenter && (
        <div data-comment-ui="" className="absolute z-30 flex flex-col gap-2 rounded-xl border bg-fd-popover p-3 text-fd-popover-foreground shadow-lg" style={{ top: draft.cardTop, left: draft.cardLeft, width: cardWidth }}>
          <p className="line-clamp-2 border-s-2 ps-2 text-xs text-fd-muted-foreground">{draft.label}</p>
          <CommentEditor placeholder="写评论…" submitLabel="评论" autoFocus onCancel={() => setDraft(undefined)} onSubmit={(body, images) => createThread(draft.anchor, body, images)} />
        </div>
      )}
      {openThread && openSpot && (
        <div data-comment-ui="" className="absolute z-30 max-h-[60vh] overflow-y-auto rounded-xl border bg-fd-popover p-3 text-fd-popover-foreground shadow-lg" style={{ top: openSpot.cardTop, left: openSpot.cardLeft, width: cardWidth }}>
          <ThreadView key={openThread.id} thread={openThread} renderBody={renderBody} commenter={commenter} api={api} onClose={() => setOpenId(undefined)} />
        </div>
      )}
      {showGutter && (
        <CommentsPanel
          threads={threads}
          placement={placement}
          commenter={commenter}
          renderBody={renderBody}
          api={api}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          detailId={panelThreadId}
          onDetailChange={setPanelThreadId}
          onCreatePageComment={(body, images) => createThread({}, body, images)}
          onGoToThread={(id) => {
            // 窄屏时右侧栏盖住正文，先关上才看得到正文里弹出的卡片
            if (!window.matchMedia('(width >= 80rem)').matches) setPanelOpen(false)
            setOpenId(id)
            const spot = placement.anchored.get(id)
            if (spot) window.scrollTo({ top: layerRef.current!.getBoundingClientRect().top + window.scrollY + spot.badgeTop - window.innerHeight / 3, behavior: 'smooth' })
          }}
        />
      )}
    </div>
  )
}

type CommentsPanelProps<Entry extends CommentEntry> = {
  threads: ReadonlyArray<CommentThread<Entry>>
  placement: Placement
  commenter: Commenter | null
  renderBody: (entry: Entry) => ReactNode
  api: CommentApi
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 在列表里展开看的评论串（整页评论、原文找不到了的、已解决的） */
  detailId: string | undefined
  onDetailChange: (id: string | undefined) => void
  onCreatePageComment: (body: string, images: File[]) => Promise<void>
  /** 正文里找得到原文的评论串：滚到原文、弹出卡片 */
  onGoToThread: (id: string) => void
}

/** 右侧栏打开时 <html> 上的属性：styles.css 据此在宽屏上给整个页面布局让出右侧栏的宽度 */
const commentsSidebarOpenAttribute = 'data-comments-sidebar-open'

/** 右下角的「评论」按钮和它打开的右侧栏 */
function CommentsPanel<Entry extends CommentEntry>(props: CommentsPanelProps<Entry>) {
  const { threads, placement, commenter, renderBody, api, open, onOpenChange, detailId, onDetailChange, onCreatePageComment, onGoToThread } = props
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [writingPageComment, setWritingPageComment] = useState(false)
  useEffect(() => {
    if (!open) return
    document.documentElement.setAttribute(commentsSidebarOpenAttribute, '')
    return () => document.documentElement.removeAttribute(commentsSidebarOpenAttribute)
  }, [open])
  const openThreads = threads.filter((thread) => thread.head.status === 'open')
  const resolvedThreads = threads.filter((thread) => thread.head.status === 'resolved')
  const shown = tab === 'open' ? openThreads : resolvedThreads
  const detail = detailId === undefined ? undefined : threads.find((thread) => thread.id === detailId)
  const noteOf = (thread: CommentThread<Entry>) => (placement.missing.has(thread.id) ? `原文找不到了：${anchorLabelOf(thread.head)}` : anchorLabelOf(thread.head))
  const choose = (thread: CommentThread<Entry>) => {
    if (thread.head.status === 'open' && placement.anchored.has(thread.id)) onGoToThread(thread.id)
    else onDetailChange(thread.id)
  }
  return (
    <>
      {!open && (
        <button
          type="button"
          data-comment-ui=""
          onClick={() => onOpenChange(true)}
          className="fixed end-4 bottom-4 z-40 flex items-center gap-1.5 rounded-full border bg-fd-card px-3 py-1.5 text-sm text-fd-card-foreground shadow-md hover:bg-fd-accent"
        >
          <MessageIcon />
          评论{openThreads.length > 0 ? ` ${openThreads.length}` : ''}
        </button>
      )}
      {open && (
        <aside data-comment-ui="" aria-label="本页评论" className="fixed inset-y-0 end-0 z-40 flex w-(--docsite-comments-sidebar-width) max-w-full flex-col border-s bg-fd-background text-fd-foreground shadow-xl xl:shadow-none">
          <div className="flex items-center gap-1 border-b p-2 text-sm">
            {!detail && <span className="flex items-center gap-1.5 px-2 font-medium"><MessageIcon />评论</span>}
            {detail ? (
              <button type="button" onClick={() => onDetailChange(undefined)} className="rounded-md px-2 py-1 text-fd-muted-foreground hover:bg-fd-accent">
                ← 全部评论
              </button>
            ) : (
              (['open', 'resolved'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-md px-2 py-1 ${tab === value ? 'bg-fd-accent font-medium text-fd-accent-foreground' : 'text-fd-muted-foreground hover:bg-fd-accent'}`}>
                  {value === 'open' ? `未解决 ${openThreads.length}` : `已解决 ${resolvedThreads.length}`}
                </button>
              ))
            )}
            <button type="button" aria-label="关上" onClick={() => onOpenChange(false)} className="ms-auto rounded-md px-2 py-1 text-fd-muted-foreground hover:bg-fd-accent">
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto p-2">
            {detail ? (
              <div className="p-1">
                <ThreadView key={detail.id} thread={detail} renderBody={renderBody} commenter={commenter} api={api} note={noteOf(detail)} />
              </div>
            ) : (
              <>
                {commenter &&
                  tab === 'open' &&
                  (writingPageComment ? (
                    <div className="rounded-lg border p-2">
                      <p className="mb-1.5 text-xs text-fd-muted-foreground">评论整页</p>
                      <CommentEditor
                        placeholder="写评论…"
                        submitLabel="评论"
                        autoFocus
                        onCancel={() => setWritingPageComment(false)}
                        onSubmit={async (body, images) => {
                          await onCreatePageComment(body, images)
                          setWritingPageComment(false)
                        }}
                      />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setWritingPageComment(true)} className="rounded-lg border border-dashed px-2 py-1.5 text-start text-sm text-fd-muted-foreground hover:bg-fd-accent">
                      ＋ 评论整页
                    </button>
                  ))}
                {shown.length === 0 && <p className="px-2 py-6 text-center text-sm text-fd-muted-foreground">{tab === 'open' ? '这一页没有未解决的评论' : '这一页没有已解决的评论'}</p>}
                {/* 列表项不用 <button>：评论正文里可能有链接、组件里的按钮，按钮里不能再套按钮 */}
                {shown.map((thread) => (
                  <div
                    key={thread.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => choose(thread)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        choose(thread)
                      }
                    }}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg px-2 py-2 text-start hover:bg-fd-accent"
                  >
                    <span className={`line-clamp-1 text-xs ${placement.missing.has(thread.id) ? 'text-red-500' : 'text-fd-muted-foreground'}`}>{noteOf(thread)}</span>
                    <CommentItem entry={thread.head} thread={thread.id} renderBody={renderBody} commenter={commenter} api={api} clamped />
                    {thread.replies.length > 0 && <span className="ms-8 text-xs text-fd-muted-foreground">{thread.replies.length} 条回复</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
      )}
    </>
  )
}

/**
 * 侧栏底部那一栏左边显示当前写评论的人、右边照旧是主题切换：传给 DocsLayout 的 slots.themeSwitch。
 * 发布站（commenter 为 null）只有主题切换
 */
export function themeSwitchWithCommenter(commenter: Commenter | null) {
  return function ThemeSwitchWithCommenter(props: ComponentProps<typeof ThemeSwitch>) {
    return (
      <>
        {commenter && <CommenterChip commenter={commenter} />}
        <ThemeSwitch {...props} />
      </>
    )
  }
}
