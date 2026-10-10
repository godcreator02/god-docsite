import { locateQuote, quoteContextLength, type CommentBlockAnchor, type CommentBlockKind, type CommentThreadFrontmatter } from '../comments.js'

/** 评论自己放进页面的东西（插进正文的评论数按钮等）都带这个属性；找原文、取文字时跳过它们 */
export const commentUiAttribute = 'data-comment-ui'

function isInsideCommentUi(node: Node) {
  return node.parentElement?.closest(`[${commentUiAttribute}]`) != null
}

/** 正文里的文字节点，跳过评论自己的按钮 */
function textWalkerOf(root: Node) {
  return root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (isInsideCommentUi(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
}

/** 元素里的文字，不算评论自己的按钮 */
function visibleTextOf(element: Node) {
  const walker = textWalkerOf(element)
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) text += (node as Text).data
  return text
}

/** 正文的全部文字，以及每个文字节点从第几个字开始：文字位置与 DOM 位置互相换算 */
type TextIndex = { text: string; textNodes: Text[]; startOffsets: number[] }

function indexText(scope: Node): TextIndex {
  const walker = textWalkerOf(scope)
  const textNodes: Text[] = []
  const startOffsets: number[] = []
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    startOffsets.push(text.length)
    textNodes.push(node as Text)
    text += (node as Text).data
  }
  return { text, textNodes, startOffsets }
}

function rangeOfOffsets({ textNodes, startOffsets }: TextIndex, start: number, end: number) {
  const nodeAt = (offset: number, isEnd: boolean) => {
    let index = textNodes.length - 1
    while (index > 0 && (isEnd ? startOffsets[index]! >= offset : startOffsets[index]! > offset)) index--
    return { node: textNodes[index]!, offset: offset - startOffsets[index]! }
  }
  const from = nodeAt(start, false)
  const to = nodeAt(end, true)
  const range = from.node.ownerDocument.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  return range
}

/** 文字评论批的原文在正文里的位置；找不到时返回 undefined */
export function rangeOfQuote(scope: Node, quote: string, prefix?: string, suffix?: string): Range | undefined {
  const index = indexText(scope)
  const start = locateQuote(index.text, quote, prefix, suffix)
  return start === undefined ? undefined : rangeOfOffsets(index, start, start + quote.length)
}

/** 正文里某个位置前面有几个字（不算评论自己的按钮） */
function textOffsetOf({ textNodes, startOffsets }: TextIndex, container: Node, offset: number) {
  const before = container.ownerDocument!.createRange()
  before.setStart(textNodes[0] ?? container, 0)
  before.setEnd(container, offset)
  let count = 0
  textNodes.forEach((node, index) => {
    if (!before.intersectsNode(node)) return
    count = startOffsets[index]! + (node === before.endContainer ? before.endOffset : node.length)
  })
  return count
}

/** 选中的一段文字换成文字评论的 anchor：原文（不含评论按钮里的字）与前后各几个字 */
export function quoteAnchorOfRange(scope: Node, range: Range) {
  const index = indexText(scope)
  const { text } = index
  const start = textOffsetOf(index, range.startContainer, range.startOffset)
  const quote = text.slice(start, textOffsetOf(index, range.endContainer, range.endOffset))
  return {
    quote,
    quotePrefix: text.slice(Math.max(0, start - quoteContextLength), start),
    quoteSuffix: text.slice(start + quote.length, start + quote.length + quoteContextLength),
  }
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

const blockTextLength = 40

/** 块的文字开头：图片取 alt；代码块与表格只取代码、表格本身的文字，不带标题栏上「复制」这类按钮的字 */
function blockTextOf(element: Element, kind: CommentBlockKind) {
  if (kind === 'image') return (element.tagName === 'IMG' ? (element as HTMLImageElement) : element.querySelector('img'))?.alt ?? ''
  const textElement = kind === 'code' ? element.querySelector('pre') : kind === 'table' ? element.querySelector('table') : element
  return (textElement ? visibleTextOf(textElement) : '').replace(/\s+/g, ' ').trim().slice(0, blockTextLength)
}

export type PageBlock = { element: HTMLElement; anchor: CommentBlockAnchor }

/** 正文里能整块评论的块，按出现顺序；每块记下它前面最近的二到四级标题、在这个标题下同类块里排第几 */
export function blocksOf(scope: Element): PageBlock[] {
  const blocks: PageBlock[] = []
  let heading = ''
  const countOfKind = new Map<CommentBlockKind, number>()
  for (const element of scope.children) {
    if (/^H[2-4]$/.test(element.tagName)) {
      heading = element.id
      countOfKind.clear()
      continue
    }
    const kind = blockKindOf(element)
    if (!kind) continue
    const index = (countOfKind.get(kind) ?? 0) + 1
    countOfKind.set(kind, index)
    blocks.push({ element: element as HTMLElement, anchor: { kind, heading, index, text: blockTextOf(element, kind) } })
  }
  return blocks
}

/** 正文里某个元素所在的那一块（正文的顶层元素）；它不是能整块评论的块时返回 undefined */
export function blockContaining(blocks: readonly PageBlock[], target: Node) {
  return blocks.find((block) => block.element.contains(target))
}

function sameBlock(a: CommentBlockAnchor, b: CommentBlockAnchor) {
  return a.kind === b.kind && a.heading === b.heading && a.index === b.index && a.text === b.text
}

/** 评论批的位置：一段文字（Range）、一整块（元素）、整页，或者原文找不到了 */
export type ThreadPlace = { type: 'text'; range: Range } | { type: 'block'; element: HTMLElement } | { type: 'page' } | { type: 'missing' }

export function placeOfThread(scope: Element, blocks: readonly PageBlock[], head: CommentThreadFrontmatter): ThreadPlace {
  if (head.quote !== undefined) {
    const range = rangeOfQuote(scope, head.quote, head.quotePrefix, head.quoteSuffix)
    return range ? { type: 'text', range } : { type: 'missing' }
  }
  if (head.block !== undefined) {
    const block = blocks.find((candidate) => sameBlock(candidate.anchor, head.block!))
    return block ? { type: 'block', element: block.element } : { type: 'missing' }
  }
  return { type: 'page' }
}

const blockKindNames: Record<CommentBlockKind, string> = { image: '图片', code: '代码块', table: '表格', component: '组件' }

/** 评论批的是什么，写给人看：「原文」、整块的类别，或「整页」 */
export function anchorLabelOf(head: Pick<CommentThreadFrontmatter, 'quote' | 'block'>) {
  if (head.quote !== undefined) return `「${head.quote}」`
  if (head.block !== undefined) return head.block.text === '' ? `整块${blockKindNames[head.block.kind]}` : `${blockKindNames[head.block.kind]}「${head.block.text}」`
  return '整页'
}
