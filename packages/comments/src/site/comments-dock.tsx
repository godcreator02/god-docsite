/**
 * 评论交互台（右下角工具条 + 本页评论收件箱 + 正文下方的评论浮窗 + 批注模式）：
 * - 工具条：「批注」开关（可写时）与「评论」按钮。「评论」弹出收件箱（./comments-inbox），只有再点它或收件箱右上角的 × 才收起，
 *   点正文、Esc 都不收；开关记在 localStorage
 * - 点被批元素旁的黄条、划过的字，或在收件箱里点一行：被批的那一块正下方浮出一个框，只放这一串（./comment-thread），
 *   盖在后面的正文上、不挤动正文；再点同一处、点正文别处或 Esc 收起。批整页、找不到原文的串浮在正文顶上
 * - 批注模式（可写时）：正文鼠标变十字（站点样式 data-comment-picking），点候选元素批它（anchor 存元素的稳定 id，见 ./browser/annotate 的协议）；
 *   可写时划一段字随时浮出「评论」按钮批这段字（anchor 存 JSON：quote/start/end/snapshot，见模型 parseCommentAnchor）。草稿同样浮在那一块下面
 * - 被批的元素带 data-commented-element，正文栏左边外侧画一道和它上下对齐的竖黄条（./comment-margin-bars），元素本身不铺底色；
 *   划的字高亮（CSS Custom Highlight API，注册名 docsite-comment，样式在本包 template/styles.css，建站后在站点的 app/features/comments/）；
 *   划的字原文改了按快照差异重新找，找不到如实标注
 *
 * 浮窗与草稿经 portal 挂在 body 上、按文档坐标定位（带 data-comments-layer），不受正文容器的定位影响。
 * 写入提交到 action 参数给的地址（字段约定见 ./comment-model）
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { parseCommentAnchor, serializeTextAnchor, type CommentAnchor, type TextAnchorFields } from '../core/anchor.js'
import {
  annotateCommentTargets,
  commentScopeAttribute,
  commentTargetLabelOf,
  commentTargetNear,
  createRangeMapper,
  offsetsOfRange,
  pageTextOf,
  readablePageText,
  targetOfThread,
  type ThreadTarget,
} from './browser/index.js'
import { CommentMarginBars, type CommentedElement } from './comment-margin-bars.js'
import type { CommentAvatar, CommentBodyComponent, CommentsAccess, PageThreadSummary } from './comment-model.js'
import { CommentIcon, Composer, ThreadQuote, type ThreadPlace } from './comment-parts.js'
import { CommentThread } from './comment-thread.js'
import { CommentsInbox, type InboxItem } from './comments-inbox.js'
import { linkedThreadIdOf } from './comment-link.js'
import { threadAiPromptOf, type ThreadTargetForAi } from './thread-ai-prompt.js'

/** 收件箱开关存在 localStorage 的键 */
const inboxOpenStorageKey = 'docsite-comments-inbox-open'
/** 页面正文的容器带这个属性，评论在它里面找被批的原文：<DocsBody {...commentScopeProps}> */
export const commentScopeProps = { [commentScopeAttribute]: '' } as const
/** 划字高亮的注册名：样式在本包 template/styles.css（::highlight(docsite-comment) 这几条） */
const quoteHighlightName = 'docsite-comment'
const activeQuoteHighlightName = 'docsite-comment-active'
const draftQuoteHighlightName = 'docsite-comment-draft'
/** 被批元素、草稿批的元素与它们对应评论串的属性（样式在本包 template/styles.css） */
const commentedElementAttribute = 'data-commented-element'
const commentedThreadAttribute = 'data-comment-thread'
const draftElementAttribute = 'data-comment-draft-target'
/** 批注模式打开时挂在 <html> 上的属性（正文变十字光标，样式在本包 template/styles.css） */
const pickingAttribute = 'data-comment-picking'
/** 交互台自己的界面：工具条、收件箱所在的根，与挂在 body 上的浮窗 */
const dockAttribute = 'data-comments-dock'
const layerAttribute = 'data-comments-layer'
/** 引文标签最多显示的字数 */
const noteQuoteLength = 40
/** 浮窗最窄的宽度：批的是列表项、图片这类窄元素时也放得下回复框 */
const floatingMinWidth = 420
/** 浮窗与被批那一块之间的空隙 */
const floatingGap = 10

