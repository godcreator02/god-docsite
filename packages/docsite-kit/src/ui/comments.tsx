import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ThemeSwitch } from '@fumadocs/base-ui/layouts/shared/slots/theme-switch'
import { commentAnchorAttribute, commentBlockAttribute, commentBlockWrapperClass, type CommentEntry, type Commenter, type CommentThread } from '../comments.js'
import { anchoredBlocksOf, blockContaining, boxElementOf, commentUiAttribute, placeOfThread, quoteInBlock, targetLabelOf, type CommentableBlock, type ThreadPlace } from './comment-anchors.js'
import { CommentEditor, CommenterChip, CommentItem, postComment, recentThreadToOpen, rememberThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'

/** 页面正文的容器带上这个属性，评论在它里面找被批的块：<DocsBody {...commentScopeProps}> */
export const commentScopeAttribute = 'data-comment-scope'
export const commentScopeProps = { [commentScopeAttribute]: '' }

/** 块里几个字的高亮用 CSS Custom Highlight API，不改正文的 DOM；颜色在 styles.css 的 ::highlight() 里 */
const quoteHighlight = 'docsite-comment'
const activeQuoteHighlight = 'docsite-comment-active'
/** 整块评论批的块加这个属性，styles.css 给它画框 */
const commentedBlockAttribute = 'data-commented-block'

const cardWidth = 360

/**
 * TSX 页面里手放的评论标记：包住要能评论的那一块，id 在这一页里不重复，如
 * <CommentAnchor id="waveform-chart"><Chart /></CommentAnchor>。只包一个元素，外面这层不占版面。
 * MDX 页面不用它：MDX 源文件里的 <CommentAnchor id="…" /> 由编译插件处理
 */
export function CommentAnchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className={commentBlockWrapperClass} {...{ [commentAnchorAttribute]: id, [commentBlockAttribute]: '' }}>
      {children}
    </div>
  )
}

/** 网页发起评论时交给接口的 target，见 server/comments.ts */
type NewTarget = { anchor?: string; block?: string; quote?: string; quoteIndex?: number }

/** 相对评论层左上角的一个框 */
type Box = { top: number; left: number; width: number; height: number }

/** 正文上评论的几样东西在评论层里的位置 */
type Placement = {
  /** 显示在正文上的评论串（没解决的，加上正打开的那串）：卡片弹出的位置 */
  anchored: Map<string, { cardTop: number; cardLeft: number }>
  /** 评论数按钮插进了那几个字末尾的评论串 */
  inline: string[]
  /** 整块评论串：评论数按钮在那一块右上角，right 是按钮右边缘 */
  blockBadges: Map<string, { top: number; right: number }>
  /** 标记找不到了（块被删了）的评论串 */
  missing: Set<string>
  /** 批的那几个字在块里找不到了、退成整块显示的评论串 */
  quoteLost: Set<string>
  /** 每串批的那一块（找得到时） */
  blockOf: Map<string, HTMLElement>
  /** MDX 源文件里有、但没有评论串用的标记 */
  unusedAnchors: string[]
}

const emptyPlacement: Placement = { anchored: new Map(), inline: [], blockBadges: new Map(), missing: new Set(), quoteLost: new Set(), blockOf: new Map(), unusedAnchors: [] }

/** 正在写的新评论：批的是什么、卡片弹出的位置；批整块时 outline 是那一块的框，批几个字时 range 是那几个字 */
type Draft = { target: NewTarget; label: string; cardTop: number; cardLeft: number; outline?: Box; range?: Range }

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

function boxRelativeTo(rect: DOMRect, layerRect: DOMRect): Box {
  return { top: rect.top - layerRect.top, left: rect.left - layerRect.left, width: rect.width, height: rect.height }
}

