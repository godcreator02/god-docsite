/**
 * 评论交互台（浮标 + 唤起式侧栏 + 批注模式）：
 * - 右下角浮标：评论按钮（角标是本页评论串数）唤出右侧评论栏，再点收起；开关记在 localStorage。
 *   侧栏 fixed 盖在目录那一列上（宽度同 --docsite-side-column-width），开着时由站点样式
 *   （平台包 god-docsite 的 styles.css 里 data-comments-sidebar-open 那组）让目录列让位
 * - 批注模式（可写时）：正文鼠标变十字（站点样式 data-comment-picking），点候选元素批它
 *   （anchor 存元素的稳定 id，见 ./browser/annotate 的协议），选中一段字批这段字
 *   （anchor 存 JSON：quote/start/end/snapshot，见模型 parseCommentAnchor）
 * - 已被批的元素描边（data-commented-element）、划的字高亮（CSS Custom Highlight API，
 *   注册名 docsite-comment，样式在本包 template/styles.css，建站后在站点的 app/features/comments/）；点标记在侧栏里亮对应评论，
 *   侧栏点 ⚲ 滚到正文里对应的位置；划的字原文改了按快照差异重新找，找不到如实标注
 *
 * 写入提交到 action 参数给的地址（字段与 CommentsSidebar 同一约定）；列表与回复复用 CommentsSidebar。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useFetcher } from 'react-router'
import { parseCommentAnchor, serializeTextAnchor, type TextAnchorFields } from '../core/anchor.js'
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
import { CommentsSidebar, errorOf, type CommentAvatar, type CommentsAccess, type PageThreadSummary } from './comments-sidebar.js'

/** 侧栏开关存在 localStorage 的键 */
const sidebarOpenStorageKey = 'docsite-comments-sidebar-open'
/** 页面正文的容器带这个属性，评论在它里面找被批的原文：<DocsBody {...commentScopeProps}> */
export const commentScopeProps = { [commentScopeAttribute]: '' } as const
/** 划字高亮的注册名：样式在本包 template/styles.css（::highlight(docsite-comment)） */
const quoteHighlightName = 'docsite-comment'
const activeQuoteHighlightName = 'docsite-comment-active'
/** 被批元素描边（样式在本包 template/styles.css）与它对应评论串的属性 */
const commentedElementAttribute = 'data-commented-element'
const commentedThreadAttribute = 'data-comment-thread'
/** 批注模式打开时挂在 <html> 上的属性（正文变十字光标，样式在本包 template/styles.css） */
const pickingAttribute = 'data-comment-picking'
const sidebarOpenAttribute = 'data-comments-sidebar-open'
/** 引文标签最多显示的字数 */
const noteQuoteLength = 40

type Box = { top: number; left: number; width: number; height: number }

/** 拾取中的草稿：批元素（存的 anchor 就是元素 id）或批一段字（存的 anchor 是 TextAnchorFields 的 JSON） */
type Draft =
  | { kind: 'element'; anchorValue: string; label: string; top: number; left: number }
  | { kind: 'text'; anchorValue: string; label: string; top: number; left: number }

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function clampToViewport(left: number, width: number) {
  return Math.max(8, Math.min(left, window.innerWidth - width - 8))
}

function containsPoint(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function highlightsAvailable() {
  return typeof CSS !== 'undefined' && CSS.highlights != null && typeof Highlight === 'function'
}

function paintHighlights(ranges: ReadonlyArray<Range>, activeRange: Range | undefined) {
  if (!highlightsAvailable()) return
  CSS.highlights.set(quoteHighlightName, new Highlight(...ranges))
  if (activeRange) CSS.highlights.set(activeQuoteHighlightName, new Highlight(activeRange))
  else CSS.highlights.delete(activeQuoteHighlightName)
}

function setAttributeIfDifferent(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value)
}

