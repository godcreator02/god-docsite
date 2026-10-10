import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ThemeSwitch } from '@fumadocs/base-ui/layouts/shared/slots/theme-switch'
import type { CommentElementKind, CommentEntry, Commenter, CommentRange, CommentThread } from '../comments.js'
import { createRangeMapper } from '../comment-ranges.js'
import { commentScopeAttribute } from '../page-text-rules.js'
import { anchorLabelOf, commentUiAttribute, elementKindOf, elementLabelOf, elementOffsetsOf, offsetsOfRange, pageTextOf, pickedElementOf, placeOfThread, type ThreadPlace } from './comment-anchors.js'
import { CommentEditor, CommenterChip, CommentItem, postComment, recentThreadToOpen, rememberThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'

/** 页面正文的容器带上这个属性，评论在它里面找被批的原文：<DocsBody {...commentScopeProps}> */
export { commentScopeAttribute }
export const commentScopeProps = { [commentScopeAttribute]: '' }

/** 原文高亮用 CSS Custom Highlight API，不改正文的 DOM；颜色在 styles.css 的 ::highlight() 里 */
const quoteHighlight = 'docsite-comment'
const activeQuoteHighlight = 'docsite-comment-active'
/** 批的元素（文字类以外的：图片、公式、代码块、表格、组件）加这个属性，styles.css 给它画框 */
const commentedElementAttribute = 'data-commented-element'
/** 批注模式打开时 <html> 上的属性：styles.css 据此把鼠标换成十字 */
const pickingAttribute = 'data-comment-picking'

const cardWidth = 360

/** 新评论串批的位置，连同发起那一刻的整页文字（存成快照）；批整页时是 {} */
type NewAnchor = { quote: string; range: CommentRange; snapshot: string } | { element: CommentElementKind; range: CommentRange; snapshot: string } | Record<string, never>

/** 正文上评论的几样东西在评论层里的位置（相对评论层左上角） */
type Placement = {
  /** 显示在正文上的评论串（没解决的，加上正打开的那串）：卡片弹出的位置 */
  anchored: Map<string, { cardTop: number; cardLeft: number }>
  /** 评论数按钮插进了原文末尾的评论串：批文字的、批文字类元素的、批行内元素（如行内公式）的 */
  inline: string[]
  /** 批块级元素（图片、代码块、表格、组件）的评论串：评论数按钮在元素右上角，right 是按钮右边缘 */
  cornerBadges: Map<string, { top: number; right: number }>
  /** 原文找不到了的评论串 */
  missing: Set<string>
  /** 找得到位置、但被批的那段在发起评论之后改过的评论串 */
  changed: Set<string>
}

const emptyPlacement: Placement = { anchored: new Map(), inline: [], cornerBadges: new Map(), missing: new Set(), changed: new Set() }

/** 选中文字后浮出的「评论」按钮（top）与草稿卡片（cardTop、cardLeft）的位置 */
type PendingAction = { top: number; anchor: NewAnchor; cardTop: number; cardLeft: number }

type Draft = Omit<PendingAction, 'top'> & { label: string }

function labelOfNewAnchor(anchor: NewAnchor) {
  return 'range' in anchor ? anchorLabelOf(anchor, anchor.snapshot) : anchorLabelOf({}, undefined)
}

type Box = { top: number; left: number; width: number; height: number }

function boxOf(element: Element, layer: Element): Box {
  const rect = element.getBoundingClientRect()
  const base = layer.getBoundingClientRect()
  return { top: rect.top - base.top, left: rect.left - base.left, width: rect.width, height: rect.height }
}

function isInlineElement(element: Element) {
  return getComputedStyle(element).display.startsWith('inline')
}

/** 正文上标黄的评论串：批文字的，和批文字类元素（段落、列表项、单元格、加粗等）的 */
function highlightedRangeOf(place: ThreadPlace, kind: CommentElementKind | undefined) {
  return place.type === 'text' || (place.type === 'element' && kind === 'text') ? place.range : undefined
}

/** 插进正文的评论数按钮的外壳；插的时候要是切开了文字节点，记下切开的两半，撤掉时拼回去 */
type InsertedBadge = { host: HTMLElement; split?: { first: Text; second: Text } }

function insertAtRangeEnd(host: HTMLElement, range: Range): InsertedBadge {
  const { endContainer, endOffset } = range
  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = endContainer as Text
    if (endOffset < text.length) {
      const second = text.splitText(endOffset)
      text.after(host)
      return { host, split: { first: text, second } }
    }
    text.after(host)
    return { host }
  }
  endContainer.insertBefore(host, endContainer.childNodes[endOffset] ?? null)
  return { host }
}

