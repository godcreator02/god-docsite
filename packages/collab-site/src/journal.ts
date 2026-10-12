import { plainLinesOf } from './plain-lines.js'

/** 日志里引用一条任务或一个模块的写法：<RecordLink id="…" />，id 用双引号或单引号 */
const recordLinkPattern = /<RecordLink\s+id=(["'])([^"'\n]+)\1\s*\/>/g

/** 别的 JSX 标签（组件、HTML）：换成纯文字时去掉，只留标签之间的文字 */
const otherTagPattern = /<\/?[A-Za-z][^<>]*>/g

/** 「日志里的进展」的一条：哪一天的日志里，引用了这条记录的那一段（纯文字） */
export type JournalMention = { date: string; text: string }

/** 按空行分段；import、export 开头的行是 MDX 的代码，不算正文 */
function paragraphsOf(source: string): string[] {
  return source
    .split(/\r?\n[ \t]*\r?\n/)
    .map((paragraph) => paragraph.split(/\r?\n/).filter((line) => !/^(import|export)\s/.test(line)).join('\n'))
    .filter((paragraph) => paragraph.trim() !== '')
}

function referencedIdsOf(paragraph: string): string[] {
  return [...paragraph.matchAll(recordLinkPattern)].map((match) => match[2]!)
}

/** 一段 MDX 换成纯文字：RecordLink 换成记录当前的标题，别的标签去掉，Markdown 记号去掉，几行连成一行 */
function plainTextOf(paragraph: string, recordTitleOf: (recordId: string) => string): string {
  const withTitles = paragraph.replace(recordLinkPattern, (_match, _quote, recordId: string) => recordTitleOf(recordId)).replace(otherTagPattern, '')
  return plainLinesOf(withTitles).join(' ')
}

/**
 * 日志引用一条记录的反向链接：哪几天的日志里有 <RecordLink id="这条记录的 id" />，每天列出引用它的那几段，新的日子在前。
 * journalSourceOf 是日期 → 那一天日志页的 MDX 原文；recordTitleOf 给出段里引用的记录当前的标题
 */
export function journalMentionsOf(recordId: string, journalSourceOf: ReadonlyMap<string, string>, recordTitleOf: (recordId: string) => string): JournalMention[] {
  const mentions: JournalMention[] = []
  for (const [date, source] of journalSourceOf) {
    for (const paragraph of paragraphsOf(source)) {
      if (referencedIdsOf(paragraph).includes(recordId)) mentions.push({ date, text: plainTextOf(paragraph, recordTitleOf) })
    }
  }
  return mentions.sort((a, b) => b.date.localeCompare(a.date))
}