/** 标注走查与描边标记写进正文的属性；观察者对它们的变更不算正文变化，否则自己触发自己 */
const ownAttributeNames = new Set(['id', 'data-comment-target', commentedElementAttribute, commentedThreadAttribute])

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

export interface CommentsDockProps {
  pagePath: string
  /** 评论表单提交到的地址：这个地址的路由 action 调 handleCommentWrite */
  action: string
  threads: PageThreadSummary[]
  access: CommentsAccess
  /** 宿主的评论正文组件：按集合内路径渲染（fumadocs 的 client loader），正文按需加载 */
  BodyComponent: ComponentType<{ path: string }>
  /** 宿主的头像组件（身份包的 Avatar 包一层），传给侧栏的评论卡 */
  AvatarComponent?: CommentAvatar
}

export function CommentsDock({ pagePath, action, threads, access, BodyComponent, AvatarComponent }: CommentsDockProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectionAction, setSelectionAction] = useState<{ top: number; left: number; anchor: TextAnchorFields } | null>(null)
  const [hovered, setHovered] = useState<{ box: Box; label: string } | null>(null)
  const [targets, setTargets] = useState<Map<string, ThreadTarget>>(() => new Map())
  const [mapRange] = useState(createRangeMapper)
  const dockRootRef = useRef<HTMLDivElement>(null)
  /** 落点与拾取悬停的实时引用：document 级点击监听里用，不跟着 React 状态走 */
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const hoveredElementRef = useRef<Element | null>(null)
  const writable = access.kind === 'writable'

  const changeSidebarOpen = (open: boolean) => {
    setSidebarOpen(open)
    try {
      localStorage.setItem(sidebarOpenStorageKey, open ? '1' : '0')
    } catch {
      // localStorage 被浏览器策略禁用时只丢记忆，不影响开关本身
    }
  }

  // 挂载后读上次的开关（不在首渲染读：SSR 与客户端要渲染一致）
  useEffect(() => {
    try {
      if (localStorage.getItem(sidebarOpenStorageKey) === '1') setSidebarOpen(true)
    } catch {
      // 同上
    }
  }, [])

  // 侧栏开着时挂到 <html> 上：站点样式据此让目录列让位（样式在平台包 god-docsite 的 styles.css）。
  // 用 layout effect 赶在绘制前挂上：挂在普通 effect 里时，属性变化偶发不触发目录列的重算（要等下一次交互）
  useLayoutEffect(() => {
    if (sidebarOpen) document.documentElement.setAttribute(sidebarOpenAttribute, '')
    else document.documentElement.removeAttribute(sidebarOpenAttribute)
  }, [sidebarOpen])

  // 正文变化 → 标注走查 + 逐串推算落点 + 画高亮与描边。自己的属性写入不算正文变化
  useEffect(() => {
    let frame = 0
    const markedElements: Element[] = []
    const measure = () => {
      const scope = document.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
      if (!scope) {
        setTargets((current) => (current.size === 0 ? current : new Map<string, ThreadTarget>()))
        paintHighlights([], undefined)
        return
      }
      annotateCommentTargets(scope)
      const pageText = pageTextOf(scope)
      const next = new Map<string, ThreadTarget>()
      for (const thread of threads) next.set(thread.id, targetOfThread(scope, pageText, parseCommentAnchor(thread.anchor), mapRange))
      setTargets((current) => (sameTargets(current, next) ? current : next))
      const activeTarget = activeThreadId === null ? undefined : next.get(activeThreadId)
      paintHighlights(
        [...next.values()].filter((target): target is Extract<ThreadTarget, { kind: 'text' }> => target.kind === 'text').map((target) => target.range),
        activeTarget?.kind === 'text' ? activeTarget.range : undefined,
      )
      for (const element of markedElements.splice(0)) {
        element.removeAttribute(commentedElementAttribute)
        element.removeAttribute(commentedThreadAttribute)
      }
      for (const [id, target] of next) {
        if (target.kind !== 'element') continue
        setAttributeIfDifferent(target.element, commentedElementAttribute, id === activeThreadId ? 'active' : '')
        setAttributeIfDifferent(target.element, commentedThreadAttribute, id)
        markedElements.push(target.element)
      }
    }
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const isIgnored = (record: MutationRecord) => {
      if (record.type === 'attributes' && record.attributeName !== null && ownAttributeNames.has(record.attributeName)) return true
      const node = record.target instanceof Element ? record.target : record.target.parentElement
      return node !== null && dockRootRef.current !== null && dockRootRef.current.contains(node)
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
      paintHighlights([], undefined)
    }
  }, [threads, activeThreadId, mapRange])

  // 批注模式：悬停画虚线框、点元素拾取、划字松手弹按钮、Esc 退出
  useEffect(() => {
    if (!picking) return
    document.documentElement.setAttribute(pickingAttribute, '')
    const scopeOf = () => document.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
    const inDock = (target: EventTarget | null) => target instanceof Element && dockRootRef.current?.contains(target) === true
    const onMove = (event: MouseEvent) => {
      if (inDock(event.target)) {
        hoveredElementRef.current = null
        setHovered(null)
        return
      }
      const scope = scopeOf()
      const element = scope && event.target instanceof Element && scope.contains(event.target) ? commentTargetNear(event.target, scope) : null
      hoveredElementRef.current = element
      setHovered(element ? { box: boxOf(element), label: commentTargetLabelOf(element) } : null)
    }
    const onLeave = () => {
      hoveredElementRef.current = null
      setHovered(null)
    }
    const onPick = (event: MouseEvent) => {
      if (inDock(event.target)) return
      const scope = scopeOf()
      if (!scope || !(event.target instanceof Element) || !scope.contains(event.target)) return
      // 拖选了文字就是批那段字，交给选中那一路（mouseup 后弹按钮）
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) return
      const element = commentTargetNear(event.target, scope)
      if (!element || element.id === '') return
      event.preventDefault()
      event.stopPropagation()
      const box = boxOf(element)
      setDraft({
        kind: 'element',
        anchorValue: element.id,
        label: commentTargetLabelOf(element),
        top: box.top + box.height + 8,
        left: clampToViewport(box.left, 360),
      })
    }
    const onSelectionEnd = () => {
      const selection = document.getSelection()
      const scope = scopeOf()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !scope) {
        setSelectionAction(null)
        return
      }
      const range = selection.getRangeAt(0)
      if (!scope.contains(range.startContainer) || !scope.contains(range.endContainer)) {
        setSelectionAction(null)
        return
      }
      const pageText = pageTextOf(scope)
      const offsets = offsetsOfRange(pageText, range)
      if (offsets === undefined) {
        setSelectionAction(null)
        return
      }
      const anchor: TextAnchorFields = { quote: pageText.text.slice(...offsets), start: offsets[0], end: offsets[1], snapshot: pageText.text }
      const first = [...range.getClientRects()].find((rect) => rect.width > 0 && rect.height > 0) ?? range.getBoundingClientRect()
      setSelectionAction({ top: Math.max(8, first.top - 38), left: clampToViewport(first.left, 360), anchor })
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPicking(false)
        setDraft(null)
        setSelectionAction(null)
      }
    }
    const onScroll = () => {
      const element = hoveredElementRef.current
      setHovered(element ? { box: boxOf(element), label: commentTargetLabelOf(element) } : null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('click', onPick, true)
    document.addEventListener('mouseup', onSelectionEnd)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.documentElement.removeAttribute(pickingAttribute)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('click', onPick, true)
      document.removeEventListener('mouseup', onSelectionEnd)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      hoveredElementRef.current = null
      setHovered(null)
      setSelectionAction(null)
    }
  }, [picking])

  // 点正文里的标记（被批元素、高亮的字）→ 打开侧栏、亮对应评论并滚到那张卡
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (dockRootRef.current?.contains(event.target)) return
      if (event.target.closest('a, button, input, textarea, select, summary, label')) return
      const marked = event.target.closest(`[${commentedElementAttribute}]`)
      if (marked) {
        const threadId = marked.getAttribute(commentedThreadAttribute)
        if (threadId) activateThreadFromPage(threadId)
        return
      }
      for (const [threadId, target] of targetsRef.current) {
        if (target.kind !== 'text') continue
        if ([...target.range.getClientRects()].some((rect) => containsPoint(rect, event.clientX, event.clientY))) {
          activateThreadFromPage(threadId)
          return
        }
      }
      setActiveThreadId((current) => (current === null ? current : null))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  function activateThreadFromPage(threadId: string) {
    setActiveThreadId(threadId)
    // 已开着时 setSidebarOpen(true) 不触发重渲染，只是再写一次记忆
    changeSidebarOpen(true)
  }

  // 侧栏里点一行：亮这串并滚到正文里被批的元素或那段字
  function goToThread(threadId: string) {
    setActiveThreadId(threadId)
    const target = targetsRef.current.get(threadId)
    if (target?.kind === 'element') {
      target.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (target?.kind === 'text') {
      const start = target.range.startContainer
      const element = start instanceof Element ? start : start.parentElement
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // 激活的评论在侧栏里滚到可见
  useEffect(() => {
    if (activeThreadId === null || !sidebarOpen) return
    const card = dockRootRef.current?.querySelector(`[data-comment-card="${activeThreadId}"]`)
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeThreadId, sidebarOpen, threads])

  // 落点算出来后给每串补一条锚点说明（原文找不到了、在收起的内容里、批的是什么）
  const threadsWithNotes = useMemo(() => {
    const noteOf = (thread: PageThreadSummary): string | undefined => {
      const anchor = parseCommentAnchor(thread.anchor)
      const target = targets.get(thread.id)
      if (anchor.kind === 'broken') return '锚点数据认不出'
      if (target?.kind === 'missing') {
        if (target.reason === 'element-id-gone') return '锚定的元素不在这一页上'
        // 页签没打开、组件收起把内容从页面拿掉时，被批的字也不在页面文字里：换到那一页或展开就找得回
        return quoteNote(anchor.kind === 'text' ? anchor.quote : '', '原文找不到了（可能已删去，或在没打开的页签、收起的内容里）：')
      }
      if (target?.kind === 'hidden') return quoteNote(anchor.kind === 'text' ? anchor.quote : '', '批的内容现在看不见（可能在收起的内容里）：')
      if (target?.kind === 'text') return quoteNote(target.quote, target.changed ? '原文改过：' : '')
      if (target?.kind === 'element') return `批的元素：${commentTargetLabelOf(target.element)}`
      return undefined
    }
    return threads.map((thread) => {
      const note = noteOf(thread)
      return note === undefined ? thread : { ...thread, anchorNote: note }
    })
  }, [threads, targets])

  const draftSubmitted = (threadId: unknown) => {
    setDraft(null)
    setSelectionAction(null)
    setPicking(false)
    document.getSelection()?.removeAllRanges()
    if (typeof threadId === 'string') activateThreadFromPage(threadId)
  }

  return (
    <div ref={dockRootRef} data-comments-dock="">
      {!sidebarOpen && (
        <div className="docsite-comments-dock">
          {writable && (
            <button
              type="button"
              data-comment-picking-toggle=""
              aria-pressed={picking}
              title="批注模式：点正文里的一个元素批它，或选中几个字批这段字；Esc 退出"
              className={picking ? 'docsite-dock-button docsite-dock-button-active' : 'docsite-dock-button'}
              onClick={() => setPicking(!picking)}
            >
              {picking ? '批注中 · Esc 退出' : '批注'}
            </button>
          )}
          <button type="button" data-comment-dock-open="" className="docsite-dock-button" onClick={() => changeSidebarOpen(true)}>
            评论{threads.length > 0 ? ` ${threads.length}` : ''}
          </button>
        </div>
      )}
      {sidebarOpen && (
        <aside data-comments-panel="" aria-label="本页评论" className="docsite-comments-panel">
          <div className="docsite-comments-panel-bar">
            {writable ? (
              <button
                type="button"
                data-comment-picking-toggle=""
                aria-pressed={picking}
                title="批注模式：点正文里的一个元素批它，或选中几个字批这段字；Esc 退出"
                className={picking ? 'docsite-panel-button docsite-panel-button-active' : 'docsite-panel-button'}
                onClick={() => setPicking(!picking)}
              >
                {picking ? '批注中 · Esc 退出' : '批注'}
              </button>
            ) : null}
            <button type="button" data-comment-panel-close="" aria-label="收起评论栏" className="docsite-panel-button" onClick={() => changeSidebarOpen(false)}>
              ✕
            </button>
          </div>
          <CommentsSidebar
            pagePath={pagePath}
            action={action}
            threads={threadsWithNotes}
            access={access}
            BodyComponent={BodyComponent}
            AvatarComponent={AvatarComponent}
            activeThreadId={activeThreadId}
            onThreadActivate={goToThread}
          />
        </aside>
      )}
      {picking && hovered && !draft && (
        <div data-comment-hover="" className="docsite-picking-hover" style={{ position: 'fixed', ...hovered.box }}>
          <span className="docsite-picking-hover-label">{hovered.label}</span>
        </div>
      )}
      {picking && selectionAction && !draft && (
        <button
          type="button"
          data-comment-quote-button=""
          className="docsite-selection-button"
          style={{ position: 'fixed', top: selectionAction.top, left: selectionAction.left }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const anchor = selectionAction.anchor
            setDraft({
              kind: 'text',
              anchorValue: serializeTextAnchor(anchor),
              label: quoteNote(anchor.quote, ''),
              top: selectionAction.top + 38,
              left: clampToViewport(selectionAction.left, 360),
            })
            setSelectionAction(null)
          }}
        >
          批这段字
        </button>
      )}
      {draft && writable && <DraftForm draft={draft} pagePath={pagePath} action={action} onDone={draftSubmitted} onCancel={() => setDraft(null)} />}
    </div>
  )
}

function DraftForm({
  draft,
  pagePath,
  action,
  onDone,
  onCancel,
}: {
  draft: Draft
  pagePath: string
  action: string
  onDone: (threadId: unknown) => void
  onCancel: () => void
}) {
  const fetcher = useFetcher()
  const error = errorOf(fetcher.data)
  useEffect(() => {
    const data = fetcher.data as { ok?: boolean; threadId?: unknown } | undefined
    if (fetcher.state === 'idle' && data?.ok === true) onDone(data.threadId)
  }, [fetcher.state, fetcher.data, onDone])
  return (
    <fetcher.Form
      method="post"
      action={action}
      data-comment-draft=""
      className="docsite-comment-draft"
      style={{ position: 'fixed', top: draft.top, left: draft.left }}
    >
      <p className="docsite-draft-quote">{draft.label}</p>
      <input type="hidden" name="intent" value="create-thread" />
      <input type="hidden" name="page" value={pagePath} />
      <input type="hidden" name="anchor" value={draft.anchorValue} />
      <textarea name="body" required rows={3} autoFocus placeholder="写评论（支持 MDX）" />
      <div className="docsite-form-row">
        <span />
        <span className="docsite-draft-actions">
          <button type="button" className="docsite-draft-cancel" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="docsite-draft-submit" disabled={fetcher.state !== 'idle'}>
            {fetcher.state !== 'idle' ? '写入中…' : '发评论'}
          </button>
        </span>
      </div>
      {error ? <p data-action-error>{error}</p> : null}
    </fetcher.Form>
  )
}
