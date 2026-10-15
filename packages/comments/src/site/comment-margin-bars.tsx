/**
 * 被批元素在正文栏左边外侧的竖黄条：元素本身不铺底色、不加边框，黄条和它上下对齐。
 * 经 portal 挂在 body 上、按文档坐标定位（带 data-comments-layer），不受正文容器裁边影响，图片、SVG、canvas 也一样画得出。
 * 一个元素上有几串、被批的元素互相套着时并排画：外层的靠外，里层与同一元素上后来的串往里错开。样式在本包 template/styles.css
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

type MarginBar = { threadId: string; label: string; top: number; left: number; height: number }

/** 第几道：套着它的被批元素有几个，加上同一元素上排在它前面的串有几个 */
function laneOf(commented: readonly CommentedElement[], index: number): number {
  const { element } = commented[index]!
  const enclosing = commented.filter((other) => other.element !== element && other.element.contains(element)).length
  const earlierOnSameElement = commented.slice(0, index).filter((other) => other.element === element).length
  return Math.min(enclosing + earlierOnSameElement, maxLane)
}

/** 黄条的文档坐标；元素现在没有高度（藏起来了）就不画 */
function marginBarsOf(commented: readonly CommentedElement[], scope: Element): MarginBar[] {
  const scopeLeft = scope.getBoundingClientRect().left + window.scrollX
  return commented.flatMap(({ threadId, element }, index) => {
    const rect = element.getBoundingClientRect()
    if (rect.height === 0) return []
    const left = Math.max(2, scopeLeft - marginBarGap + laneOf(commented, index) * laneStep)
    return [{ threadId, label: commentTargetLabelOf(element), top: rect.top + window.scrollY, left, height: rect.height }]
  })
}

export interface CommentMarginBarsProps {
  commented: readonly CommentedElement[]
  scope: Element
  /** 正文里的标记重画过一轮就变：元素可能挪了位置 */
  layoutVersion: number
  openThreadId: string | null
  /** 鼠标停在哪一串的被批元素上：对应的黄条跟着加深 */
  hoveredThreadId: string | null
  onToggleThread: (threadId: string) => void
}

export function CommentMarginBars({ commented, scope, layoutVersion, openThreadId, hoveredThreadId, onToggleThread }: CommentMarginBarsProps) {
  const [bars, setBars] = useState<MarginBar[]>([])
  useLayoutEffect(() => {
    const place = () => setBars(marginBarsOf(commented, scope))
    place()
    const observer = new ResizeObserver(place)
    observer.observe(scope)
    for (const { element } of commented) observer.observe(element)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [commented, scope, layoutVersion])
  return createPortal(
    <div data-comments-layer="" data-comment-margin-bars="">
      {bars.map((bar) => (
        <button
          key={bar.threadId}
          type="button"
          data-comment-margin-bar={bar.threadId}
          {...(bar.threadId === openThreadId ? { 'data-active': '' } : {})}
          {...(bar.threadId === hoveredThreadId ? { 'data-hovered': '' } : {})}
          className="docsite-comment-margin-bar"
          style={{ top: bar.top, left: bar.left, height: bar.height }}
          title={`评论：${bar.label}`}
          aria-label={`打开这一串评论：${bar.label}`}
          onClick={() => onToggleThread(bar.threadId)}
        />
      ))}
    </div>,
    document.body,
  )
}