/**
 * 撤掉插进正文的按钮，切开的文字节点原样拼回去：拼回到原来那个节点（React 记着的就是它），后插的先撤
 */
function removeInsertedBadges(inserted: InsertedBadge[]) {
  for (const { host, split } of inserted.reverse()) {
    host.remove()
    if (split && split.second.parentNode) {
      split.first.data += split.second.data
      split.second.remove()
    }
  }
  inserted.length = 0
}

export type PageCommentsProps<Entry extends CommentEntry> = {
  /** 这一页的地址 */
  page: string
  /** 这一页的评论串 */
  threads: ReadonlyArray<CommentThread<Entry>>
  /** 各评论串发起时的整页文字快照，按评论串文件夹名；服务端用 commentSnapshotsOf 读出来。批整页的评论串没有 */
  snapshots: Readonly<Record<string, string>>
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
  if (place.type === 'text') return place.range.getBoundingClientRect()
  if (place.type === 'element') return place.element.getBoundingClientRect()
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
  if (a.anchored.size !== b.anchored.size || a.cornerBadges.size !== b.cornerBadges.size || a.missing.size !== b.missing.size || a.changed.size !== b.changed.size) return false
  if (a.inline.join() !== b.inline.join()) return false
  for (const [id, spot] of a.anchored) {
    const other = b.anchored.get(id)
    if (!other || other.cardTop !== spot.cardTop || other.cardLeft !== spot.cardLeft) return false
  }
  for (const [id, spot] of a.cornerBadges) {
    const other = b.cornerBadges.get(id)
    if (!other || other.top !== spot.top || other.right !== spot.right) return false
  }
  for (const id of a.missing) if (!b.missing.has(id)) return false
  for (const id of a.changed) if (!b.changed.has(id)) return false
  return true
}

const badgeClassName = 'inline-flex select-none items-center gap-0.5 rounded-full border px-1.5 align-middle text-xs leading-5 font-normal not-italic transition-colors'