type Box = { top: number; left: number; width: number; height: number }

/** 拾取中的草稿：批元素（存的 anchor 就是元素 id）或批一段字（存的 anchor 是 TextAnchorFields 的 JSON） */
type Draft = { kind: 'element'; anchorValue: string; element: Element } | { kind: 'text'; anchorValue: string; label: string; range: Range }

/** 打开着的那一串；reveal 是浮窗出现后怎么滚进视野（从收件箱打开时滚到中间） */
type OpenThread = { id: string; reveal: 'nearest' | 'center' }

/** 浮窗挂在哪：一块正下方（小三角对准 pointAt 的第一行，不给就对准这一块的左边），或正文顶上（批整页、找不到原文） */
type FloatAnchor = { block: Element; edge: 'below' | 'top'; pointAt?: Range }

type FloatPosition = { top: number; left: number; width: number; arrowX: number | null }

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function containsPoint(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max))
}

function firstLineOf(range: Range): DOMRect {
  return [...range.getClientRects()].find((rect) => rect.width > 0 && rect.height > 0) ?? range.getBoundingClientRect()
}

function highlightsAvailable() {
  return typeof CSS !== 'undefined' && CSS.highlights != null && typeof Highlight === 'function'
}

function paintHighlights(ranges: ReadonlyArray<Range>, activeRange: Range | undefined, draftRange: Range | undefined) {
  if (!highlightsAvailable()) return
  CSS.highlights.set(quoteHighlightName, new Highlight(...ranges))
  if (activeRange) CSS.highlights.set(activeQuoteHighlightName, new Highlight(activeRange))
  else CSS.highlights.delete(activeQuoteHighlightName)
  if (draftRange) CSS.highlights.set(draftQuoteHighlightName, new Highlight(draftRange))
  else CSS.highlights.delete(draftQuoteHighlightName)
}

function setAttributeIfDifferent(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value)
}

/** 标注走查与描边标记写进正文的属性；观察者对它们的变更不算正文变化，否则自己触发自己 */
const ownAttributeNames = new Set(['id', 'data-comment-target', commentedElementAttribute, commentedThreadAttribute, draftElementAttribute])

/** 这个节点属于交互台自己的界面（工具条、收件箱、浮窗）吗 */
function isOwnInterface(node: Node | EventTarget | null) {
  const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null
  return element?.closest(`[${dockAttribute}], [${layerAttribute}]`) != null
}

/** 两轮落点相同吗（相同就不更新 state，下游 effect 不重跑） */
function sameTargets(a: Map<string, ThreadTarget>, b: Map<string, ThreadTarget>) {
  if (a.size !== b.size) return false
  for (const [id, target] of a) {
    const other = b.get(id)
    if (!other || target.kind !== other.kind) return false
    if (target.kind === 'element' && other.kind === 'element') {
      if (target.element !== other.element) return false
    } else if (target.kind === 'text' && other.kind === 'text') {
      if (
        target.changed !== other.changed ||
        target.range.startContainer !== other.range.startContainer ||
        target.range.endContainer !== other.range.endContainer ||
        target.range.startOffset !== other.range.startOffset ||
        target.range.endOffset !== other.range.endOffset
      ) {
        return false
      }
    } else if (target.kind === 'missing' && other.kind === 'missing') {
      if (target.reason !== other.reason) return false
    }
  }
  return true
}

