/**
 * 一条评论串在当前正文里的落点：整页、页面元素、一段文字（划字），或找不到。
 * 元素锚点按 id 找（./annotate 分配的稳定 id 或标题已有的 id）；
 * 划字锚点按快照差异推算位置（./range-mapping），推算不出就是原文找不到了
 */
import type { CommentAnchor } from '../model.js'
import type { PageText } from './page-text.js'
import { rangeOfOffsets } from './page-text.js'
import type { RangeMapper } from './range-mapping.js'

export type ThreadTarget =
  | { kind: 'page' }
  | { kind: 'element'; element: Element }
  | { kind: 'text'; range: Range; changed: boolean; quote: string }
  /** 批的字还在正文里但当前看不见（收起的折叠块这类） */
  | { kind: 'hidden'; quote: string }
  | { kind: 'missing'; reason: 'broken-anchor' | 'element-id-gone' | 'text-unmapped' }

/**
 * 一段字看得见吗：收着的内容（display: none，或 hidden="until-found" 带来的 content-visibility: hidden）里的看不见。
 * 后者里的字照样排版、有框，只能用 checkVisibility 认；display: contents 的元素自己没有框，从它外面那层看。
 * checkVisibility 不存在（jsdom、旧浏览器）就当看得见
 */
function isRangeVisible(range: Range) {
  const start = range.startContainer
  let element = start instanceof Element ? start : start.parentElement
  while (element && getComputedStyle(element).display === 'contents') element = element.parentElement
  if (!element) return false
  if (typeof element.checkVisibility !== 'function') return true
  return element.checkVisibility()
}

export function targetOfThread(scope: Element, pageText: PageText, anchor: CommentAnchor, mapRange: RangeMapper): ThreadTarget {
  if (anchor.kind === 'page') return { kind: 'page' }
  if (anchor.kind === 'broken') return { kind: 'missing', reason: 'broken-anchor' }
  if (anchor.kind === 'element') {
    const element = scope.querySelector(`#${CSS.escape(anchor.id)}`)
    return element ? { kind: 'element', element } : { kind: 'missing', reason: 'element-id-gone' }
  }
  const mapped = mapRange(anchor.snapshot, pageText.text, [anchor.start, anchor.end])
  if (!mapped) return { kind: 'missing', reason: 'text-unmapped' }
  const range = rangeOfOffsets(pageText, mapped.start, mapped.end)
  if (!isRangeVisible(range)) return { kind: 'hidden', quote: anchor.quote }
  return { kind: 'text', range, changed: mapped.changed, quote: anchor.quote }
}
