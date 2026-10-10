import { Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { CommentEntry, CommentThread } from '../comments.js'
import { placeCards } from './comment-placement.js'

/** 页面正文的容器带上这个属性，评论栏在它里面找被批的原文：<DocsBody {...commentScopeProps}> */
export const commentScopeAttribute = 'data-comment-scope'
export const commentScopeProps = { [commentScopeAttribute]: '' }

/** 原文高亮用 CSS Custom Highlight API，不改正文的 DOM；样式在 styles.css 的 ::highlight() 里 */
const quoteHighlight = 'docsite-comment'
const activeQuoteHighlight = 'docsite-comment-active'

const cardGap = 12

export type CommentViewProps<Entry extends CommentEntry> = {
  threads: ReadonlyArray<CommentThread<Entry>>
  /** 渲染一条评论的正文；项目在这里把 MDX 组件传给编译好的正文 */
  renderBody: (entry: Entry) => ReactNode
}

/** 正文里第一处和 quote 一字不差的文字；跨几个元素也找得到（如一半加粗） */
export function rangeOfQuote(scope: Node, quote: string): Range | undefined {
  const document = scope.ownerDocument!
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  const startOffsets: number[] = []
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    startOffsets.push(text.length)
    textNodes.push(node as Text)
    text += (node as Text).data
  }
  const start = text.indexOf(quote)
  if (start === -1) return undefined
  const end = start + quote.length
  const nodeAt = (offset: number, isEnd: boolean) => {
    let index = textNodes.length - 1
    while (index > 0 && (isEnd ? startOffsets[index]! >= offset : startOffsets[index]! > offset)) index--
    return { node: textNodes[index]!, offset: offset - startOffsets[index]! }
  }
  const from = nodeAt(start, false)
  const to = nodeAt(end, true)
  const range = document.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  return range
}

function paintHighlights(openRanges: Range[], activeRange: Range | undefined) {
  CSS.highlights.set(quoteHighlight, new Highlight(...openRanges))
  if (activeRange) CSS.highlights.set(activeQuoteHighlight, new Highlight(activeRange))
  else CSS.highlights.delete(activeQuoteHighlight)
}

function clearHighlights() {
  CSS.highlights.delete(quoteHighlight)
  CSS.highlights.delete(activeQuoteHighlight)
}