function quoteNote(quote: string, prefix: string) {
  const readable = readablePageText(quote)
  const shown = readable.length > noteQuoteLength ? `${readable.slice(0, noteQuoteLength)}…` : readable
  return `${prefix}「${shown}」`
}

/** 一串批在哪：还没量过落点时（服务端渲染、首帧）按锚点的种类先算 */
function placeOf(anchor: CommentAnchor, target: ThreadTarget | undefined): ThreadPlace {
  if (anchor.kind === 'page') return 'page'
  if (anchor.kind === 'broken') return 'missing'
  if (target === undefined) return 'body'
  return target.kind === 'element' || target.kind === 'text' ? 'body' : 'missing'
}

/** 批的位置写给人看：被批的元素、引的原文、原文改过或找不到了 */
function noteOf(anchor: CommentAnchor, target: ThreadTarget | undefined): string | undefined {
  if (anchor.kind === 'broken') return '锚点数据认不出'
  const quote = anchor.kind === 'text' ? anchor.quote : ''
  if (target?.kind === 'missing') {
    if (target.reason === 'element-id-gone') return '批的元素不在这一页上了'
    // 页签没打开、组件收起把内容从页面拿掉时，被批的字也不在页面文字里：换到那一页或展开就找得回
    return quoteNote(quote, '原文找不到了（可能已删去，或在没打开的页签、收起的内容里）：')
  }
  if (target?.kind === 'hidden') return quoteNote(quote, '批的内容现在看不见（可能在收起的内容里）：')
  if (target?.kind === 'text') return quoteNote(target.quote, target.changed ? '原文改过：' : '')
  if (target?.kind === 'element') return commentTargetLabelOf(target.element)
  return undefined
}

/** 批在哪写给 AI：元素交它此刻的文字，划字交原文；找不到、看不见的交界面上那句说明 */
function targetForAiOf(anchor: CommentAnchor, target: ThreadTarget | undefined, note: string | undefined): ThreadTargetForAi {
  if (anchor.kind === 'page') return { kind: 'page' }
  if (target?.kind === 'element') return { kind: 'element', text: (target.element.textContent ?? '').trim() }
  if (target?.kind === 'text') return { kind: 'text', quote: readablePageText(target.quote), changed: target.changed }
  return { kind: 'unplaced', note: note ?? '原文找不到了' }
}

/** 打开着的这一串复制给 AI 的提示词：站点地址与这一串的链接取浏览器此刻的地址 */
function aiPromptOfThread(thread: PageThreadSummary, target: ThreadTarget | undefined, note: string | undefined): string {
  const threadUrl = new URL(window.location.href)
  threadUrl.search = ''
  threadUrl.hash = ''
  threadUrl.searchParams.set('comment', thread.id)
  return threadAiPromptOf({
    siteUrl: `${window.location.origin}/`,
    threadUrl: threadUrl.href,
    page: thread.page,
    threadId: thread.id,
    target: targetForAiOf(parseCommentAnchor(thread.anchor), target, note),
  })
}

/** 浮窗挂在哪：元素正下方；划的字所在那一块正下方、小三角对准那几个字；其余浮在正文顶上 */
function floatAnchorOf(target: ThreadTarget | undefined, scope: Element): FloatAnchor {
  if (target?.kind === 'element') return { block: target.element, edge: 'below' }
  if (target?.kind === 'text') return { block: commentTargetNear(target.range.startContainer, scope) ?? scope, edge: 'below', pointAt: target.range }
  return { block: scope, edge: 'top' }
}

