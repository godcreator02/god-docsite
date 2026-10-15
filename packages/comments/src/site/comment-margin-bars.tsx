/**
 * 被批元素在正文栏左边外侧的竖黄条：元素本身不铺底色、不加边框，黄条和它上下对齐。
 * 经 portal 挂在 body 上、按文档坐标定位（带 data-comments-layer），不受正文容器裁边影响，图片、SVG、canvas 也一样画得出。
 * 一个元素上有几串、被批的元素互相套着时并排画：外层的靠外，里层与同一元素上后来的串往里错开。
 * 批注模式下正在写的草稿批的元素同样画一道，是蓝色、不能点，排在那个元素已有的串后面。样式在本包 template/styles.css
 */
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { commentTargetLabelOf } from './browser/index.js'

/** 黄条和正文栏左边之间的空隙（最外一道） */
const marginBarGap = 16
/** 并排的黄条之间错开多少 */
const laneStep = 6
/** 最多错开几道：再多就叠在最里一道上，不压进正文 */
const maxLane = 2

/** 一串批的是正文里的这个元素 */
export type CommentedElement = { threadId: string; element: Element }

/** 要画的一道：一串评论的，或草稿的（草稿没有串 id） */
type BarSource = { kind: 'thread'; threadId: string; element: Element } | { kind: 'draft'; element: Element }

type MarginBar = { source: BarSource; label: string; top: number; left: number; height: number }

/** 第几道：套着它的被批元素有几个，加上同一元素上排在它前面的有几道 */
function laneOf(sources: readonly BarSource[], index: number): number {
  const { element } = sources[index]!
  const enclosing = sources.filter((other) => other.element !== element && other.element.contains(element)).length
  const earlierOnSameElement = sources.slice(0, index).filter((other) => other.element === element).length
  return Math.min(enclosing + earlierOnSameElement, maxLane)
}

/** 每一道的文档坐标；元素现在没有高度（藏起来了）就不画 */
function marginBarsOf(sources: readonly BarSource[], scope: Element): MarginBar[] {
  const scopeLeft = scope.getBoundingClientRect().left + window.scrollX
  return sources.flatMap((source, index) => {
    const rect = source.element.getBoundingClientRect()
    if (rect.height === 0) return []
    const left = Math.max(2, scopeLeft - marginBarGap + laneOf(sources, index) * laneStep)
    return [{ source, label: commentTargetLabelOf(source.element), top: rect.top + window.scrollY, left, height: rect.height }]
  })
}

export interface CommentMarginBarsProps {
  commented: readonly CommentedElement[]
  /** 批注模式下正在写的草稿批的元素；没有草稿、或草稿批的是一段字时是 null */
  draftElement: Element | null
  scope: Element
  /** 正文里的标记重画过一轮就变：元素可能挪了位置 */
  layoutVersion: number
  openThreadId: string | null
  /** 鼠标停在哪一串的被批元素上：对应的黄条跟着加深 */
  hoveredThreadId: string | null
  onToggleThread: (threadId: string) => void
}

function ThreadBar({ bar, threadId, active, hovered, onToggleThread }: { bar: MarginBar; threadId: string; active: boolean; hovered: boolean; onToggleThread: (threadId: string) => void }) {
  return (
    <button
      type="button"
      data-comment-margin-bar={threadId}
      {...(active ? { 'data-active': '' } : {})}
      {...(hovered ? { 'data-hovered': '' } : {})}
      className="docsite-comment-margin-bar"
      style={{ top: bar.top, left: bar.left, height: bar.height }}
      title={`评论：${bar.label}`}
      aria-label={`打开这一串评论：${bar.label}`}
      onClick={() => onToggleThread(threadId)}
    />
  )
}

export function CommentMarginBars({ commented, draftElement, scope, layoutVersion, openThreadId, hoveredThreadId, onToggleThread }: CommentMarginBarsProps) {
  const [bars, setBars] = useState<MarginBar[]>([])
  useLayoutEffect(() => {
    const sources: BarSource[] = [...commented.map(({ threadId, element }) => ({ kind: 'thread' as const, threadId, element })), ...(draftElement ? [{ kind: 'draft' as const, element: draftElement }] : [])]
    const place = () => setBars(marginBarsOf(sources, scope))
    place()
    const observer = new ResizeObserver(place)
    observer.observe(scope)
    for (const { element } of sources) observer.observe(element)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [commented, draftElement, scope, layoutVersion])
  return createPortal(
    <div data-comments-layer="" data-comment-margin-bars="">
      {bars.map((bar) =>
        bar.source.kind === 'thread' ? (
          <ThreadBar key={bar.source.threadId} bar={bar} threadId={bar.source.threadId} active={bar.source.threadId === openThreadId} hovered={bar.source.threadId === hoveredThreadId} onToggleThread={onToggleThread} />
        ) : (
          <span key="draft" data-comment-margin-bar-draft="" className="docsite-comment-margin-bar docsite-comment-margin-bar-draft" style={{ top: bar.top, left: bar.left, height: bar.height }} />
        ),
      )}
    </div>,
    document.body,
  )
}