function containsPoint(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

const timeFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function CommentItem<Entry extends CommentEntry>({ entry, renderBody, badge }: { entry: Entry; renderBody: (entry: Entry) => ReactNode; badge?: ReactNode }) {
  return (
    <div>
      <header className="flex flex-wrap items-baseline gap-x-2 text-xs text-fd-muted-foreground">
        <span className="font-medium text-fd-foreground">{entry.author}</span>
        {/* 按看的人所在时区显示，服务端渲染出的可能不同 */}
        <time dateTime={entry.createdAt} suppressHydrationWarning>
          {timeFormat.format(new Date(entry.createdAt))}
        </time>
        {badge}
      </header>
      <div className="prose prose-no-margin mt-1.5 text-sm">
        <Suspense fallback={<p className="text-fd-muted-foreground">正在加载……</p>}>{renderBody(entry)}</Suspense>
      </div>
    </div>
  )
}

type ThreadCardProps<Entry extends CommentEntry> = {
  thread: CommentThread<Entry>
  renderBody: (entry: Entry) => ReactNode
  active: boolean
  /** 卡片上方写出被批的原文：卡片不挨着原文时（窄屏的评论列表、原文找不到了）才写 */
  quoteShown: 'none' | 'quote' | 'not-found'
  onActivate?: () => void
  style?: CSSProperties
  ref?: Ref<HTMLElement>
}

function ThreadCard<Entry extends CommentEntry>({ thread, renderBody, active, quoteShown, onActivate, style, ref }: ThreadCardProps<Entry>) {
  const { head, replies } = thread
  const resolved = head.status === 'resolved'
  const frame = active ? 'border-fd-primary shadow-lg' : 'shadow-sm'
  return (
    <article
      ref={ref}
      style={style}
      onClick={onActivate}
      data-comment-thread={thread.id}
      className={`rounded-xl border bg-fd-card p-3 text-fd-card-foreground transition-[top,box-shadow,border-color] duration-200 ${frame} ${resolved ? 'opacity-60' : ''}`}
    >
      {quoteShown !== 'none' && head.quote !== undefined && (
        <p className="mb-2 border-s-2 ps-2 text-xs text-fd-muted-foreground">
          {quoteShown === 'not-found' ? '原文找不到了：' : ''}
          {head.quote}
        </p>
      )}
      <CommentItem entry={head} renderBody={renderBody} badge={resolved && <span className="rounded bg-fd-muted px-1.5">已解决</span>} />
      {replies.map((reply) => (
        <div key={reply.info.path} className="mt-3 border-t pt-3">
          <CommentItem entry={reply} renderBody={renderBody} />
        </div>
      ))}
    </article>
  )
}

type Placement = { tops: ReadonlyMap<string, number>; quoteNotFound: ReadonlySet<string>; height: number }

function samePlacement(a: Placement, b: Placement) {
  if (a.height !== b.height || a.tops.size !== b.tops.size || a.quoteNotFound.size !== b.quoteNotFound.size) return false
  for (const [id, top] of a.tops) if (b.tops.get(id) !== top) return false
  for (const id of a.quoteNotFound) if (!b.quoteNotFound.has(id)) return false
  return true
}

/**
 * 宽屏的评论栏：放在正文右边那一列、目录窄条的左边（见 docsPagePropsWithSideColumn），跟着正文一起滚动。
 * 每张卡片对齐它批的原文，原文高亮；点卡片或点高亮的原文选中这个评论串。批整页的评论排在正文顶端
 */
export function CommentColumn<Entry extends CommentEntry>({ threads, renderBody }: CommentViewProps<Entry>) {
  const columnRef = useRef<HTMLDivElement>(null)
  const cardElements = useRef(new Map<string, HTMLElement>())
  const resizeObserver = useRef<ResizeObserver | undefined>(undefined)
  const [activeId, setActiveId] = useState<string>()
  const [placement, setPlacement] = useState<Placement>({ tops: new Map(), quoteNotFound: new Set(), height: 0 })

  useEffect(() => {
    const column = columnRef.current!
    const scope = document.querySelector<HTMLElement>(`[${commentScopeAttribute}]`)
    if (!scope) throw new Error(`评论栏找不到正文：页面正文的容器要带 ${commentScopeAttribute} 属性，如 <DocsBody {...commentScopeProps}>`)
    const rangeOfThread = new Map<string, Range>()
    let frame = 0

    const measure = () => {
      rangeOfThread.clear()
      for (const thread of threads) {
        if (thread.head.quote === undefined) continue
        const range = rangeOfQuote(scope, thread.head.quote)
        if (range) rangeOfThread.set(thread.id, range)
      }
      const openRanges = threads.filter((thread) => thread.head.status === 'open').flatMap((thread) => rangeOfThread.get(thread.id) ?? [])
      paintHighlights(openRanges, activeId === undefined ? undefined : rangeOfThread.get(activeId))
      const columnTop = column.getBoundingClientRect().top
      const scopeTop = scope.getBoundingClientRect().top - columnTop
      const cards = threads.map((thread) => {
        const range = rangeOfThread.get(thread.id)
        return { id: thread.id, wantedTop: range ? range.getBoundingClientRect().top - columnTop : scopeTop, height: cardElements.current.get(thread.id)?.offsetHeight ?? 0 }
      })
      const tops = placeCards(cards, activeId, cardGap)
      const next: Placement = {
        tops,
        quoteNotFound: new Set(threads.filter((thread) => thread.head.quote !== undefined && !rangeOfThread.has(thread.id)).map((thread) => thread.id)),
        height: Math.max(0, ...cards.map((card) => tops.get(card.id)! + card.height)),
      }
      setPlacement((current) => (samePlacement(current, next) ? current : next))
    }
    const measureNextFrame = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const activateFromQuote = (event: MouseEvent) => {
      for (const [id, range] of rangeOfThread) {
        if ([...range.getClientRects()].some((rect) => containsPoint(rect, event.clientX, event.clientY))) {
          setActiveId(id)
          return
        }
      }
    }

    const observer = new ResizeObserver(measureNextFrame)
    observer.observe(scope)
    for (const element of cardElements.current.values()) observer.observe(element)
    resizeObserver.current = observer
    scope.addEventListener('click', activateFromQuote)
    window.addEventListener('resize', measureNextFrame)
    // 第一次直接排：标签页在后台时 requestAnimationFrame 不执行
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.current = undefined
      scope.removeEventListener('click', activateFromQuote)
      window.removeEventListener('resize', measureNextFrame)
      clearHighlights()
    }
  }, [threads, activeId])

  return (
    <div ref={columnRef} className="relative min-w-0 flex-1" style={{ minHeight: placement.height }}>
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          ref={(element: HTMLElement) => {
            cardElements.current.set(thread.id, element)
            resizeObserver.current?.observe(element)
            return () => {
              cardElements.current.delete(thread.id)
              resizeObserver.current?.unobserve(element)
            }
          }}
          thread={thread}
          renderBody={renderBody}
          active={thread.id === activeId}
          quoteShown={placement.quoteNotFound.has(thread.id) ? 'not-found' : 'none'}
          onActivate={() => setActiveId(thread.id)}
          style={{ position: 'absolute', insetInline: 0, top: placement.tops.get(thread.id) ?? 0, visibility: placement.tops.has(thread.id) ? 'visible' : 'hidden' }}
        />
      ))}
    </div>
  )
}

/** 窄屏放不下评论栏，评论串依次列在正文后面，每张卡片写出它批的原文 */
export function CommentList<Entry extends CommentEntry>({ threads, renderBody }: CommentViewProps<Entry>) {
  if (threads.length === 0) return null
  return (
    <section className="mt-8 flex flex-col gap-3 xl:hidden">
      <h2 className="text-lg font-semibold">评论</h2>
      {threads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} renderBody={renderBody} active={false} quoteShown="quote" />
      ))}
    </section>
  )
}