function CountBadge({ count, active, label, onClick, className = '' }: { count: number; active: boolean; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-comment-ui=""
      aria-label={`打开评论：${label}`}
      onClick={onClick}
      className={`${badgeClassName} ${active ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground' : 'bg-fd-card text-fd-muted-foreground hover:text-fd-foreground'} ${className}`}
    >
      <MessageIcon />
      {count}
    </button>
  )
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

/**
 * 页面上的评论（照 Notion）：被批的文字标黄，原文末尾插着评论数按钮；被批的图片、公式、代码块、表格、组件画框，评论数按钮在它右上角
 * （行内的如行内公式插在它后面）。点按钮或点标黄的文字弹出这串评论。
 * 能写评论时（开发服务里），选中正文里的文字浮出「评论」按钮；右下角「批注」打开批注模式，鼠标下的元素画虚线框，点一下批这个元素。
 * 右下角的「评论」按钮打开右侧栏，列出这一页全部评论，分未解决、已解决，也能评论整页
 */
export function PageComments<Entry extends CommentEntry>({ page, threads, snapshots, commenter, renderBody, apiUrl = '/api/comments', children }: PageCommentsProps<Entry>) {
  const api: CommentApi = { url: apiUrl }
  const layerRef = useRef<HTMLDivElement>(null)
  const [mapRange] = useState(createRangeMapper)
  const labelOf = (thread: CommentThread<Entry>) => anchorLabelOf(thread.head, snapshots[thread.id])
  /** 插进正文的评论数按钮的外壳，每串一个、一直用同一个元素，React 经 portal 往里渲染按钮 */
  const inlineHostsRef = useRef(new Map<string, HTMLElement>())
  const [openId, setOpenId] = useState<string>()
  const [placement, setPlacement] = useState<Placement>(emptyPlacement)
  const [selectionAction, setSelectionAction] = useState<PendingAction>()
  const [picking, setPicking] = useState(false)
  const [hovered, setHovered] = useState<{ box: Box; label: string }>()
  const [hint, setHint] = useState<string>()
  const [draft, setDraft] = useState<Draft>()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelThreadId, setPanelThreadId] = useState<string>()
  const writable = commenter !== null
  const hasCommentUi = writable || threads.length > 0

  const inlineHostOf = (id: string) => {
    let host = inlineHostsRef.current.get(id)
    if (!host) {
      host = document.createElement('span')
      host.setAttribute(commentUiAttribute, '')
      host.contentEditable = 'false'
      host.className = 'ms-1'
      inlineHostsRef.current.set(id, host)
    }
    return host
  }

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
    const inserted: InsertedBadge[] = []
    let frame = 0
    // 正文的字变了也要重新找：切换标签页、展开折叠块时正文的高度不一定变。评论数按钮里的变化不算
    const isCommentUiMutation = (record: MutationRecord) => (record.target instanceof Element ? record.target : record.target.parentElement)?.closest(`[${commentUiAttribute}]`) != null
    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => !isCommentUiMutation(record))) measureNextFrame()
    })
    const measure = () => {
      // 找位置时自己会撤、插评论数按钮，切开、拼回文字节点：这期间不看正文的变化，免得自己触发自己
      mutationObserver.disconnect()
      measureWithoutObserving()
      mutationObserver.observe(scope, { childList: true, subtree: true, characterData: true })
    }
    const measureWithoutObserving = () => {
      // 先撤掉上次插的按钮，在原样的正文上找原文，再插回去
      removeInsertedBadges(inserted)
      for (const element of scope.querySelectorAll(`[${commentedElementAttribute}]`)) element.removeAttribute(commentedElementAttribute)
      const pageText = pageTextOf(scope)
      placeOf.clear()
      for (const thread of threads) placeOf.set(thread.id, placeOfThread(scope, pageText, thread.head, snapshots[thread.id], mapRange))
      const openRanges: Range[] = []
      for (const thread of threads) {
        const place = placeOf.get(thread.id)!
        if (thread.head.status !== 'open') continue
        const highlighted = highlightedRangeOf(place, thread.head.element)
        if (highlighted) openRanges.push(highlighted)
        else if (place.type === 'element') place.element.setAttribute(commentedElementAttribute, thread.id === openId ? 'active' : '')
      }
      const activeThread = openId === undefined ? undefined : threads.find((thread) => thread.id === openId)
      paintHighlights(openRanges, activeThread && highlightedRangeOf(placeOf.get(activeThread.id)!, activeThread.head.element))

      const missing = new Set(threads.filter((thread) => placeOf.get(thread.id)!.type === 'missing').map((thread) => thread.id))
      const changed = new Set(
        threads
          .filter((thread) => {
            const place = placeOf.get(thread.id)!
            return (place.type === 'text' || place.type === 'element') && place.changed
          })
          .map((thread) => thread.id),
      )
      const shown = threads.filter((thread) => {
        const type = placeOf.get(thread.id)!.type
        return (type === 'text' || type === 'element') && (thread.head.status === 'open' || thread.id === openId)
      })
      const inline: string[] = []
      const cornerThreads: string[] = []
      for (const thread of shown) {
        const place = placeOf.get(thread.id) as Extract<ThreadPlace, { range: Range }>
        if (place.type === 'element' && !highlightedRangeOf(place, thread.head.element) && !isInlineElement(place.element)) {
          cornerThreads.push(thread.id)
          continue
        }
        inserted.push(insertAtRangeEnd(inlineHostOf(thread.id), place.range))
        inline.push(thread.id)
      }

      // 插完按钮再量位置：按钮占了地方，后面的文字可能挪了
      const layerRect = layer.getBoundingClientRect()
      const anchored = new Map<string, { cardTop: number; cardLeft: number }>()
      const cornerBadges = new Map<string, { top: number; right: number }>()
      for (const thread of shown) {
        const rect = rectOfPlace(placeOf.get(thread.id)!)!
        anchored.set(thread.id, { cardTop: rect.bottom - layerRect.top + 8, cardLeft: clampCardLeft(rect.left - layerRect.left, layerRect.width) })
        if (cornerThreads.includes(thread.id)) cornerBadges.set(thread.id, { top: rect.top - layerRect.top + 6, right: rect.right - layerRect.left - 6 })
      }
      const next: Placement = { anchored, inline, cornerBadges, missing, changed }
      setPlacement((current) => (samePlacement(current, next) ? current : next))
    }
    const measureNextFrame = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const openFromQuote = (event: MouseEvent) => {
      if (!document.getSelection()?.isCollapsed || document.documentElement.hasAttribute(pickingAttribute)) return
      for (const thread of threads) {
        const highlighted = highlightedRangeOf(placeOf.get(thread.id)!, thread.head.element)
        if (highlighted && [...highlighted.getClientRects()].some((rect) => containsPoint(rect, event.clientX, event.clientY))) {
          setOpenId(thread.id)
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
      mutationObserver.disconnect()
      scope.removeEventListener('click', openFromQuote)
      window.removeEventListener('resize', measureNextFrame)
      CSS.highlights.delete(quoteHighlight)
      CSS.highlights.delete(activeQuoteHighlight)
      for (const element of scope.querySelectorAll(`[${commentedElementAttribute}]`)) element.removeAttribute(commentedElementAttribute)
      removeInsertedBadges(inserted)
    }
  }, [threads, snapshots, openId])

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
      const pageText = pageTextOf(scope)
      const offsets = offsetsOfRange(pageText, range)
      if (!offsets) return setSelectionAction(undefined)
      const anchor: NewAnchor = { quote: pageText.text.slice(...offsets), range: offsets, snapshot: pageText.text }
      const layerRect = layer.getBoundingClientRect()
      const first = range.getClientRects()[0] ?? range.getBoundingClientRect()
      const whole = range.getBoundingClientRect()
      setSelectionAction({
        top: first.top - layerRect.top - 34,
        anchor,
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

  // 批注模式：鼠标下的元素画虚线框，点一下批这个元素；拖选文字照旧批那段文字；Esc 退出。模式里点链接不跳转、点组件不触发
  useEffect(() => {
    if (!picking) return
    const layer = layerRef.current!
    const scope = scopeOf()
    const pickableAt = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !scope.contains(target) || target.closest(`[${commentUiAttribute}]`)) return undefined
      const element = pickedElementOf(target)
      return element === scope ? undefined : element
    }
    const hover = (event: MouseEvent) => {
      const element = pickableAt(event.target)
      setHovered(element && { box: boxOf(element, layer), label: elementLabelOf(element) })
    }
    const clearHover = () => setHovered(undefined)
    const pick = (event: MouseEvent) => {
      const element = pickableAt(event.target)
      if (!element) return
      event.preventDefault()
      event.stopPropagation()
      // 拖选了文字就是批那段文字，交给选中文字那一路
      if (!document.getSelection()?.isCollapsed) return
      const pageText = pageTextOf(scope)
      const range = elementOffsetsOf(pageText, element)
      if (!range) return setHint('这个元素里没有字，也没有图片：在页面文字里没有位置，可以评论整页')
      const box = boxOf(element, layer)
      startDraft({ anchor: { element: elementKindOf(element), range, snapshot: pageText.text }, cardTop: box.top + box.height + 8, cardLeft: clampCardLeft(box.left, layer.getBoundingClientRect().width) })
    }
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPicking(false)
    }
    document.documentElement.setAttribute(pickingAttribute, '')
    scope.addEventListener('mousemove', hover)
    scope.addEventListener('mouseleave', clearHover)
    scope.addEventListener('click', pick, true)
    document.addEventListener('keydown', exitOnEscape)
    return () => {
      document.documentElement.removeAttribute(pickingAttribute)
      scope.removeEventListener('mousemove', hover)
      scope.removeEventListener('mouseleave', clearHover)
      scope.removeEventListener('click', pick, true)
      document.removeEventListener('keydown', exitOnEscape)
      setHovered(undefined)
    }
  }, [picking])

  useEffect(() => {
    if (hint === undefined) return
    const timer = setTimeout(() => setHint(undefined), 4000)
    return () => clearTimeout(timer)
  }, [hint])

  // 点评论卡片以外的地方关上卡片；写了一半的新评论不因此丢掉，要点「取消」或按 Esc
  useEffect(() => {
    if (openId === undefined) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(`[${commentUiAttribute}]`)) return
      setOpenId(undefined)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [openId])

  const startDraft = ({ anchor, cardTop, cardLeft }: Omit<PendingAction, 'top'>) => {
    setOpenId(undefined)
    setSelectionAction(undefined)
    setDraft({ anchor, cardTop, cardLeft, label: labelOfNewAnchor(anchor) })
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
    <div ref={layerRef} className="relative">
      {children}
      {placement.inline.map((id) => {
        const thread = threads.find((candidate) => candidate.id === id)!
        return createPortal(
          <CountBadge count={1 + thread.replies.length} active={id === openId} label={labelOf(thread)} onClick={() => setOpenId(id === openId ? undefined : id)} />,
          inlineHostOf(id),
          id,
        )
      })}
      {[...placement.cornerBadges].map(([id, badge]) => {
        const thread = threads.find((candidate) => candidate.id === id)!
        return (
          <span key={id} data-comment-ui="" className="absolute z-10 -translate-x-full" style={{ top: badge.top, left: badge.right }}>
            <CountBadge count={1 + thread.replies.length} active={id === openId} label={labelOf(thread)} onClick={() => setOpenId(id === openId ? undefined : id)} className="shadow-sm" />
          </span>
        )
      })}
      {picking && hovered && !draft && (
        <div data-comment-ui="" className="pointer-events-none absolute z-20 rounded-sm outline-2 outline-offset-2 outline-amber-500 outline-dashed" style={hovered.box}>
          <span className="absolute -top-1 left-0 -translate-y-full rounded bg-amber-500 px-1.5 text-xs leading-5 whitespace-nowrap text-white">{hovered.label}</span>
        </div>
      )}
      {hint && (
        <p data-comment-ui="" role="status" className="fixed bottom-16 end-4 z-50 max-w-80 rounded-lg border bg-fd-popover px-3 py-2 text-sm text-fd-popover-foreground shadow-md">
          {hint}
        </p>
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
          <ThreadView
            key={openThread.id}
            thread={openThread}
            renderBody={renderBody}
            commenter={commenter}
            api={api}
            note={placement.changed.has(openThread.id) ? `原文改过，当时批的是${labelOf(openThread)}` : undefined}
            onClose={() => setOpenId(undefined)}
          />
        </div>
      )}
      {hasCommentUi && (
        <CommentsPanel
          threads={threads}
          labelOf={labelOf}
          picking={picking}
          onPickingChange={setPicking}
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
            if (spot) window.scrollTo({ top: layerRef.current!.getBoundingClientRect().top + window.scrollY + spot.cardTop - window.innerHeight / 3, behavior: 'smooth' })
          }}
        />
      )}
    </div>
  )
}

