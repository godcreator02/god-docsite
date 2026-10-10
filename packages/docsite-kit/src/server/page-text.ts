import { parse, type DefaultTreeAdapterTypes } from 'parse5'
import { atomicCharacter, commentScopeAttribute, commentUiAttribute, pageTextRoleOf } from '../page-text-rules.js'

type ParentNode = DefaultTreeAdapterTypes.ParentNode
type Element = DefaultTreeAdapterTypes.Element

function isElement(node: DefaultTreeAdapterTypes.Node): node is Element {
  return 'tagName' in node
}

function hasAttribute(element: Element, name: string) {
  return element.attrs.some((attribute) => attribute.name === name)
}

function classNamesOf(element: Element) {
  const value = element.attrs.find((attribute) => attribute.name === 'class')?.value ?? ''
  return value.split(/\s+/).filter((name) => name !== '')
}

/** 文档顺序里第一个带 data-comment-scope 的元素，和浏览器端 querySelector 取到的是同一个 */
function firstCommentScopeIn(parent: ParentNode): Element | undefined {
  for (const child of parent.childNodes) {
    if (!isElement(child)) continue
    if (hasAttribute(child, commentScopeAttribute)) return child
    const found = firstCommentScopeIn(child)
    if (found) return found
  }
  return undefined
}

/** <template> 的内容在 content 里、不在 childNodes 里，这里不走进去：和浏览器 DOM 的 childNodes 一致 */
function appendTextOf(parent: ParentNode, pieces: string[]) {
  for (const child of parent.childNodes) {
    if (child.nodeName === '#text') {
      pieces.push((child as DefaultTreeAdapterTypes.TextNode).value)
      continue
    }
    if (!isElement(child)) continue
    const role = pageTextRoleOf(child.tagName, classNamesOf(child), hasAttribute(child, commentUiAttribute))
    if (role === 'walk') appendTextOf(child, pieces)
    else if (role === 'atomic') pieces.push(atomicCharacter)
  }
}

/**
 * 一页 HTML 的页面文字：规则见 page-text-rules.ts，和浏览器端 pageTextOf 走 DOM 算出的一样。
 * HTML 里没有带 data-comment-scope 的正文容器时报错
 */
export function pageTextOfHtml(html: string): string {
  const scope = firstCommentScopeIn(parse(html))
  if (!scope) throw new Error(`HTML 里没有正文容器：正文容器要带 ${commentScopeAttribute} 属性，如 <DocsBody {...commentScopeProps}>`)
  const pieces: string[] = []
  appendTextOf(scope, pieces)
  return pieces.join('')
}