function rectOfPlace(place: ThreadPlace) {
  if (place.type === 'text') return place.range.getBoundingClientRect()
  if (place.type === 'block') return boxElementOf(place.block).getBoundingClientRect()
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

function sameIds(a: Iterable<string>, b: Iterable<string>) {
  return [...a].join() === [...b].join()
}

function samePlacement(a: Placement, b: Placement) {
  if (!sameIds(a.missing, b.missing) || !sameIds(a.quoteLost, b.quoteLost) || !sameIds(a.inline, b.inline) || !sameIds(a.unusedAnchors, b.unusedAnchors)) return false
  if (a.anchored.size !== b.anchored.size || a.blockBadges.size !== b.blockBadges.size || a.blockOf.size !== b.blockOf.size) return false
  for (const [id, spot] of a.anchored) {
    const other = b.anchored.get(id)
    if (!other || other.cardTop !== spot.cardTop || other.cardLeft !== spot.cardLeft) return false
  }
  for (const [id, spot] of a.blockBadges) {
    const other = b.blockBadges.get(id)
    if (!other || other.top !== spot.top || other.right !== spot.right) return false
  }
  for (const [id, block] of a.blockOf) if (b.blockOf.get(id) !== block) return false
  return true
}

/** 选中模式刷新后保持：发评论后开发服务整页刷新，审一页时通常一连批好几处 */
const pickingKey = 'docsite-kit:comment-picking'

function rememberedPicking() {
  try {
    return sessionStorage.getItem(pickingKey) === '1'
  } catch {
    return false
  }
}

function rememberPicking(picking: boolean) {
  try {
    if (picking) sessionStorage.setItem(pickingKey, '1')
    else sessionStorage.removeItem(pickingKey)
  } catch {
    // 会话存储不可用（隐私模式等）时，刷新后选中模式不保持
  }
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

function PickIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

/**
 * 页面上的评论（照 Notion）：被批的块画框、评论数按钮在那一块右上角；批块里几个字时那几个字标黄，评论数按钮插在它们末尾。点按钮或点标黄的字弹出这串评论。
 * 能写评论时（开发服务里），右下角「批注」打开选中模式：鼠标移到哪一块就框出哪一块，点一下批整块，在一块里拖选文字批那几个字。
 * 右下角的「评论」按钮打开右侧栏，列出这一页全部评论，分未解决、已解决，也能评论整页
 */
export function PageComments<Entry extends CommentEntry>({ page, threads, commenter, renderBody, apiUrl = '/api/comments', children }: PageCommentsProps<Entry>) {
  const api: CommentApi = { url: apiUrl }
  const layerRef = useRef<HTMLDivElement>(null)
  /** 插进正文的评论数按钮的外壳，每串一个、一直用同一个元素，React 经 portal 往里渲染按钮 */
  const inlineHostsRef = useRef(new Map<string, HTMLElement>())
  const [openId, setOpenId] = useState<string>()
  const [placement, setPlacement] = useState<Placement>(emptyPlacement)
  const [draft, setDraft] = useState<Draft>()
  const [picking, setPicking] = useState(false)
  const [hovered, setHovered] = useState<{ element: HTMLElement; box: Box; label: string }>()
  const [hint, setHint] = useState<string>()
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

  // 发评论后开发服务整页刷新，刷新后重新打开刚才那串、保持选中模式
  useEffect(() => {
    const thread = recentThreadToOpen()
    if (thread && threads.some((candidate) => candidate.id === thread)) setOpenId(thread)
  }, [threads])
  useEffect(() => {
    if (writable && rememberedPicking()) setPicking(true)
  }, [writable])

  const scopeOf = () => {
    const scope = layerRef.current!.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
    if (!scope) throw new Error(`评论找不到正文：PageComments 里面的正文容器要带 ${commentScopeAttribute} 属性，如 <DocsBody {...commentScopeProps}>`)
    return scope
  }

  const draftRange = draft?.range
  useEffect(() => {
    const layer = layerRef.current!
    const scope = scopeOf()
    const placeOf = new Map<string, ThreadPlace>()
    const inserted: InsertedBadge[] = []
    let frame = 0
    const clearBlockOutlines = () => {
      for (const element of scope.querySelectorAll(`[${commentedBlockAttribute}]`)) element.removeAttribute(commentedBlockAttribute)
    }
    const measure = () => {
      // 先撤掉上次插的按钮，在原样的正文上找字，再插回去
      removeInsertedBadges(inserted)
      clearBlockOutlines()
      const anchoredBlocks = anchoredBlocksOf(scope)
      placeOf.clear()
      for (const thread of threads) placeOf.set(thread.id, placeOfThread(anchoredBlocks, thread.head))
      const isShown = (thread: CommentThread<Entry>) => thread.head.status === 'open' || thread.id === openId
      const openRanges: Range[] = []
      for (const thread of threads.filter(isShown)) {
        const place = placeOf.get(thread.id)!
        if (place.type === 'text') openRanges.push(place.range)
        if (place.type === 'block') boxElementOf(place.block).setAttribute(commentedBlockAttribute, thread.id === openId ? 'active' : '')
      }
      const activePlace = openId === undefined ? undefined : placeOf.get(openId)
      paintHighlights(openRanges, draftRange ?? (activePlace?.type === 'text' ? activePlace.range : undefined))

      const shown = threads.filter((thread) => {
        const type = placeOf.get(thread.id)!.type
        return (type === 'text' || type === 'block') && isShown(thread)
      })
      const inline: string[] = []
      for (const thread of shown) {
        const place = placeOf.get(thread.id)!
        if (place.type !== 'text') continue
        inserted.push(insertAtRangeEnd(inlineHostOf(thread.id), place.range))
        inline.push(thread.id)
      }

      // 插完按钮再量位置：按钮占了地方，后面的文字可能挪了
      const layerRect = layer.getBoundingClientRect()
      const anchored = new Map<string, { cardTop: number; cardLeft: number }>()
      const blockBadges = new Map<string, { top: number; right: number }>()
      const badgesAt = new Map<string, number>()
      for (const thread of shown) {
        const place = placeOf.get(thread.id)!
        const rect = rectOfPlace(place)!
        anchored.set(thread.id, { cardTop: rect.bottom - layerRect.top + 8, cardLeft: clampCardLeft(rect.left - layerRect.left, layerRect.width) })
        if (place.type !== 'block') continue
        // 同一块上的几串评论，按钮竖着排
        const key = `${rect.top}:${rect.right}`
        const stacked = badgesAt.get(key) ?? 0
        badgesAt.set(key, stacked + 1)
        blockBadges.set(thread.id, { top: rect.top - layerRect.top + 6 + stacked * 26, right: rect.right - layerRect.left - 6 })
      }
      const blockOf = new Map<string, HTMLElement>()
      const missing = new Set<string>()
      const quoteLost = new Set<string>()
      for (const [id, place] of placeOf) {
        if (place.type === 'missing') missing.add(id)
        if (place.type === 'text' || place.type === 'block') blockOf.set(id, place.block)
        if (place.type === 'block' && place.quoteLost) quoteLost.add(id)
      }
      // TSX 页面手放的标记（data-comment-block 为空）没有评论串用也是正常的：它是留给人批的位置
      const usedAnchors = new Set(threads.map((thread) => thread.head.anchor))
      const unusedAnchors = [...anchoredBlocks].filter(([id, block]) => !usedAnchors.has(id) && block.getAttribute(commentBlockAttribute) !== '').map(([id]) => id)
      const next: Placement = { anchored, inline, blockBadges, missing, quoteLost, blockOf, unusedAnchors }
      setPlacement((current) => (samePlacement(current, next) ? current : next))
    }
    const measureNextFrame = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const openFromQuote = (event: MouseEvent) => {
      if (document.documentElement.hasAttribute(pickingAttribute) || !document.getSelection()?.isCollapsed) return
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
      clearBlockOutlines()
      removeInsertedBadges(inserted)
    }
  }, [threads, openId, draftRange])

  const startDraft = (block: CommentableBlock, quoted?: { quote: string; quoteIndex: number; range: Range }) => {
    const layerRect = layerRef.current!.getBoundingClientRect()
    const box = boxRelativeTo(boxElementOf(block.element).getBoundingClientRect(), layerRect)
    const target: NewTarget = block.anchor !== undefined ? { anchor: block.anchor } : { block: block.spec }
    const below = quoted ? quoted.range.getBoundingClientRect() : undefined
    setOpenId(undefined)
    setHovered(undefined)
    setDraft({
      target: quoted ? { ...target, quote: quoted.quote, quoteIndex: quoted.quoteIndex } : target,
      label: quoted ? `「${quoted.quote}」` : targetLabelOf({ anchor: block.anchor ?? '' }, block.element),
      cardTop: (below ? below.bottom - layerRect.top : box.top + box.height) + 8,
      cardLeft: clampCardLeft(below ? below.left - layerRect.left : box.left, layerRect.width),
      outline: quoted ? undefined : box,
      range: quoted?.range,
    })
  }

  const showHint = (text: string) => {
    setHint(text)
    window.setTimeout(() => setHint((current) => (current === text ? undefined : current)), 3000)
  }

  const setPickingAndRemember = (next: boolean) => {
    setPicking(next)
    rememberPicking(next)
    if (!next) setHovered(undefined)
  }

  // 选中模式：框出鼠标下的那一块；点一下批整块，在一块里拖选文字批那几个字；Esc 退出
  useEffect(() => {
    if (!picking || !writable) return
    const layer = layerRef.current!
    const scope = scopeOf()
    document.documentElement.setAttribute(pickingAttribute, '')
    const hoverBlock = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return
      const block = blockContaining(scope, event.target)
      if (!block) return setHovered(undefined)
      setHovered((current) => {
        if (current?.element === block.element) return current
        const box = boxRelativeTo(boxElementOf(block.element).getBoundingClientRect(), layer.getBoundingClientRect())
        return { element: block.element, box, label: targetLabelOf({ anchor: block.anchor ?? '' }, block.element) }
      })
    }
    const pickBlock = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !document.getSelection()?.isCollapsed) return
      const block = blockContaining(scope, event.target)
      if (!block) return
      // 选中模式里点链接不跳转
      event.preventDefault()
      startDraft(block)
    }
    const pickQuote = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      const startBlock = blockContaining(scope, range.startContainer)
      const endBlock = blockContaining(scope, range.endContainer)
      if (!startBlock || !endBlock) return
      if (startBlock.element !== endBlock.element) return showHint('一次只能批一块里的字：这次选区跨了两块')
      const quoted = quoteInBlock(startBlock.element, range)
      if (quoted) startDraft(startBlock, { ...quoted, range: range.cloneRange() })
    }
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setPickingAndRemember(false)
    }
    const clearHover = () => setHovered(undefined)
    scope.addEventListener('mousemove', hoverBlock)
    scope.addEventListener('mouseleave', clearHover)
    scope.addEventListener('click', pickBlock)
    scope.addEventListener('mouseup', pickQuote)
    document.addEventListener('keydown', exitOnEscape)
    return () => {
      document.documentElement.removeAttribute(pickingAttribute)
      scope.removeEventListener('mousemove', hoverBlock)
      scope.removeEventListener('mouseleave', clearHover)
      scope.removeEventListener('click', pickBlock)
      scope.removeEventListener('mouseup', pickQuote)
      document.removeEventListener('keydown', exitOnEscape)
    }
  }, [picking, writable])

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

  const createThread = async (target: NewTarget, body: string, images: File[]) => {
    const { thread } = await postComment(api, { op: 'create', page, target: JSON.stringify(target), body }, images)
    rememberThreadToOpen(thread)
    setDraft(undefined)
    document.getSelection()?.removeAllRanges()
  }

  const openThread = openId === undefined ? undefined : threads.find((thread) => thread.id === openId)
  const openSpot = openId === undefined ? undefined : placement.anchored.get(openId)
  const labelOf = (thread: CommentThread<Entry>) => targetLabelOf(thread.head, placement.blockOf.get(thread.id))

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
      {[...placement.blockBadges].map(([id, badge]) => {
        const thread = threads.find((candidate) => candidate.id === id)!
        return (
          <span key={id} data-comment-ui="" className="absolute z-10 -translate-x-full" style={{ top: badge.top, left: badge.right }}>
            <CountBadge count={1 + thread.replies.length} active={id === openId} label={labelOf(thread)} onClick={() => setOpenId(id === openId ? undefined : id)} className="shadow-sm" />
          </span>
        )
      })}
      {picking && hovered && !draft && (
        <div className="pointer-events-none absolute z-20 rounded-md outline-2 outline-offset-4 outline-amber-500 outline-dashed" style={hovered.box}>
          <span className="absolute -top-1.5 left-0 -translate-y-full rounded bg-amber-500 px-1.5 text-xs leading-5 text-white">{hovered.label}</span>
        </div>
      )}
      {draft?.outline && <div className="pointer-events-none absolute z-20 rounded-md outline-2 outline-offset-4 outline-amber-500" style={draft.outline} />}
      {draft && commenter && (
        <div data-comment-ui="" className="absolute z-30 flex flex-col gap-2 rounded-xl border bg-fd-popover p-3 text-fd-popover-foreground shadow-lg" style={{ top: draft.cardTop, left: draft.cardLeft, width: cardWidth }}>
          <p className="line-clamp-2 border-s-2 ps-2 text-xs text-fd-muted-foreground">{draft.label}</p>
          <CommentEditor placeholder="写评论…" submitLabel="评论" autoFocus onCancel={() => setDraft(undefined)} onSubmit={(body, images) => createThread(draft.target, body, images)} />
        </div>
      )}
      {openThread && openSpot && (
        <div data-comment-ui="" className="absolute z-30 max-h-[60vh] overflow-y-auto rounded-xl border bg-fd-popover p-3 text-fd-popover-foreground shadow-lg" style={{ top: openSpot.cardTop, left: openSpot.cardLeft, width: cardWidth }}>
          <ThreadView key={openThread.id} thread={openThread} renderBody={renderBody} commenter={commenter} api={api} note={noteOf(openThread, placement, labelOf)} onClose={() => setOpenId(undefined)} />
        </div>
      )}
      {hasCommentUi && (
        <CommentsPanel
          threads={threads}
          placement={placement}
          labelOf={labelOf}
          commenter={commenter}
          renderBody={renderBody}
          api={api}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          picking={picking}
          onPickingChange={(next) => {
            // 窄屏时右侧栏盖住正文，先关上才选得到
            if (next && !window.matchMedia('(width >= 80rem)').matches) setPanelOpen(false)
            setPickingAndRemember(next)
          }}
          hint={hint}
          detailId={panelThreadId}
          onDetailChange={setPanelThreadId}
          onCreatePageComment={(body, images) => createThread({}, body, images)}
          onGoToThread={(id) => {
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

/** 选中模式打开时 <html> 上的属性：点标黄的字不再打开评论，而是批那一块 */
const pickingAttribute = 'data-comment-picking'

/** 卡片顶上的说明：标记找不到了、批的字找不到了 */
function noteOf<Entry extends CommentEntry>(thread: CommentThread<Entry>, placement: Placement, labelOf: (thread: CommentThread<Entry>) => string) {
  if (placement.missing.has(thread.id)) return `批的那一块找不到了（标记 ${thread.head.anchor}）`
  if (placement.quoteLost.has(thread.id)) return `批的字在这一块里找不到了：「${thread.head.quote}」`
  return labelOf(thread)
}

type CommentsPanelProps<Entry extends CommentEntry> = {
  threads: ReadonlyArray<CommentThread<Entry>>
  placement: Placement
  labelOf: (thread: CommentThread<Entry>) => string
  commenter: Commenter | null
  renderBody: (entry: Entry) => ReactNode
  api: CommentApi
  open: boolean
  onOpenChange: (open: boolean) => void
  picking: boolean
  onPickingChange: (picking: boolean) => void
  /** 选中模式里的一句提示，如选区跨了两块 */
  hint: string | undefined
  /** 在列表里展开看的评论串（整页评论、标记找不到了的、已解决的） */
  detailId: string | undefined
  onDetailChange: (id: string | undefined) => void
  onCreatePageComment: (body: string, images: File[]) => Promise<void>
  /** 正文里找得到的评论串：滚过去、弹出卡片 */
  onGoToThread: (id: string) => void
}

/** 右侧栏打开时 <html> 上的属性：styles.css 据此在宽屏上收起本页目录 */
const commentsSidebarOpenAttribute = 'data-comments-sidebar-open'

const floatingButtonClassName = 'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-md'

/** 右下角的「批注」「评论」按钮和「评论」打开的右侧栏 */
function CommentsPanel<Entry extends CommentEntry>(props: CommentsPanelProps<Entry>) {
  const { threads, placement, labelOf, commenter, renderBody, api, open, onOpenChange, picking, onPickingChange, hint, detailId, onDetailChange, onCreatePageComment, onGoToThread } = props
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
  const isTrouble = (thread: CommentThread<Entry>) => placement.missing.has(thread.id) || placement.quoteLost.has(thread.id)
  const choose = (thread: CommentThread<Entry>) => {
    if (thread.head.status === 'open' && placement.anchored.has(thread.id)) onGoToThread(thread.id)
    else onDetailChange(thread.id)
  }
  return (
    <>
      {(hint || !open) && (
        <div data-comment-ui="" className="fixed end-4 bottom-4 z-40 flex flex-col items-end gap-2">
          {hint && <p className="rounded-lg border bg-fd-popover px-3 py-1.5 text-sm text-fd-popover-foreground shadow-md">{hint}</p>}
          {!open && commenter && (
            <button
              type="button"
              aria-pressed={picking}
              onClick={() => onPickingChange(!picking)}
              className={`${floatingButtonClassName} ${picking ? 'border-amber-500 bg-amber-500 text-white' : 'bg-fd-card text-fd-card-foreground hover:bg-fd-accent'}`}
            >
              <PickIcon />
              {picking ? '批注中 · Esc 退出' : '批注'}
            </button>
          )}
          {!open && (
            <button type="button" onClick={() => onOpenChange(true)} className={`${floatingButtonClassName} bg-fd-card text-fd-card-foreground hover:bg-fd-accent`}>
              <MessageIcon />
              评论{openThreads.length > 0 ? ` ${openThreads.length}` : ''}
            </button>
          )}
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
            {placement.unusedAnchors.length > 0 && (
              <p className="rounded-lg border border-red-500/40 px-2 py-1.5 text-xs text-red-500">
                页面源文件里的标记 {placement.unusedAnchors.join('、')} 没有评论串在用：删评论串时漏删了，到源文件里删掉它
              </p>
            )}
            {detail ? (
              <div className="p-1">
                <ThreadView key={detail.id} thread={detail} renderBody={renderBody} commenter={commenter} api={api} note={noteOf(detail, placement, labelOf)} />
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
                      <button
                        type="button"
                        aria-pressed={picking}
                        onClick={() => onPickingChange(!picking)}
                        className={`flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm ${picking ? 'border-amber-500 bg-amber-500 text-white' : 'border-dashed text-fd-muted-foreground hover:bg-fd-accent'}`}
                      >
                        <PickIcon />
                        {picking ? '批注中 · Esc 退出' : '选一块批注'}
                      </button>
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
                    <span className={`line-clamp-1 text-xs ${isTrouble(thread) ? 'text-red-500' : 'text-fd-muted-foreground'}`}>{noteOf(thread, placement, labelOf)}</span>
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
