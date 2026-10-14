import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

/** 站点目录下放日志页的文件夹 */
export const journalDirName = 'journal'

/** 日志页的文件：journal/<日期>.mdx */
export const journalFilePattern = /^(\d{4}-\d{2}-\d{2})\.mdx$/

/** YYYY-MM-DD 是不是真实存在的日期 */
export function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const day = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date
}

/** journal/ 里的一项不合规矩时的说法：只能是 <真实日期>.mdx，不放子文件夹与别的文件；合规矩为 null */
export function journalEntryProblemOf(entry: { name: string; isFile: boolean }): string | null {
  const file = `${journalDirName}/${entry.name}`
  if (!entry.isFile) return `${file}：${journalDirName}/ 里只放 <日期>.mdx，不放文件夹`
  const date = journalFilePattern.exec(entry.name)?.[1]
  if (date === undefined) return `${file}：日志页的文件名要是 YYYY-MM-DD.mdx`
  if (!isRealDate(date)) return `${file}：${date} 不是真实存在的日期`
  return null
}


/** 「日志里的进展」的一条：哪一天的日志里，引用了这条记录的那一段（纯文字） */
export type JournalMention = { date: string; text: string }

/** remark-mdx 解析出的 mdast 节点里这里要读的几项 */
type MdxNode = {
  type: string
  value?: string
  alt?: string | null
  name?: string | null
  attributes?: ReadonlyArray<{ type: string; name?: string; value?: unknown }>
  children?: MdxNode[]
}

/** 日志里引用一条任务或一个模块的写法：<RecordLink id="…" /> */
const recordLinkName = 'RecordLink'

/** 一段话的单位：段落与标题；列表项、引用、组件里的文字也落在它们里面 */
const phrasingContainerTypes = new Set(['paragraph', 'heading', 'tableCell'])

/** MDX 里的代码（import / export、花括号表达式）不是正文 */
const codeNodeTypes = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression'])

function isRecordLink(node: MdxNode): boolean {
  return (node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') && node.name === recordLinkName
}

/** RecordLink 的 id：要写成字符串 id="…"；没写或写成表达式时为 null，这一处不算引用 */
function recordLinkIdOf(node: MdxNode): string | null {
  const id = node.attributes?.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'id')?.value
  return typeof id === 'string' ? id : null
}

function referencedIdsIn(node: MdxNode): string[] {
  if (isRecordLink(node)) {
    const id = recordLinkIdOf(node)
    return id === null ? [] : [id]
  }
  return (node.children ?? []).flatMap(referencedIdsIn)
}

/** 节点里的文字：RecordLink 换成记录当前的标题，别的组件只留里面的文字，图片取替代文字，MDX 代码去掉 */
function textOf(node: MdxNode, recordTitleOf: (recordId: string) => string): string {
  if (codeNodeTypes.has(node.type)) return ''
  if (isRecordLink(node)) {
    const id = recordLinkIdOf(node)
    return id === null ? '' : recordTitleOf(id)
  }
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? ''
  if (node.type === 'image') return node.alt ?? ''
  if (node.type === 'break') return '\n'
  return (node.children ?? []).map((child) => textOf(child, recordTitleOf)).join('')
}

/** 几行连成一行，连着的空白并成一个空格 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 引用了 recordId 的那几段的纯文字：段落、标题各算一段，单独成行的 RecordLink 自成一段 */
function mentionTextsIn(node: MdxNode, recordId: string, recordTitleOf: (recordId: string) => string): string[] {
  if (phrasingContainerTypes.has(node.type) || isRecordLink(node)) {
    return referencedIdsIn(node).includes(recordId) ? [oneLine(textOf(node, recordTitleOf))] : []
  }
  return (node.children ?? []).flatMap((child) => mentionTextsIn(child, recordId, recordTitleOf))
}

function journalTreeOf(date: string, source: string): MdxNode {
  try {
    return unified().use(remarkParse).use(remarkMdx).parse(source) as unknown as MdxNode
  } catch (error) {
    throw new Error(`${journalDirName}/${date}.mdx 不是合法的 MDX：${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 日志引用一条记录的反向链接：哪几天的日志里有 <RecordLink id="这条记录的 id" />，每天列出引用它的那几段，新的日子在前。
 * journalSourceOf 是日期 → 那一天日志页的 MDX 原文；recordTitleOf 给出段里引用的记录当前的标题
 */
export function journalMentionsOf(recordId: string, journalSourceOf: ReadonlyMap<string, string>, recordTitleOf: (recordId: string) => string): JournalMention[] {
  const mentions: JournalMention[] = []
  for (const [date, source] of journalSourceOf) {
    for (const text of mentionTextsIn(journalTreeOf(date, source), recordId, recordTitleOf)) mentions.push({ date, text })
  }
  return mentions.sort((a, b) => b.date.localeCompare(a.date))
}