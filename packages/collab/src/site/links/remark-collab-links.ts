import { isRealDate } from '../../core/journal.js'
import { calendarUrl, tasksPageUrl } from '../../core/layout.js'
import { repoLinkPrefix } from '../../core/repo-links.js'

/** mdast 里这里要读写的几项：链接节点与换上去的 MDX JSX 行内元素 */
type MdastNode = { type: string; url?: string; children?: MdastNode[] }
type JsxAttribute = { type: 'mdxJsxAttribute'; name: string; value: string }
type JsxTextElement = { type: 'mdxJsxTextElement'; name: string; attributes: JsxAttribute[]; children: MdastNode[] }

const recordHrefPattern = new RegExp(`^${tasksPageUrl}/([^/?#]+)$`)
const journalHrefPattern = new RegExp(`^${calendarUrl}/(\\d{4}-\\d{2}-\\d{2})$`)

/** 一个链接地址该换成哪个组件：任务与模块那一页、某一天的日志页、repo: 链接；都不是为 null */
function chipOf(url: string): { name: string; attribute: string; value: string } | null {
  const recordId = recordHrefPattern.exec(url)?.[1]
  if (recordId !== undefined) return { name: 'RecordLink', attribute: 'id', value: decodeURIComponent(recordId) }
  const date = journalHrefPattern.exec(url)?.[1]
  if (date !== undefined && isRealDate(date)) return { name: 'JournalLink', attribute: 'date', value: date }
  if (url.startsWith(repoLinkPrefix)) return { name: 'RepoLink', attribute: 'href', value: url }
  return null
}

function replaceLinks(node: MdastNode): void {
  if (node.children === undefined) return
  node.children = node.children.map((child) => {
    const chip = child.type === 'link' ? chipOf(child.url!) : null
    if (chip === null) {
      replaceLinks(child)
      return child
    }
    const element: JsxTextElement = {
      type: 'mdxJsxTextElement',
      name: chip.name,
      attributes: [{ type: 'mdxJsxAttribute', name: chip.attribute, value: chip.value }],
      children: child.children ?? [],
    }
    return element as MdastNode
  })
}

/**
 * remark 插件：正文里写成链接的 [文字](/tasks/<id>)、[](/calendar/<日期>)、[](repo:<仓>/<路径>) 换成
 * RecordLink、JournalLink、RepoLink 组件（链接文字留作组件的内容）。站点把它接进集合的 remarkPlugins，
 * 再把 collabMdxComponents 并进 MDX 的组件表
 */
export function remarkCollabLinks() {
  return (tree: MdastNode) => replaceLinks(tree)
}
