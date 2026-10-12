/**
 * 页面文字：把正文 DOM 折叠成一个字符串，划字评论的位置（start/end）都在这份文字里数。
 * 拆自旧机制（07704c2 的 page-text-rules.ts 与 comment-anchors.ts 的换算部分）：
 * 文字节点顺序拼接；图片、SVG、公式这类整体元素记成一个原子字；只给读屏软件看的字不算。
 * 标注走查（./annotate）只往元素上加属性，不产生文字节点，不影响这份文字。
 */

/** 页面文字里一个整体元素（图片、SVG、公式等）记成这一个字 */
export const atomicCharacter = '￼'

/** 页面正文的容器带这个属性（骨架在 DocsBody 上加），评论在它里面找被批的原文 */
export const commentScopeAttribute = 'data-comment-scope'

/** 只给读屏软件看、屏幕上不显示的字（如标题旁「复制这一节的链接」）：不算，换了界面语言这份文字也不受影响 */
const screenReaderOnlyClass = 'sr-only'

/** 整个算一个字、里面的东西不算的元素：图片、画布、视频、iframe、SVG 图 */
const atomicTags = new Set(['img', 'svg', 'canvas', 'video', 'iframe'])

/** KaTeX 渲染出的公式：几十层 span，里面的字（还带一份给读屏软件的 MathML）对人没有意义，整个算一个 */
const formulaClass = 'katex'

/** 走正文时一个元素怎么算：跳过（连同里面的）、整个算一个字、照常走进去 */
export type PageTextRole = 'skip' | 'atomic' | 'walk'

export function pageTextRoleOf(tagName: string, classNames: readonly string[]): PageTextRole {
  if (classNames.includes(screenReaderOnlyClass)) return 'skip'
  if (atomicTags.has(tagName.toLowerCase()) || classNames.includes(formulaClass)) return 'atomic'
  return 'walk'
}

/** 页面文字里的一段：一个文字节点，或一个整个算一个字的元素（图片、SVG、公式等） */
type TextPiece = { node: Text | Element; start: number }

/**
 * 正文的全部文字。pieces 记下每一段从第几个字开始，
 * 用来在文字位置与 DOM 位置之间换算
 */
export type PageText = { text: string; pieces: TextPiece[] }

function lengthOf(node: Text | Element) {
  return node.nodeType === Node.TEXT_NODE ? (node as Text).length : 1
}

function endOf(piece: TextPiece) {
  return piece.start + lengthOf(piece.node)
}

function roleOf(element: Element) {
  return pageTextRoleOf(element.tagName, [...element.classList])
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
export function offsetsOfRange(pageText: PageText, range: Range): [start: number, end: number] | undefined {
  const start = offsetOfPoint(pageText, range.startContainer, range.startOffset, true)
  const end = offsetOfPoint(pageText, range.endContainer, range.endOffset, false)
  return start < end ? [start, end] : undefined
}

/** 把原子字换回空格、折叠空白后写给人看的字（引文标签用） */
export function readablePageText(text: string) {
  return text.replaceAll(atomicCharacter, ' ').replace(/\s+/g, ' ').trim()
}
