import { Link } from 'react-router'
import type { JournalMention } from '../../core/journal-mentions.js'
import { journalUrlOf } from '../../core/layout.js'
import { SectionHeading } from './content-section.js'

/** 日志引用这条记录的反向链接：哪几天的日志里写了 <RecordLink id="这条记录的 id" />，每天列出引用它的那一段，点日期进那一天的日志 */
export function JournalMentions({ recordId, mentions }: { recordId: string; mentions: JournalMention[] }) {
  return (
    <section className="grid gap-2">
      <div className="border-b border-fd-border pb-2">
        <SectionHeading>日志里的进展</SectionHeading>
      </div>
      {mentions.length === 0 ? (
        <p className="m-0 text-[13.5px] text-fd-muted-foreground">
          还没有日志引用它。日志里写 <code>{`<RecordLink id="${recordId}" />`}</code>，这里就列出那一段
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {mentions.map((mention, index) => (
            <li key={`${mention.date}-${index}`} className="m-0 grid grid-cols-[6.5em_minmax(0,1fr)] gap-2 text-[13.5px] leading-relaxed">
              <Link to={journalUrlOf(mention.date)} className="tabular-nums">
                {mention.date}
              </Link>
              <span className="min-w-0 break-words">{mention.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
