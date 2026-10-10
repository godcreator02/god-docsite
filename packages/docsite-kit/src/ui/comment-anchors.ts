import type { CommentElementKind, CommentRange, CommentThreadFrontmatter } from '../comments.js'
import type { RangeMapper } from '../comment-ranges.js'
import { atomicCharacter, commentUiAttribute, pageTextRoleOf } from '../page-text-rules.js'

export { commentUiAttribute }

/** 页面文字里的一段：一个文字节点，或一个整个算一个字的元素（图片、SVG、公式等） */
type TextPiece = { node: Text | Element; start: number }

/**
 * 正文的全部文字，规则见 page-text-rules.ts（服务端解析 HTML 时按同一份规则算）。
 * pieces 记下每一段从第几个字开始，用来在文字位置与 DOM 位置之间换算
 */
export type PageText = { text: string; pieces: TextPiece[] }

function lengthOf(node: Text | Element) {
  return node.nodeType === Node.TEXT_NODE ? (node as Text).length : 1
}

function endOf(piece: TextPiece) {
  return piece.start + lengthOf(piece.node)
}

function roleOf(element: Element) {
  return pageTextRoleOf(element.tagName, [...element.classList], element.hasAttribute(commentUiAttribute))
}

export function pageTextOf(scope: Node): PageText {
  const pieces: TextPiece[] = []
  let text = ''
  const walk = (parent: Node) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        pieces.push({ node: child as Text, start: text.length })
        text += (child as Text).data
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const role = roleOf(child as Element)
        if (role === 'skip') continue
        if (role === 'walk') {
          walk(child)
          continue
        }
        pieces.push({ node: child as Element, start: text.length })
        text += atomicCharacter
      }
    }
  }
  walk(scope)
  return { text, pieces }
}

/** 页面文字里第 start 到 end 个字在 DOM 里的范围；整个算一个字的元素整个算进去 */
export function rangeOfOffsets({ pieces }: PageText, start: number, end: number): Range {
  const first = pieces.find((piece) => piece.start <= start && start < endOf(piece))
  const last = pieces.findLast((piece) => piece.start < end && end <= endOf(piece))
  if (!first || !last) throw new Error(`页面文字里没有第 ${start} 到 ${end} 个字`)
  const range = first.node.ownerDocument.createRange()
  if (first.node.nodeType === Node.TEXT_NODE) range.setStart(first.node, start - first.start)
  else range.setStartBefore(first.node)
  if (last.node.nodeType === Node.TEXT_NODE) range.setEnd(last.node, end - last.start)
  else range.setEndAfter(last.node)
  return range
}

/** DOM 里某个位置前面有几个字；位置落在整个算一个字的元素里面时，开头算到它前面、结尾算到它后面 */
function offsetOfPoint({ pieces }: PageText, container: Node, offset: number, isStart: boolean) {
  if (pieces.length === 0) return 0
  const insideAtomic = pieces.find((piece) => piece.node.nodeType === Node.ELEMENT_NODE && piece.node.contains(container))
  if (insideAtomic) return isStart ? insideAtomic.start : endOf(insideAtomic)
  const before = container.ownerDocument!.createRange()
  before.setStartBefore(pieces[0]!.node)
  before.setEnd(container, offset)
  let count = 0
  for (const piece of pieces) {
    if (!before.intersectsNode(piece.node)) continue
    count = piece.start + (piece.node === container ? offset : lengthOf(piece.node))
  }
  return count
}

/** 选中的一段换成页面文字里的位置；什么字也没选到时返回 undefined */
export function offsetsOfRange(pageText: PageText, range: Range): CommentRange | undefined {
  const start = offsetOfPoint(pageText, range.startContainer, range.startOffset, true)
  const end = offsetOfPoint(pageText, range.endContainer, range.endOffset, false)
  return start < end ? [start, end] : undefined
}

/** 一个元素在页面文字里的位置：从它里面第一个字到最后一个；里面一个字也没有时返回 undefined */
export function elementOffsetsOf({ pieces }: PageText, element: Element): CommentRange | undefined {
  const inside = pieces.filter((piece) => element.contains(piece.node))
  if (inside.length === 0) return undefined
  return [inside[0]!.start, endOf(inside.at(-1)!)]
}

