import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Person } from '@godcreator/docsite-identity'
import { type CommentElementKind, type CommentEntry, type Commenter, type CommentRange, type CommentThread } from '../comments.js'
import { createRangeMapper } from '../comment-ranges.js'
import { commentScopeAttribute } from '../page-text-rules.js'
import { linkedCommentParam } from '../comment-links.js'
import {
  anchorLabelOf,
  commentUiAttribute,
  elementKindOf,
  elementLabelOf,
  elementOffsetsOf,
  offsetsOfRange,
  openerLabelOf,
  openerRangesOf,
  pageTextOf,
  pickedElementOf,
  placeOfThread,
  type ThreadPlace,
} from '../browser/comment-anchors.js'
import { CommentEditor, CommentItem, PeopleContext, postComment, recentThreadToOpen, rememberThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'

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

/** 新评论串批的位置，连同发起那一刻的整页文字（存成快照）与外面几层收起内容的打开按钮；批整页时是 {} */
type NewAnchor =
  | ({ quote: string; range: CommentRange; snapshot: string } | { element: CommentElementKind; range: CommentRange; snapshot: string }) & { openers?: CommentRange[] }
  | Record<string, never>

/** 正文上评论的几样东西在评论层里的位置（相对评论层左上角） */
type Placement = {
  /** 显示在正文上的评论串（没解决的，加上正打开的那串）：卡片弹出的位置 */
  anchored: Map<string, { cardTop: number; cardLeft: number }>
  /** 共用一个评论数按钮的几串，按带按钮的那串（排在最前）：批同一个元素的几串共用一个，批文字的一串一个 */
  groups: Map<string, string[]>
  /** 评论数按钮插进了原文末尾的那几组（带按钮的那串）：批文字的、批文字类元素的、批行内元素（如行内公式）的 */
  inline: string[]
  /** 批块级元素（图片、代码块、表格、组件）的那几组：评论数按钮在元素右上角，right 是按钮右边缘 */
  cornerBadges: Map<string, { top: number; right: number }>
  /** 原文找不到了的评论串 */
  missing: Set<string>
  /** 被批的内容收着、看不见的评论串：现在要点的打开按钮和它上面的字；认不出按钮时都没有 */
  collapsed: Map<string, { opener: HTMLElement; label: string } | undefined>
  /** 找得到位置、但被批的那段在发起评论之后改过的评论串 */
  changed: Set<string>
}

const emptyPlacement: Placement = { anchored: new Map(), groups: new Map(), inline: [], cornerBadges: new Map(), missing: new Set(), collapsed: new Map(), changed: new Set() }

/** 点开一层收起内容后等它露出来的最长时间：过了还没露出来就不再点 */
const revealTimeoutMs = 5000

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
  /** 站点人员列表（服务端读出来）：评论里的 author、resolvedBy 按它显示名字 */
  people: readonly Person[]
  /** 渲染一条评论的正文；项目在这里把 MDX 组件传给编译好的正文 */
  renderBody: (entry: Entry) => ReactNode
  /** 评论接口的地址，默认 /api/comments */
  apiUrl?: string
  /** 一次写入真正成功后调（create/reply/edit/delete/resolve/reopen 都算）：宿主在这里重新读取数据并刷新页面；失败的请求不调 */
  onWritten?: (written: { thread: string; file: string }) => void
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
  if (a.anchored.size !== b.anchored.size || a.cornerBadges.size !== b.cornerBadges.size || a.missing.size !== b.missing.size || a.collapsed.size !== b.collapsed.size || a.changed.size !== b.changed.size) return false
  if (a.inline.join() !== b.inline.join() || a.groups.size !== b.groups.size) return false
  for (const [leader, ids] of a.groups) if (b.groups.get(leader)?.join() !== ids.join()) return false
  for (const [id, spot] of a.anchored) {
    const other = b.anchored.get(id)
    if (!other || other.cardTop !== spot.cardTop || other.cardLeft !== spot.cardLeft) return false
  }
  for (const [id, spot] of a.cornerBadges) {
    const other = b.cornerBadges.get(id)
    if (!other || other.top !== spot.top || other.right !== spot.right) return false
  }
  for (const id of a.missing) if (!b.missing.has(id)) return false
  for (const [id, spot] of a.collapsed) {
    if (!b.collapsed.has(id) || b.collapsed.get(id)?.opener !== spot?.opener || b.collapsed.get(id)?.label !== spot?.label) return false
  }
  for (const id of a.changed) if (!b.changed.has(id)) return false
  return true
}

