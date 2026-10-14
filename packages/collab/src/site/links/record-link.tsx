import { useEffect, type ReactNode } from 'react'
import { Link, useFetcher } from 'react-router'
import { CalendarDays } from 'lucide-react'
import { journalUrlOf, recordLinksApiUrl, recordPageUrlOf } from '../../core/layout.js'
import type { RecordLinkSummary, RecordLinkTargets } from '../page-data.js'
import { DueMark, moduleColorStyleOf } from '../shared/module-marks.js'
import { StatusDot, statusLabel } from '../shared/parts.js'
import { hasWrittenText, linkChipClassName, linkChipIconClassName } from './link-chip.js'

const chipClass = 'mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 align-baseline text-[0.92em] leading-[1.6] font-normal no-underline whitespace-nowrap'

/**
 * 问记录链接资源路由（recordLinksLoader）要显示的数据：同一个 key 的 fetcher 在页面里共用，
 * 同一条记录的几处链接只问一次；写入之后 React Router 会让它重新问
 */
function useLinkTargets(key: string, query: string): RecordLinkTargets | undefined {
  const fetcher = useFetcher<RecordLinkTargets>({ key })
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined) void fetcher.load(`${recordLinksApiUrl}${query}`)
  }, [fetcher, query])
  return fetcher.data
}

function TaskChip({ record, children }: { record: Extract<RecordLinkSummary, { kind: 'task' }>; children?: ReactNode }) {
  return (
    <Link
      to={recordPageUrlOf(record.id)}
      title={`任务：${record.title}（${statusLabel[record.status]}）`}
      style={record.module ? moduleColorStyleOf(record.module.colorSlot) : undefined}
      className={`${chipClass} ${record.module ? 'border-module/45 bg-module-soft' : 'border-fd-border bg-fd-muted'} text-fd-foreground`}
    >
      <StatusDot status={record.status} size={12} />
      <span className="truncate">{hasWrittenText(children) ? children : record.title}</span>
    </Link>
  )
}

function ModuleChip({ record, children }: { record: Extract<RecordLinkSummary, { kind: 'module' }>; children?: ReactNode }) {
  return (
    <Link to={recordPageUrlOf(record.id)} title={`模块：${record.title}（${record.due} 截止）`} style={moduleColorStyleOf(record.colorSlot)} className={`${chipClass} border-module/45 bg-module-soft text-fd-foreground`}>
      <DueMark state={record.dueState} size={8} />
      <span className="truncate">{hasWrittenText(children) ? children : record.title}</span>
    </Link>
  )
}

/**
 * 正文里引用一条任务或一个模块：<RecordLink id="…" />，或写成链接 [](/tasks/<id>)（remarkCollabLinks 换成它）。
 * 没写文字时显示记录当前的标题，任务带状态、模块带截止日的记号（颜色是模块色）；点了进它那一页。
 * 记录不存在（后来删了）时写「已删除的记录」，不报错：以前写的日志页不能因为删了任务就打不开
 */
export function RecordLink({ id, children }: { id: string; children?: ReactNode }) {
  const targets = useLinkTargets(`collab-record-link:${id}`, `?${new URLSearchParams({ id })}`)
  if (targets === undefined) {
    return <span className={`${chipClass} border-fd-border text-fd-muted-foreground`}>{hasWrittenText(children) ? children : id}</span>
  }
  const record = targets.records.find((entry) => entry.id === id)
  if (record?.kind === 'task') return <TaskChip record={record}>{children}</TaskChip>
  if (record?.kind === 'module') return <ModuleChip record={record}>{children}</ModuleChip>
  return (
    <span title={`没有 id 为 ${id} 的任务或模块，可能已经被删掉了`} className={`${chipClass} border-fd-border text-fd-muted-foreground`}>
      已删除的记录 {id}
    </span>
  )
}

/** 某一天的日志页：没有日志的日子也能打开（页面上提示让 AI 写），卡片画成虚线 */
export function JournalLink({ date, children }: { date: string; children?: ReactNode }) {
  const hasJournal = useLinkTargets('collab-journal-dates', '')?.journalDates.includes(date) ?? false
  return (
    <Link
      to={journalUrlOf(date)}
      title={hasJournal ? `${date} 的日志` : `${date} 还没有日志`}
      className={`${linkChipClassName} border-fd-border ${hasJournal ? 'bg-fd-muted/60 text-fd-foreground' : 'border-dashed text-fd-muted-foreground'}`}
    >
      <CalendarDays className={linkChipIconClassName} />
      {hasWrittenText(children) ? children : `${date} 的日志`}
    </Link>
  )
}
