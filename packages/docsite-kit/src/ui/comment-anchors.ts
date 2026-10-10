import { imageCharacter, type CommentBlockKind, type CommentRange, type CommentThreadFrontmatter } from '../comments.js'
import type { RangeMapper } from '../comment-ranges.js'

/** 评论自己放进页面的东西（插进正文的评论数按钮等）都带这个属性；取页面文字时跳过它们 */
export const commentUiAttribute = 'data-comment-ui'

type TextPiece = { node: Text | HTMLImageElement; start: number }

/**
 * 正文显示出来的全部文字：文字节点照原样，一张图片记成一个 imageCharacter，评论自己的按钮不算。
 * pieces 记下每个文字节点、每张图片从第几个字开始，用来在文字位置与 DOM 位置之间换算
 */
export type PageText = { text: string; pieces: TextPiece[] }

function lengthOf(node: Text | HTMLImageElement) {
  return node.nodeType === Node.TEXT_NODE ? (node as Text).length : 1
}

export function pageTextOf(scope: Node): PageText {
  const walker = scope.ownerDocument!.createTreeWalker(scope, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT
      const element = node as Element
      if (element.hasAttribute(commentUiAttribute)) return NodeFilter.FILTER_REJECT
      return element.tagName === 'IMG' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    },
  })
  const pieces: TextPiece[] = []
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    pieces.push({ node: node as Text | HTMLImageElement, start: text.length })
    text += node.nodeType === Node.TEXT_NODE ? (node as Text).data : imageCharacter
  }
  return { text, pieces }
}

/** 页面文字里第 start 到 end 个字在 DOM 里的范围；图片整张算进去 */
export function rangeOfOffsets({ pieces }: PageText, start: number, end: number): Range {
  const first = pieces.find((piece) => piece.start <= start && start < piece.start + lengthOf(piece.node))
  const last = pieces.findLast((piece) => piece.start < end && end <= piece.start + lengthOf(piece.node))
  if (!first || !last) throw new Error(`页面文字里没有第 ${start} 到 ${end} 个字`)
  const range = first.node.ownerDocument.createRange()
  if (first.node.nodeType === Node.TEXT_NODE) range.setStart(first.node, start - first.start)
  else range.setStartBefore(first.node)
  if (last.node.nodeType === Node.TEXT_NODE) range.setEnd(last.node, end - last.start)
  else range.setEndAfter(last.node)
  return range
}

/** DOM 里某个位置前面有几个字 */
function offsetOfPoint({ pieces }: PageText, container: Node, offset: number) {
  if (pieces.length === 0) return 0
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

/** 选中的一段换成页面文字里的位置 */
export function offsetsOfRange(pageText: PageText, range: Range): CommentRange | undefined {
  const start = offsetOfPoint(pageText, range.startContainer, range.startOffset)
  const end = offsetOfPoint(pageText, range.endContainer, range.endOffset)
  return start < end ? [start, end] : undefined
}

function visibleTextOf(element: Element) {
  return pageTextOf(element).text.replaceAll(imageCharacter, '')
}

const textBlockTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'HR'])

/** 正文里一个顶层元素算哪类块；段落、标题、列表、引用这些是文字，用选中文字来批，返回 undefined */
function blockKindOf(element: Element): CommentBlockKind | undefined {
  if (textBlockTags.has(element.tagName) || element.hasAttribute(commentUiAttribute)) return undefined
  const hasText = visibleTextOf(element).trim() !== ''
  if (element.tagName === 'IMG' || (element.querySelector('img') && !hasText)) return 'image'
  if (element.tagName === 'P') return undefined
  if (element.querySelector('pre')) return 'code'
  if (element.querySelector('table')) return 'table'
  return 'component'
}

export type PageBlock = { element: HTMLElement; kind: CommentBlockKind }

/** 正文里能整块评论的块（正文的顶层元素），按出现顺序 */
export function blocksOf(scope: Element): PageBlock[] {
  return [...scope.children].flatMap((element) => {
    const kind = blockKindOf(element)
    return kind ? [{ element: element as HTMLElement, kind }] : []
  })
}

/** 正文里某个元素所在的那一块；它不是能整块评论的块时返回 undefined */
export function blockContaining(blocks: readonly PageBlock[], target: Node) {
  return blocks.find((block) => block.element.contains(target))
}

/** 一整块在页面文字里的位置：从它的第一个字（或图片）到最后一个；块里没有文字也没有图片时返回 undefined */
export function blockOffsetsOf({ pieces }: PageText, element: Element): CommentRange | undefined {
  const inside = pieces.filter((piece) => element.contains(piece.node))
  if (inside.length === 0) return undefined
  const last = inside.at(-1)!
  return [inside[0]!.start, last.start + lengthOf(last.node)]
}

/**
 * 评论批的位置：一段文字（Range）、一整块（元素）、整页，或者原文找不到了。
 * changed 表示被批的那段在快照之后被改过（首尾还对得上）
 */
export type ThreadPlace = { type: 'text'; range: Range; changed: boolean } | { type: 'block'; element: HTMLElement; changed: boolean } | { type: 'page' } | { type: 'missing' }

export function placeOfThread(pageText: PageText, blocks: readonly PageBlock[], head: CommentThreadFrontmatter, snapshot: string | undefined, mapRange: RangeMapper): ThreadPlace {
  if (!head.range) return { type: 'page' }
  if (snapshot === undefined) throw new Error('批一段文字或一整块的评论串要传快照')
  const mapped = mapRange(snapshot, pageText.text, head.range)
  if (!mapped) return { type: 'missing' }
  if (head.quote !== undefined) return { type: 'text', range: rangeOfOffsets(pageText, mapped.start, mapped.end), changed: mapped.changed }
  // 整块：推算出的位置开头落在哪一块，那一块还得是同一类
  const firstPiece = pageText.pieces.find((piece) => piece.start <= mapped.start && mapped.start < piece.start + lengthOf(piece.node))
  const block = firstPiece && blockContaining(blocks, firstPiece.node)
  return block && block.kind === head.block ? { type: 'block', element: block.element, changed: mapped.changed } : { type: 'missing' }
}

const blockKindNames: Record<CommentBlockKind, string> = { image: '图片', code: '代码块', table: '表格', component: '组件' }
const labelTextLength = 40

function readableText(text: string) {
  return text.replaceAll(imageCharacter, ' ').replace(/\s+/g, ' ').trim()
}

/** 评论批的是什么，写给人看：「原文」、整块的类别加它开头的字，或「整页」 */
export function anchorLabelOf(head: Pick<CommentThreadFrontmatter, 'quote' | 'block' | 'range'>, snapshot: string | undefined) {
  if (head.quote !== undefined) return `「${readableText(head.quote)}」`
  if (head.block !== undefined) {
    const text = head.range && snapshot !== undefined ? readableText(snapshot.slice(...head.range)).slice(0, labelTextLength) : ''
    return text === '' ? `整块${blockKindNames[head.block]}` : `${blockKindNames[head.block]}「${text}」`
  }
  return '整页'
}