const badgeClassName = 'inline-flex select-none items-center gap-0.5 rounded-full border border-[var(--docsite-comments-border)] px-1.5 align-middle text-xs leading-5 font-normal not-italic transition-colors'

function CountBadge({ count, active, label, onClick, className = '' }: { count: number; active: boolean; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-comment-ui=""
      aria-label={`打开评论：${label}`}
      onClick={onClick}
      className={`${badgeClassName} ${active ? 'border-[var(--docsite-comments-primary)] bg-[var(--docsite-comments-primary)] text-[var(--docsite-comments-primary-foreground)]' : 'bg-[var(--docsite-comments-card)] text-[var(--docsite-comments-muted-foreground)] hover:text-[var(--docsite-comments-foreground)]'} ${className}`}
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
 * 能写评论时（开发服务里），右下角「批注」打开批注模式：鼠标下的元素画虚线框，点一下批这个元素；选中文字浮出「评论」按钮，批这段文字。
 * 右下角的「评论」按钮打开右侧栏，列出这一页全部评论，分未解决、已解决，也能评论整页
 */
export function PageComments<Entry extends CommentEntry>({ people, ...props }: PageCommentsProps<Entry>) {
  return (
    <PeopleContext value={people}>
      <CommentLayer {...props} />
    </PeopleContext>
  )
}

function CommentLayer<Entry extends CommentEntry>({ page, threads, snapshots, commenter, renderBody, apiUrl = '/api/comments', onWritten, children }: Omit<PageCommentsProps<Entry>, 'people'>) {
  const api: CommentApi = { url: apiUrl, onWritten }
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

  // 写评论成功后宿主刷新页面，刷新后重新打开刚才那串
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
    // 正文的字变了、内容开合了也要重新找：切换标签页、展开折叠块时正文的高度不一定变。评论数按钮里的变化不算
    const isCommentUiMutation = (record: MutationRecord) => (record.target instanceof Element ? record.target : record.target.parentElement)?.closest(`[${commentUiAttribute}]`) != null
    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => !isCommentUiMutation(record))) measureNextFrame()
    })
    const measure = () => {
      // 找位置时自己会撤、插评论数按钮，切开、拼回文字节点：这期间不看正文的变化，免得自己触发自己
      mutationObserver.disconnect()
      measureWithoutObserving()
      // 折叠块开合时内容一直在页面里，只改这几个属性
      mutationObserver.observe(scope, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open', 'aria-expanded', 'aria-selected'] })
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
        // 同一个元素上可能有几串：其中一串打开着就算打开
        else if (place.type === 'element') place.element.setAttribute(commentedElementAttribute, thread.id === openId || place.element.getAttribute(commentedElementAttribute) === 'active' ? 'active' : '')
      }
      const activeThread = openId === undefined ? undefined : threads.find((thread) => thread.id === openId)
      paintHighlights(openRanges, activeThread && highlightedRangeOf(placeOf.get(activeThread.id)!, activeThread.head.element))

      const missing = new Set(threads.filter((thread) => placeOf.get(thread.id)!.type === 'missing').map((thread) => thread.id))
      const collapsed: Placement['collapsed'] = new Map()
      for (const thread of threads) {
        const place = placeOf.get(thread.id)!
        if (place.type === 'collapsed') collapsed.set(thread.id, place.opener && { opener: place.opener, label: openerLabelOf(place.opener) })
      }
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
      const groups = new Map<string, string[]>()
      const leaderOfElement = new Map<Element, string>()
      const inline: string[] = []
      const cornerThreads: string[] = []
      for (const thread of shown) {
        const place = placeOf.get(thread.id) as Extract<ThreadPlace, { range: Range }>
        const leader = place.type === 'element' ? leaderOfElement.get(place.element) : undefined
        if (leader !== undefined) {
          groups.get(leader)!.push(thread.id)
          continue
        }
        if (place.type === 'element') leaderOfElement.set(place.element, thread.id)
        groups.set(thread.id, [thread.id])
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
      const next: Placement = { anchored, groups, inline, cornerBadges, missing, collapsed, changed }
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

  // 批注模式里选中正文里的文字：松开鼠标时在选区上方浮出「评论」按钮。平时选文字是为了复制，不弹按钮
  useEffect(() => {
    if (!writable || !picking) return
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
      const openers = openerRangesOf(scope, pageText, range.commonAncestorContainer)
      const anchor: NewAnchor = { quote: pageText.text.slice(...offsets), range: offsets, snapshot: pageText.text, ...(openers && { openers }) }
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
      setSelectionAction(undefined)
    }
  }, [writable, picking])

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
      const openers = openerRangesOf(scope, pageText, element)
      startDraft({ anchor: { element: elementKindOf(element), range, snapshot: pageText.text, ...(openers && { openers }) }, cardTop: box.top + box.height + 8, cardLeft: clampCardLeft(box.left, layer.getBoundingClientRect().width) })
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

  /** 滚到正文里的原文、弹出这串的卡片 */
  const goToThread = (id: string) => {
    // 窄屏时右侧栏盖住正文，先关上才看得到正文里弹出的卡片
    if (!window.matchMedia('(width >= 80rem)').matches) setPanelOpen(false)
    setOpenId(id)
    const spot = placement.anchored.get(id)
    if (spot) window.scrollTo({ top: layerRef.current!.getBoundingClientRect().top + window.scrollY + spot.cardTop - window.innerHeight / 3, behavior: 'smooth' })
  }

  /** 正在点开收起内容的那串、已经点过的按钮（同一个按钮点过一次还收着，就不再点），和等这一层露出来的计时器 */
  const revealingRef = useRef<{ id: string; clicked: Set<Element>; timer: ReturnType<typeof setTimeout> }>(undefined)
  /** 点开一层，等正文变了重新找位置；一层点了 revealTimeoutMs 还没露出东西就放弃 */
  const clickOpener = (id: string, opener: HTMLElement, clicked: Set<Element>) => {
    clearTimeout(revealingRef.current?.timer)
    clicked.add(opener)
    const timer = setTimeout(() => {
      revealingRef.current = undefined
      setHint('点开了收起的内容，还是找不到被批的地方')
    }, revealTimeoutMs)
    revealingRef.current = { id, clicked, timer }
    opener.click()
  }
  /** 被批的内容收着：点开现在收着的那一层；露出来以后正文变了会重新找位置，再由下面的 effect 点下一层，直到找到 */
  const revealThread = (id: string, opener: HTMLElement) => clickOpener(id, opener, new Set())
  useEffect(() => {
    const revealing = revealingRef.current
    if (!revealing) return
    if (placement.anchored.has(revealing.id)) {
      clearTimeout(revealing.timer)
      revealingRef.current = undefined
      goToThread(revealing.id)
      return
    }
    const opener = placement.collapsed.get(revealing.id)?.opener
    if (opener && !revealing.clicked.has(opener)) clickOpener(revealing.id, opener, revealing.clicked)
  }, [placement])

  // 从全部评论页点过来：地址带着 ?comment=<评论串>。批整页的直接在右侧栏打开；批了地方的等找好位置，在原文处打开或先点开收起的内容
  const linkedThreadRef = useRef<string>(undefined)
  useEffect(() => {
    linkedThreadRef.current = new URLSearchParams(window.location.search).get(linkedCommentParam) ?? undefined
  }, [])
  useEffect(() => {
    const linked = threads.find((thread) => thread.id === linkedThreadRef.current)
    if (!linked) return
    const placed = placement.anchored.has(linked.id) || placement.collapsed.has(linked.id) || placement.missing.has(linked.id)
    // 未解决、批了地方的要等找好位置（第一次找之前 placement 是空的）
    if (linked.head.status === 'open' && linked.head.range && !placed) return
    linkedThreadRef.current = undefined
    const opener = placement.collapsed.get(linked.id)?.opener
    if (linked.head.status === 'open' && placement.anchored.has(linked.id)) goToThread(linked.id)
    else if (linked.head.status === 'open' && opener) revealThread(linked.id, opener)
    else {
      setPanelOpen(true)
      setPanelThreadId(linked.id)
    }
  }, [placement, threads])

  const threadOf = (id: string) => threads.find((thread) => thread.id === id)!
  /** 打开的那串所在的组：同一个元素上的几串在一张卡片里依次列出 */
  const openGroup = openId === undefined ? [] : ([...placement.groups.values()].find((ids) => ids.includes(openId)) ?? [openId]).map(threadOf)
  const openSpot = openId === undefined ? undefined : placement.anchored.get(openId)
  /** 一组共用的评论数按钮：数字是这几串的评论总数，点它打开或关上这一组 */
  const groupBadge = (leader: string, className?: string) => {
    const ids = placement.groups.get(leader)!
    const isOpen = openId !== undefined && ids.includes(openId)
    const count = ids.reduce((total, id) => total + 1 + threadOf(id).replies.length, 0)
    return <CountBadge count={count} active={isOpen} label={labelOf(threadOf(leader))} onClick={() => setOpenId(isOpen ? undefined : leader)} className={className} />
  }

  return (
    <div ref={layerRef} className="relative">
      {children}
      {placement.inline.map((leader) => createPortal(groupBadge(leader), inlineHostOf(leader), leader))}
      {[...placement.cornerBadges].map(([leader, badge]) => (
        <span key={leader} data-comment-ui="" className="absolute z-10 -translate-x-full" style={{ top: badge.top, left: badge.right }}>
          {groupBadge(leader, 'shadow-sm')}
        </span>
      ))}
      {picking && hovered && !draft && (
        <div data-comment-ui="" className="pointer-events-none absolute z-20 rounded-sm outline-2 outline-offset-2 outline-amber-500 outline-dashed" style={hovered.box}>
          <span className="absolute -top-1 left-0 -translate-y-full rounded bg-amber-500 px-1.5 text-xs leading-5 whitespace-nowrap text-white">{hovered.label}</span>
        </div>
      )}
      {hint && (
        <p data-comment-ui="" role="status" className="fixed bottom-16 end-4 z-50 max-w-80 rounded-lg border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] px-3 py-2 text-sm text-[var(--docsite-comments-card-foreground)] shadow-md">
          {hint}
        </p>
      )}
      {selectionAction && !draft && (
        <button
          type="button"
          data-comment-ui=""
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => startDraft(selectionAction)}
          className="absolute z-30 flex items-center gap-1 rounded-lg border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] px-2 py-1 text-xs text-[var(--docsite-comments-card-foreground)] shadow-md hover:bg-[var(--docsite-comments-accent)]"
          style={{ top: selectionAction.top, left: selectionAction.cardLeft }}
        >
          <MessageIcon />
          评论
        </button>
      )}
      {draft && commenter && (
        <div data-comment-ui="" className="absolute z-30 flex flex-col gap-2 rounded-xl border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] p-3 text-[var(--docsite-comments-card-foreground)] shadow-lg" style={{ top: draft.cardTop, left: draft.cardLeft, width: cardWidth }}>
          <p className="line-clamp-2 border-s-2 border-s-[color:var(--docsite-comments-border)] ps-2 text-xs text-[var(--docsite-comments-muted-foreground)]">{draft.label}</p>
          <CommentEditor placeholder="写评论…" submitLabel="评论" autoFocus onCancel={() => setDraft(undefined)} onSubmit={(body, images) => createThread(draft.anchor, body, images)} />
        </div>
      )}
      {openGroup.length > 0 && openSpot && (
        <div
          data-comment-ui=""
          className="absolute z-30 flex max-h-[60vh] flex-col divide-y divide-[var(--docsite-comments-border)] overflow-y-auto rounded-xl border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] text-[var(--docsite-comments-card-foreground)] shadow-lg"
          style={{ top: openSpot.cardTop, left: openSpot.cardLeft, width: cardWidth }}
        >
          {openGroup.map((thread, index) => (
            <div key={thread.id} className="p-3">
              <ThreadView
                thread={thread}
                renderBody={renderBody}
                commenter={commenter}
                api={api}
                note={placement.changed.has(thread.id) ? `原文改过，当时批的是${labelOf(thread)}` : undefined}
                onClose={index === 0 ? () => setOpenId(undefined) : undefined}
              />
            </div>
          ))}
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
          onGoToThread={goToThread}
          onRevealThread={revealThread}
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
  /** 被批的内容收着的评论串：点开它（opener 是现在要点的按钮），露出来以后滚过去 */
  onRevealThread: (id: string, opener: HTMLElement) => void
  /** 删除成功后由上层把那条从界面上拿掉（threadId 与文件名） */
}

/** 右侧栏打开时 <html> 上的属性：站点样式据此（如在宽屏上）给页面布局让出右侧栏的宽度 */
const commentsSidebarOpenAttribute = 'data-comments-sidebar-open'

/** 右下角的「评论」按钮和它打开的右侧栏；宽度用 styles.css 里 --docsite-comments-sidebar-width 的值 */
function CommentsPanel<Entry extends CommentEntry>(props: CommentsPanelProps<Entry>) {
  const { threads, labelOf, picking, onPickingChange, placement, commenter, renderBody, api, open, onOpenChange, detailId, onDetailChange, onCreatePageComment, onGoToThread, onRevealThread } = props
  const pickingToggle = (className: string) =>
    commenter && (
      <button
        type="button"
        data-comment-ui=""
        aria-pressed={picking}
        title="批注模式：点正文里的一个元素批它，选中几个字批这几个字；Esc 退出"
        onClick={() => onPickingChange(!picking)}
        className={`${className} flex items-center gap-1.5 border ${picking ? 'border-amber-500 bg-amber-500 text-white' : 'bg-[var(--docsite-comments-card)] text-[var(--docsite-comments-card-foreground)] hover:bg-[var(--docsite-comments-accent)]'}`}
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
    if (placement.collapsed.has(thread.id)) {
      const label = placement.collapsed.get(thread.id)?.label
      return label === undefined ? `在页面上看不见：${labelOf(thread)}` : `在收起的「${label}」里：${labelOf(thread)}`
    }
    if (placement.changed.has(thread.id)) return `原文改过：${labelOf(thread)}`
    return labelOf(thread)
  }
  const noteColorOf = (id: string) => {
    if (placement.missing.has(id)) return 'text-red-500'
    if (placement.collapsed.has(id)) return 'text-sky-600'
    if (placement.changed.has(id)) return 'text-amber-600'
    return 'text-[var(--docsite-comments-muted-foreground)]'
  }
  const choose = (thread: CommentThread<Entry>) => {
    const opener = placement.collapsed.get(thread.id)?.opener
    if (thread.head.status === 'open' && placement.anchored.has(thread.id)) onGoToThread(thread.id)
    else if (thread.head.status === 'open' && opener) onRevealThread(thread.id, opener)
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
            className="flex items-center gap-1.5 rounded-full border border-[var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] px-3 py-1.5 text-sm text-[var(--docsite-comments-card-foreground)] shadow-md hover:bg-[var(--docsite-comments-accent)]"
          >
            <MessageIcon />
            评论{openThreads.length > 0 ? ` ${openThreads.length}` : ''}
          </button>
        </div>
      )}
      {open && (
        <aside data-comment-ui="" aria-label="本页评论" className="fixed inset-y-0 end-0 z-40 flex w-(--docsite-comments-sidebar-width) max-w-full flex-col border-s border-s-[color:var(--docsite-comments-border)] bg-[var(--docsite-comments-card)] text-sm text-[var(--docsite-comments-card-foreground)] shadow-xl xl:shadow-none">
          <div className="flex h-[30px] box-content items-center gap-1 px-4 pt-4 pb-2">
            {!detail && <span className="flex items-center gap-1.5 px-2 font-medium"><MessageIcon />评论</span>}
            {detail ? (
              <button type="button" onClick={() => onDetailChange(undefined)} className="rounded-md px-2 py-1 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]">
                ← 全部评论
              </button>
            ) : (
              (['open', 'resolved'] as const).map((value) => (
                <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-md px-2 py-1 ${tab === value ? 'bg-[var(--docsite-comments-accent)] font-medium text-[var(--docsite-comments-accent-foreground)]' : 'text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]'}`}>
                  {value === 'open' ? `未解决 ${openThreads.length}` : `已解决 ${resolvedThreads.length}`}
                </button>
              ))
            )}
            <button type="button" aria-label="关上" onClick={() => onOpenChange(false)} className="ms-auto rounded-md px-2 py-1 text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]">
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
                    <div className="rounded-lg border border-[var(--docsite-comments-border)] p-2">
                      <p className="mb-1.5 text-xs text-[var(--docsite-comments-muted-foreground)]">评论整页</p>
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
                      <button type="button" onClick={() => setWritingPageComment(true)} className="flex-1 rounded-lg border border-dashed border-[var(--docsite-comments-border)] px-2 py-1.5 text-start text-sm text-[var(--docsite-comments-muted-foreground)] hover:bg-[var(--docsite-comments-accent)]">
                        ＋ 评论整页
                      </button>
                      {pickingToggle('rounded-lg px-2 py-1.5 text-sm')}
                    </div>
                  ))}
                {shown.length === 0 && <p className="px-2 py-6 text-center text-sm text-[var(--docsite-comments-muted-foreground)]">{tab === 'open' ? '这一页没有未解决的评论' : '这一页没有已解决的评论'}</p>}
                {/* 列表项不用 <button>：评论正文里可能有链接、组件里的按钮，按钮里不能再套按钮；点了正文里自己的链接或按钮时不当作选这一条 */}
                {shown.map((thread) => (
                  <div
                    key={thread.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      if (event.target instanceof Element && event.target.closest('a, button')) return
                      choose(thread)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        choose(thread)
                      }
                    }}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg px-2 py-2 text-start hover:bg-[var(--docsite-comments-accent)]"
                  >
                    <span className={`line-clamp-1 text-xs ${noteColorOf(thread.id)}`}>{noteOf(thread)}</span>
                    <CommentItem entry={thread.head} thread={thread.id} renderBody={renderBody} commenter={commenter} api={api} clamped />
                    {thread.replies.length > 0 && <span className="ms-8 text-xs text-[var(--docsite-comments-muted-foreground)]">{thread.replies.length} 条回复</span>}
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