type CommentsPanelProps<Entry extends CommentEntry> = {
  threads: ReadonlyArray<CommentThread<Entry>>
  /** 评论串批的是什么，写给人看 */
  labelOf: (thread: CommentThread<Entry>) => string
  /** 批注模式开着没有；能写评论时右下角与右侧栏里都有开关 */
  picking: boolean
  onPickingChange: (picking: boolean) => void
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
  const { threads, labelOf, picking, onPickingChange, placement, commenter, renderBody, api, open, onOpenChange, detailId, onDetailChange, onCreatePageComment, onGoToThread } = props
  const pickingToggle = (className: string) =>
    commenter && (
      <button
        type="button"
        data-comment-ui=""
        aria-pressed={picking}
        title="批注模式：点正文里的一个元素批它；Esc 退出"
        onClick={() => onPickingChange(!picking)}
        className={`${className} flex items-center gap-1.5 border ${picking ? 'border-amber-500 bg-amber-500 text-white' : 'bg-fd-card text-fd-card-foreground hover:bg-fd-accent'}`}
      >
        {picking ? '批注中 · Esc 退出' : '批注'}
      </button>
    )
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
  const noteOf = (thread: CommentThread<Entry>) => {
    if (placement.missing.has(thread.id)) return `原文找不到了：${labelOf(thread)}`
    if (placement.changed.has(thread.id)) return `原文改过：${labelOf(thread)}`
    return labelOf(thread)
  }
  const choose = (thread: CommentThread<Entry>) => {
    if (thread.head.status === 'open' && placement.anchored.has(thread.id)) onGoToThread(thread.id)
    else onDetailChange(thread.id)
  }
  return (
    <>
      {!open && (
        <div data-comment-ui="" className="fixed end-4 bottom-4 z-40 flex gap-2">
          {pickingToggle('rounded-full px-3 py-1.5 text-sm shadow-md')}
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="flex items-center gap-1.5 rounded-full border bg-fd-card px-3 py-1.5 text-sm text-fd-card-foreground shadow-md hover:bg-fd-accent"
          >
            <MessageIcon />
            评论{openThreads.length > 0 ? ` ${openThreads.length}` : ''}
          </button>
        </div>
      )}
      {open && (
        // 和左侧栏对称：同样的底色与边框，顶上一行与左侧栏的站名那一行同高（p-4 下 30px）
        <aside data-comment-ui="" aria-label="本页评论" className="fixed inset-y-0 end-0 z-40 flex w-(--docsite-side-column-width) max-w-full flex-col border-s bg-fd-card text-sm text-fd-card-foreground shadow-xl xl:shadow-none">
          <div className="flex h-[30px] box-content items-center gap-1 px-4 pt-4 pb-2">
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
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setWritingPageComment(true)} className="flex-1 rounded-lg border border-dashed px-2 py-1.5 text-start text-sm text-fd-muted-foreground hover:bg-fd-accent">
                        ＋ 评论整页
                      </button>
                      {pickingToggle('rounded-lg px-2 py-1.5 text-sm')}
                    </div>
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
                    <span className={`line-clamp-1 text-xs ${placement.missing.has(thread.id) ? 'text-red-500' : placement.changed.has(thread.id) ? 'text-amber-600' : 'text-fd-muted-foreground'}`}>{noteOf(thread)}</span>
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