/** 浮窗的文档坐标：和那一块左对齐、同宽（至少 floatingMinWidth），不超出正文与窗口 */
function floatPositionOf(anchor: FloatAnchor, scope: Element): FloatPosition {
  const blockRect = anchor.block.getBoundingClientRect()
  const scopeRect = scope.getBoundingClientRect()
  const width = Math.min(Math.max(blockRect.width, floatingMinWidth), Math.max(scopeRect.width, blockRect.width), window.innerWidth - 16)
  const rightLimit = Math.min(Math.max(scopeRect.right, blockRect.right), window.innerWidth - 8)
  const left = Math.max(8, Math.min(blockRect.left, rightLimit - width))
  const top = anchor.edge === 'top' ? scopeRect.top : blockRect.bottom + floatingGap
  const pointLeft = anchor.pointAt ? firstLineOf(anchor.pointAt).left : anchor.edge === 'below' ? blockRect.left : null
  return {
    top: top + window.scrollY,
    left: left + window.scrollX,
    width,
    arrowX: pointLeft === null ? null : clamp(pointLeft - left + 10, 14, width - 30),
  }
}

/** 浮在某一块下面的框：挂在 body 上，跟着窗口与正文的尺寸变化重新定位；出现后滚进视野 */
function FloatingLayer({ anchor, scope, reveal, tone, children }: { anchor: FloatAnchor; scope: Element; reveal: OpenThread['reveal']; tone: 'thread' | 'draft'; children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<FloatPosition | null>(null)
  useLayoutEffect(() => {
    const place = () => setPosition(floatPositionOf(anchor, scope))
    place()
    const observer = new ResizeObserver(place)
    observer.observe(scope)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchor, scope])
  const placed = position !== null
  useEffect(() => {
    if (!placed) return
    layerRef.current?.scrollIntoView({ block: reveal, behavior: 'smooth' })
    // 定位之前框是隐藏的，输入框挂载时的自动聚焦落空了，这里补上
    layerRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }, [placed])
  const style: CSSProperties = position
    ? ({ top: position.top, left: position.left, width: position.width, '--docsite-arrow-x': `${position.arrowX ?? 0}px` } as CSSProperties)
    : { visibility: 'hidden' }
  const classNames = ['docsite-floating', tone === 'draft' ? 'docsite-floating-draft' : '', position?.arrowX == null ? '' : 'docsite-floating-arrow'].filter(Boolean).join(' ')
  return createPortal(
    <div ref={layerRef} {...{ [layerAttribute]: '' }} className={classNames} style={style}>
      {children}
    </div>,
    document.body,
  )
}

export interface CommentsDockProps {
  pagePath: string
  /** 评论表单提交到的地址：这个地址的路由 action 调 handleCommentWrite */
  action: string
  threads: PageThreadSummary[]
  access: CommentsAccess
  /** 宿主的评论正文组件：按集合内路径渲染（fumadocs 的 client loader），正文按需加载 */
  BodyComponent: CommentBodyComponent
  /** 宿主的头像组件（身份包的 Avatar 包一层）；不给就用名字的头一个字 */
  AvatarComponent?: CommentAvatar
}

export function CommentsDock({ pagePath, action, threads, access, BodyComponent, AvatarComponent }: CommentsDockProps) {
  const [inboxOpen, setInboxOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [openThread, setOpenThread] = useState<OpenThread | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectionAction, setSelectionAction] = useState<{ top: number; left: number; anchor: TextAnchorFields; range: Range } | null>(null)
  const [hovered, setHovered] = useState<{ box: Box; label: string } | null>(null)
  const [targets, setTargets] = useState<Map<string, ThreadTarget>>(() => new Map())
  const [scope, setScope] = useState<Element | null>(null)
  /** 正文里的标记每重画一轮加一：被批元素可能挪了位置，黄条跟着重新量 */
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null)
  const [mapRange] = useState(createRangeMapper)
  /** 落点的实时引用：document 级点击监听里用，不跟着 React 状态走 */
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const hoveredElementRef = useRef<Element | null>(null)
  const writable = access.kind === 'writable'
  const openThreadId = openThread?.id ?? null

  const changeInboxOpen = (open: boolean) => {
    setInboxOpen(open)
    try {
      localStorage.setItem(inboxOpenStorageKey, open ? '1' : '0')
    } catch {
      // localStorage 被浏览器策略禁用时只丢记忆，不影响开关本身
    }
  }

  // 挂载后读上次的开关（不在首渲染读：SSR 与客户端要渲染一致）
  useEffect(() => {
    try {
      if (localStorage.getItem(inboxOpenStorageKey) === '1') setInboxOpen(true)
    } catch {
      // 同上
    }
  }, [])

  // 地址点名了这一页上的一串（?comment=<id>，通知里的链接）就打开它，和在收件箱里点那一行一样；只在地址变了时看一次
  const { search } = useLocation()
  const threadIds = threads.map((thread) => thread.id)
  useEffect(() => {
    const linkedThreadId = linkedThreadIdOf(search, threadIds)
    if (linkedThreadId !== null) setOpenThread({ id: linkedThreadId, reveal: 'center' })
    // 只跟着地址走：评论串列表变了（别人写了新评论）不重新打开
  }, [pagePath, search])

  // 正文变化 → 标注走查 + 逐串推算落点 + 画高亮与描边。自己的属性写入与自己的界面不算正文变化
  const draftRange = draft?.kind === 'text' ? draft.range : undefined
  useEffect(() => {
    let frame = 0
    const markedElements: Element[] = []
    const measure = () => {
      const found = document.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
      setScope(found)
      if (!found) {
        setTargets((current) => (current.size === 0 ? current : new Map<string, ThreadTarget>()))
        paintHighlights([], undefined, draftRange)
        return
      }
      annotateCommentTargets(found)
      const pageText = pageTextOf(found)
      const next = new Map<string, ThreadTarget>()
      for (const thread of threads) next.set(thread.id, targetOfThread(found, pageText, parseCommentAnchor(thread.anchor), mapRange))
      setTargets((current) => (sameTargets(current, next) ? current : next))
      const activeTarget = openThreadId === null ? undefined : next.get(openThreadId)
      paintHighlights(
        [...next.values()].filter((target): target is Extract<ThreadTarget, { kind: 'text' }> => target.kind === 'text').map((target) => target.range),
        activeTarget?.kind === 'text' ? activeTarget.range : undefined,
        draftRange,
      )
      for (const element of markedElements.splice(0)) {
        element.removeAttribute(commentedElementAttribute)
        element.removeAttribute(commentedThreadAttribute)
      }
      for (const [id, target] of next) {
        if (target.kind !== 'element') continue
        setAttributeIfDifferent(target.element, commentedElementAttribute, id === openThreadId ? 'active' : '')
        setAttributeIfDifferent(target.element, commentedThreadAttribute, id)
        markedElements.push(target.element)
      }
      setLayoutVersion((version) => version + 1)
    }
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const isIgnored = (record: MutationRecord) => {
      if (record.type === 'attributes' && record.attributeName !== null && ownAttributeNames.has(record.attributeName)) return true
      return isOwnInterface(record.target)
    }
    const observer = new MutationObserver((records) => {
      if (records.some((record) => !isIgnored(record))) scheduleMeasure()
    })
    // 观察整个文档：正文容器本身是异步加载进来的（MDX 正文按需加载），出现之前只能看文档
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const element of markedElements) {
        element.removeAttribute(commentedElementAttribute)
        element.removeAttribute(commentedThreadAttribute)
      }
      paintHighlights([], undefined, undefined)
    }
  }, [threads, openThreadId, mapRange, draftRange])

  // 草稿批的元素做个标记（它旁边的蓝条由 CommentMarginBars 画），草稿收起就去掉
  useEffect(() => {
    if (draft?.kind !== 'element') return
    draft.element.setAttribute(draftElementAttribute, '')
    return () => draft.element.removeAttribute(draftElementAttribute)
  }, [draft])

  // 批注模式：悬停画框、点元素拾取
  useEffect(() => {
    if (!picking) return
    document.documentElement.setAttribute(pickingAttribute, '')
    const scopeOf = () => document.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
    const onMove = (event: MouseEvent) => {
      const found = scopeOf()
      const element = !isOwnInterface(event.target) && found && event.target instanceof Element && found.contains(event.target) ? commentTargetNear(event.target, found) : null
      hoveredElementRef.current = element
      setHovered(element ? { box: boxOf(element), label: commentTargetLabelOf(element) } : null)
    }
    const onLeave = () => {
      hoveredElementRef.current = null
      setHovered(null)
    }
    const onPick = (event: MouseEvent) => {
      if (isOwnInterface(event.target)) return
      const found = scopeOf()
      if (!found || !(event.target instanceof Element) || !found.contains(event.target)) return
      // 批注模式里正文上的点击都归批注：链接不跳、按钮不按，点到批不了的地方也一样吞掉
      event.preventDefault()
      event.stopPropagation()
      // 拖选了文字就是批那段字，交给选中那一路（mouseup 后弹按钮）
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) return
      const element = commentTargetNear(event.target, found)
      if (!element || element.id === '') return
      setOpenThread(null)
      setDraft({ kind: 'element', anchorValue: element.id, element })
    }
    const onScroll = () => {
      const element = hoveredElementRef.current
      setHovered(element ? { box: boxOf(element), label: commentTargetLabelOf(element) } : null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('click', onPick, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.documentElement.removeAttribute(pickingAttribute)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('click', onPick, true)
      window.removeEventListener('scroll', onScroll, true)
      hoveredElementRef.current = null
      setHovered(null)
    }
  }, [picking])

  // 划字：可写时在正文里选中几个字，松手浮出「评论」按钮
  useEffect(() => {
    if (!writable) return
    const onSelectionEnd = (event: MouseEvent) => {
      if (isOwnInterface(event.target)) return
      const selection = document.getSelection()
      const found = document.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !found) {
        setSelectionAction(null)
        return
      }
      const range = selection.getRangeAt(0)
      if (!found.contains(range.startContainer) || !found.contains(range.endContainer) || range.toString().trim() === '') {
        setSelectionAction(null)
        return
      }
      const pageText = pageTextOf(found)
      const offsets = offsetsOfRange(pageText, range)
      if (offsets === undefined) {
        setSelectionAction(null)
        return
      }
      const anchor: TextAnchorFields = { quote: pageText.text.slice(...offsets), start: offsets[0], end: offsets[1], snapshot: pageText.text }
      const first = firstLineOf(range)
      setSelectionAction({ top: Math.max(8, first.top - 42), left: clamp(first.left, 8, window.innerWidth - 100), anchor, range: range.cloneRange() })
    }
    const onScroll = () => setSelectionAction(null)
    document.addEventListener('mouseup', onSelectionEnd)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mouseup', onSelectionEnd)
      window.removeEventListener('scroll', onScroll, true)
      setSelectionAction(null)
    }
  }, [writable])

  // Esc：退出批注、收起草稿与浮窗（收件箱不跟着收）
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPicking(false)
      setDraft(null)
      setSelectionAction(null)
      setOpenThread(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /** 点高亮的字或黄条：打开那一串，再点同一处收起（只用 setOpenThread 的函数式更新，事件监听里用首次渲染的这一份也对） */
  const toggleThread = (threadId: string) => setOpenThread((current) => (current?.id === threadId ? null : { id: threadId, reveal: 'nearest' }))

  // 点高亮的字 → 打开那一串，再点同一处收起；点正文别处收起浮窗。被批的元素本身点了不打开，打开它的那一串点它旁边的黄条（CommentMarginBars），
  // 这样元素里划过的字照样点得开自己那一串
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || isOwnInterface(event.target)) return
      if (event.target.closest('a, button, input, textarea, select, summary, label')) return
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) return
      for (const [threadId, target] of targetsRef.current) {
        if (target.kind !== 'text') continue
        if ([...target.range.getClientRects()].some((rect) => containsPoint(rect, event.clientX, event.clientY))) return toggleThread(threadId)
      }
      setOpenThread(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // 鼠标停在被批元素上：对应的黄条加深
  useEffect(() => {
    const onOver = (event: MouseEvent) => {
      const marked = event.target instanceof Element ? event.target.closest(`[${commentedElementAttribute}]`) : null
      const threadId = marked?.getAttribute(commentedThreadAttribute) ?? null
      setHoveredThreadId((current) => (current === threadId ? current : threadId))
    }
    document.addEventListener('mouseover', onOver)
    return () => document.removeEventListener('mouseover', onOver)
  }, [])

  const commented = useMemo<CommentedElement[]>(
    () => [...targets].flatMap(([threadId, target]) => (target.kind === 'element' ? [{ threadId, element: target.element }] : [])),
    [targets],
  )

  const items = useMemo<InboxItem[]>(
    () =>
      threads.map((thread) => {
        const anchor = parseCommentAnchor(thread.anchor)
        const target = targets.get(thread.id)
        const note = noteOf(anchor, target)
        return { thread, place: placeOf(anchor, target), ...(note === undefined ? {} : { note }) }
      }),
    [threads, targets],
  )
  const openItem = openThreadId === null ? undefined : items.find((item) => item.thread.id === openThreadId)
  const openTarget = openThreadId === null ? undefined : targets.get(openThreadId)
  const openAnchor = useMemo(() => (scope && openItem ? floatAnchorOf(openTarget, scope) : null), [scope, openItem === undefined, openTarget])
  const draftAnchor = useMemo<FloatAnchor | null>(() => {
    if (!draft || !scope) return null
    if (draft.kind === 'element') return { block: draft.element, edge: 'below' }
    return { block: commentTargetNear(draft.range.startContainer, scope) ?? scope, edge: 'below', pointAt: draft.range }
  }, [draft, scope])

  const openFromInbox = (threadId: string) => {
    setDraft(null)
    setOpenThread({ id: threadId, reveal: 'center' })
  }
  const draftSubmitted = (threadId: string | undefined) => {
    setDraft(null)
    setSelectionAction(null)
    setPicking(false)
    document.getSelection()?.removeAllRanges()
    if (threadId !== undefined) setOpenThread({ id: threadId, reveal: 'nearest' })
  }

  return (
    <div {...{ [dockAttribute]: '' }}>
      <div className="docsite-comments-dock">
        {writable ? (
          <>
            <button
              type="button"
              data-comment-picking-toggle=""
              aria-pressed={picking}
              title="批注：点正文里的一块批它，或划一段字（Esc 退出）"
              className={picking ? 'docsite-dock-button docsite-dock-button-active' : 'docsite-dock-button'}
              onClick={() => {
                setPicking(!picking)
                if (picking) setDraft(null)
              }}
            >
              <CommentIcon name="pen" />
              批注
            </button>
            <span className="docsite-dock-separator" />
          </>
        ) : null}
        <button
          type="button"
          data-comment-inbox-toggle=""
          aria-expanded={inboxOpen}
          title={inboxOpen ? '收起本页评论' : '本页评论'}
          className={inboxOpen ? 'docsite-dock-button docsite-dock-button-open' : 'docsite-dock-button'}
          onClick={() => changeInboxOpen(!inboxOpen)}
        >
          <CommentIcon name="message" />
          评论
          <span className="docsite-dock-count">{threads.length}</span>
          <CommentIcon name={inboxOpen ? 'chevronDown' : 'chevronUp'} />
        </button>
      </div>
      {inboxOpen ? (
        <CommentsInbox
          items={items}
          pagePath={pagePath}
          action={action}
          access={access}
          BodyComponent={BodyComponent}
          AvatarComponent={AvatarComponent}
          openThreadId={openThreadId}
          onOpenThread={openFromInbox}
          onClose={() => changeInboxOpen(false)}
          onThreadCreated={(threadId) => setOpenThread({ id: threadId, reveal: 'center' })}
        />
      ) : null}
      {picking ? (
        <div className="docsite-picking-bar">
          <CommentIcon name="pen" />
          <span>批注：点正文里的一块，或划一段字</span>
          <kbd>Esc</kbd>
          <button type="button" onClick={() => setPicking(false)}>
            退出
          </button>
        </div>
      ) : null}
      {picking && hovered && !draft ? (
        <div data-comment-hover="" className="docsite-picking-hover" style={{ position: 'fixed', top: hovered.box.top - 4, left: hovered.box.left - 6, width: hovered.box.width + 12, height: hovered.box.height + 8 }}>
          <span className="docsite-picking-hover-label">{hovered.label} · 点击评论</span>
        </div>
      ) : null}
      {selectionAction && !draft ? (
        <button
          type="button"
          data-comment-quote-button=""
          className="docsite-selection-button"
          style={{ position: 'fixed', top: selectionAction.top, left: selectionAction.left }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpenThread(null)
            setDraft({ kind: 'text', anchorValue: serializeTextAnchor(selectionAction.anchor), label: quoteNote(selectionAction.anchor.quote, ''), range: selectionAction.range })
            setSelectionAction(null)
            // 选区换成草稿的高亮，免得两层颜色叠在一起
            document.getSelection()?.removeAllRanges()
          }}
        >
          <CommentIcon name="message" />
          评论
        </button>
      ) : null}
      {scope && (commented.length > 0 || draft?.kind === 'element') ? (
        <CommentMarginBars
          commented={commented}
          draftElement={draft?.kind === 'element' ? draft.element : null}
          scope={scope}
          layoutVersion={layoutVersion}
          openThreadId={openThreadId}
          hoveredThreadId={hoveredThreadId}
          onToggleThread={toggleThread}
        />
      ) : null}
      {openItem && openAnchor && scope ? (
        <FloatingLayer key={openItem.thread.id} anchor={openAnchor} scope={scope} reveal={openThread?.reveal ?? 'nearest'} tone="thread">
          <CommentThread
            thread={openItem.thread}
            action={action}
            writer={access.kind === 'writable' ? access.writer : undefined}
            BodyComponent={BodyComponent}
            AvatarComponent={AvatarComponent}
            place={openItem.place}
            // 批的是元素时浮窗就贴在它下面，不再重复写它是什么
            note={openTarget?.kind === 'element' ? undefined : openItem.note}
            foldReplies
            // AI 回复要写评论：只读的站（发布版）上回不了，不放这个按钮
            aiPrompt={writable ? aiPromptOfThread(openItem.thread, openTarget, openItem.note) : undefined}
            onClose={() => setOpenThread(null)}
          />
        </FloatingLayer>
      ) : null}
      {draft && draftAnchor && scope && access.kind === 'writable' ? (
        <FloatingLayer key={draft.anchorValue} anchor={draftAnchor} scope={scope} reveal="nearest" tone="draft">
          <div data-comment-draft="" className="docsite-thread docsite-draft">
            <button type="button" className="docsite-icon-button docsite-thread-close" title="取消（Esc）" aria-label="取消这条评论" onClick={() => setDraft(null)}>
              <CommentIcon name="close" />
            </button>
            {draft.kind === 'text' ? <ThreadQuote place="body" note={draft.label} /> : null}
            <Composer
              action={action}
              fields={{ intent: 'create-thread', page: pagePath, anchor: draft.anchorValue }}
              placeholder="写评论…"
              writer={access.writer}
              AvatarComponent={AvatarComponent}
              autoFocus
              formAttributes={{ 'data-comment-draft-form': '' }}
              onSent={(result) => draftSubmitted(result.threadId)}
            />
            <p className="docsite-draft-hint">Enter 发送 · Shift+Enter 换行 · Esc 取消</p>
          </div>
        </FloatingLayer>
      ) : null}
    </div>
  )
}
