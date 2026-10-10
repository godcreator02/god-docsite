import { commentAnchorAttribute, commentBlockAttribute, commentBlockWrapperClass, nthIndexOf, occurrenceIndexAt, type CommentThreadFrontmatter } from '../comments.js'

/** 评论自己放进页面的东西（插进正文的评论数按钮、卡片等）都带这个属性；找字、取文字时跳过它们 */
export const commentUiAttribute = 'data-comment-ui'

function isInsideCommentUi(node: Node) {
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest(`[${commentUiAttribute}]`) != null
}

/** 块里的文字节点，跳过评论自己的按钮 */
function textWalkerOf(root: Node) {
  return root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (isInsideCommentUi(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
}

/** 块的全部文字，以及每个文字节点从第几个字开始：文字位置与 DOM 位置互相换算 */
type TextIndex = { text: string; textNodes: Text[]; startOffsets: number[] }

function indexText(root: Node): TextIndex {
  const walker = textWalkerOf(root)
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

/** 块里某个位置前面有几个字（不算评论自己的按钮） */
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

/** 一块在网页上占的那个元素：代码块、表格、组件外面包的那层 div 是 display: contents，没有自己的框，取它里面那个 */
export function boxElementOf(block: HTMLElement): HTMLElement {
  if (!block.classList.contains(commentBlockWrapperClass)) return block
  const inner = block.firstElementChild
  if (!(inner instanceof HTMLElement)) throw new Error(`评论标记包的那一块是空的：${block.outerHTML.slice(0, 80)}`)
  return inner
}

/** 页面上一块能评论的内容：元素、源码位置（data-comment-block）、已有标记的 id */
export type CommentableBlock = { element: HTMLElement; spec: string; anchor: string | undefined }

/** 某个节点所在的那一块（最里层的）；不在正文里、在评论自己的界面里时返回 undefined */
export function blockContaining(scope: Element, node: Node): CommentableBlock | undefined {
  if (isInsideCommentUi(node)) return undefined
  const start = node instanceof Element ? node : node.parentElement
  const element = start?.closest<HTMLElement>(`[${commentBlockAttribute}]`)
  if (!element || !scope.contains(element)) return undefined
  return { element, spec: element.getAttribute(commentBlockAttribute)!, anchor: element.getAttribute(commentAnchorAttribute) ?? undefined }
}

/** 正文里带标记的块，按标记 id；同一个 id 出现两次时报错（MDX 页面编译时已查过，这里查 TSX 页面手放的） */
export function anchoredBlocksOf(scope: Element) {
  const blocks = new Map<string, HTMLElement>()
  for (const element of scope.querySelectorAll<HTMLElement>(`[${commentAnchorAttribute}]`)) {
    if (isInsideCommentUi(element)) continue
    const id = element.getAttribute(commentAnchorAttribute)!
    if (blocks.has(id)) throw new Error(`这一页有两个评论标记都是 ${id}：标记的 id 在一页里不能重复`)
    blocks.set(id, element)
  }
  return blocks
}

/** 选中的一段文字换成块里的 quote 与它是第几次出现；文字不在这一块里时返回 undefined */
export function quoteInBlock(block: HTMLElement, range: Range) {
  const index = indexText(block)
  const start = textOffsetOf(index, range.startContainer, range.startOffset)
  const quote = index.text.slice(start, textOffsetOf(index, range.endContainer, range.endOffset))
  if (quote.trim() === '') return undefined
  return { quote, quoteIndex: occurrenceIndexAt(index.text, quote, start) }
}

/**
 * 评论批的位置：块里的几个字（Range）、一整块（元素；quoteLost 表示批的那几个字在块里找不到了，退成整块显示）、整页，
 * 或者标记找不到了（块被删了）
 */
export type ThreadPlace =
  | { type: 'text'; block: HTMLElement; range: Range }
  | { type: 'block'; block: HTMLElement; quoteLost: boolean }
  | { type: 'page' }
  | { type: 'missing' }

export function placeOfThread(anchoredBlocks: ReadonlyMap<string, HTMLElement>, head: CommentThreadFrontmatter): ThreadPlace {
  if (head.anchor === undefined) return { type: 'page' }
  const block = anchoredBlocks.get(head.anchor)
  if (!block) return { type: 'missing' }
  if (head.quote === undefined) return { type: 'block', block, quoteLost: false }
  const index = indexText(block)
  const start = nthIndexOf(index.text, head.quote, head.quoteIndex!)
  if (start === undefined) return { type: 'block', block, quoteLost: true }
  return { type: 'text', block, range: rangeOfOffsets(index, start, start + head.quote.length) }
}

/** 一块是什么，写给人看 */
export function blockKindLabelOf(block: HTMLElement) {
  const box = boxElementOf(block)
  if (box.tagName === 'LI') return '列表项'
  if (box.tagName === 'P') return box.textContent?.trim() === '' && box.querySelector('img') ? '图片' : '段落'
  if (box.tagName === 'PRE' || box.querySelector('pre')) return '代码块'
  if (box.tagName === 'TABLE' || box.querySelector('table')) return '表格'
  return '组件'
}

const blockTextLength = 30

/** 一块的文字开头：代码块只取代码，不带标题栏上「复制」这类按钮的字；表格的单元格之间空一格；只有图片时取 alt */
function blockTextOf(block: HTMLElement) {
  const box = boxElementOf(block)
  const table = box.tagName === 'TABLE' ? box : box.querySelector('table')
  const raw = table ? [...table.querySelectorAll('th, td')].map((cell) => indexText(cell).text.trim()).join(' ') : indexText(box.querySelector('pre') ?? box).text
  const text = raw.replace(/\s+/g, ' ').trim()
  return (text === '' ? (box.querySelector('img')?.alt ?? '') : text).slice(0, blockTextLength)
}

/** 评论批的是什么，写给人看：「块里的那几个字」、哪一块，或「整页」 */
export function targetLabelOf(head: Pick<CommentThreadFrontmatter, 'anchor' | 'quote'>, block: HTMLElement | undefined) {
  if (head.quote !== undefined) return `「${head.quote}」`
  if (head.anchor === undefined) return '整页'
  if (!block) return `标记 ${head.anchor}`
  const text = blockTextOf(block)
  return text === '' ? `整块${blockKindLabelOf(block)}` : `${blockKindLabelOf(block)}「${text}」`
}