const atomicMediaSelector = 'img, svg, canvas, video, iframe'
const textBlockTags = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'DT', 'DD', 'BLOCKQUOTE', 'FIGCAPTION'])
/** 这些标签按行内显示时是一段文字里的几个字；被样式做成块（如整张卡片是一个 <a>）时算组件 */
const phrasingTags = new Set(['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'CODE', 'MARK', 'DEL', 'INS', 'SUB', 'SUP'])

function isTextElement(element: Element) {
  return textBlockTags.has(element.tagName) || (phrasingTags.has(element.tagName) && getComputedStyle(element).display === 'inline')
}

/** 一个元素算哪类，存进评论串的 element，找回位置时核对 */
export function elementKindOf(element: Element): CommentElementKind {
  if (element.classList.contains('katex')) return 'formula'
  if (element.matches(atomicMediaSelector)) return 'image'
  const hasText = (element.textContent ?? '').trim() !== ''
  if (!hasText && element.querySelector(atomicMediaSelector)) return 'image'
  if (element.tagName === 'PRE' || element.querySelector('pre')) return 'code'
  if (element.tagName === 'TABLE' || element.querySelector('table')) return 'table'
  if (isTextElement(element)) return 'text'
  return 'component'
}

/**
 * 批注模式下点到的是哪个元素：一般就是鼠标下面那个元素。公式整个算一个（KaTeX 渲染出来是几十层 span），
 * SVG 图整张算一个，代码块整块算一个（里面是一个个着色的 span）
 */
export function pickedElementOf(target: Element): Element {
  return target.closest('.katex') ?? target.closest('svg') ?? target.closest('figure:has(pre)') ?? target.closest('pre') ?? target
}

function isSameRange(a: CommentRange | undefined, b: CommentRange) {
  return a !== undefined && a[0] === b[0] && a[1] === b[1]
}

function containsRange(outer: CommentRange | undefined, inner: CommentRange) {
  return outer !== undefined && outer[0] <= inner[0] && inner[1] <= outer[1]
}

/**
 * 推算出的位置上，批的是哪个元素：先看正好整个是一个图片、公式这类整体元素的；否则从这段文字的公共祖先往上找同一类的元素。
 * 文字正好是这一段的几层元素里取最外层（批的时候点的是哪一层分不出来，外层框得全）；文字改过、对不上整段时取最近的一层
 */
function elementAt(scope: Element, pageText: PageText, range: CommentRange, kind: CommentElementKind): Element | undefined {
  const single = pageText.pieces.find((piece) => piece.start === range[0] && endOf(piece) === range[1] && piece.node.nodeType === Node.ELEMENT_NODE)
  if (single && elementKindOf(single.node as Element) === kind) return single.node as Element
  const common = rangeOfOffsets(pageText, ...range).commonAncestorContainer
  let nearestContaining: Element | undefined
  let outermostExact: Element | undefined
  for (let element = common instanceof Element ? common : common.parentElement; element && element !== scope; element = element.parentElement) {
    if (elementKindOf(element) !== kind) continue
    const offsets = elementOffsetsOf(pageText, element)
    if (isSameRange(offsets, range)) outermostExact = element
    else if (!nearestContaining && containsRange(offsets, range)) nearestContaining = element
  }
  return outermostExact ?? nearestContaining
}

/**
 * 评论批的位置：一段文字（Range）、一个元素、整页，或者原文找不到了。
 * changed 表示被批的那段在快照之后被改过（首尾还对得上）
 */
export type ThreadPlace =
  | { type: 'text'; range: Range; changed: boolean }
  | { type: 'element'; element: HTMLElement; range: Range; changed: boolean }
  | { type: 'page' }
  | { type: 'missing' }

export function placeOfThread(scope: Element, pageText: PageText, head: CommentThreadFrontmatter, snapshot: string | undefined, mapRange: RangeMapper): ThreadPlace {
  if (!head.range) return { type: 'page' }
  if (snapshot === undefined) throw new Error('批一段文字或一个元素的评论串要传快照')
  const mapped = mapRange(snapshot, pageText.text, head.range)
  if (!mapped) return { type: 'missing' }
  const range = rangeOfOffsets(pageText, mapped.start, mapped.end)
  if (head.quote !== undefined) return { type: 'text', range, changed: mapped.changed }
  const element = elementAt(scope, pageText, [mapped.start, mapped.end], head.element!)
  return element ? { type: 'element', element: element as HTMLElement, range, changed: mapped.changed } : { type: 'missing' }
}

const elementKindNames: Record<CommentElementKind, string> = { image: '图片', formula: '公式', code: '代码块', table: '表格', text: '文字', component: '组件' }
const labelTextLength = 40

function readableText(text: string) {
  return text.replaceAll(atomicCharacter, ' ').replace(/\s+/g, ' ').trim()
}

function labelOfKindAndText(kind: CommentElementKind, text: string) {
  const start = readableText(text).slice(0, labelTextLength)
  return start === '' ? elementKindNames[kind] : `${elementKindNames[kind]}「${start}」`
}

/** 页面上一个元素写给人看：类别加它开头的字 */
export function elementLabelOf(element: Element) {
  return labelOfKindAndText(elementKindOf(element), roleOf(element) === 'atomic' ? '' : pageTextOf(element).text)
}

/** 评论批的是什么，写给人看：「原文」、元素的类别加它开头的字，或「整页」 */
export function anchorLabelOf(head: Pick<CommentThreadFrontmatter, 'quote' | 'element' | 'range'>, snapshot: string | undefined) {
  if (head.quote !== undefined) return `「${readableText(head.quote)}」`
  if (head.element !== undefined) return labelOfKindAndText(head.element, head.range && snapshot !== undefined ? snapshot.slice(...head.range) : '')
  return '整页'
}
