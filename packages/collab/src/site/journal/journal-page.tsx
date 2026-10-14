import type { ComponentType } from 'react'
import { Link, useLoaderData } from 'react-router'
import { DocsBody, DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { ArrowLeft } from 'lucide-react'
import { journalUrlOf, recordPageUrlOf } from '../../core/layout.js'
import { isoDateOf, todayDay } from '../../core/timeline.js'
import { calendarUrlOfMonth, monthOf } from '../calendar/month.js'
import type { JournalPageData } from '../page-data.js'
import { moduleColorsOf } from '../shared/module-marks.js'
import { PageComments, type CommentBodyComponent } from '../shared/page-comments.js'

/** 站点给的日志正文组件：渲染站点日志集合里 journal/<date>.mdx 的正文（集合由站点声明） */
export type JournalBodyComponent = ComponentType<{ date: string }>

const stepClass = 'text-fd-muted-foreground no-underline hover:text-fd-foreground'

/** 某一天的日志页顶上那一条：回到那一月的日历、前后有日志的日子、当天截止的模块 */
export function JournalDayBar({ data }: { data: JournalPageData }) {
  const { date, journalDates, modules } = data
  const colors = moduleColorsOf(modules)
  const earlier = journalDates.filter((day) => day < date).at(-1)
  const later = journalDates.find((day) => day > date)
  const dueModules = modules.filter((module) => module.due === date)
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-fd-border pb-3 text-[13px]">
      <Link to={calendarUrlOfMonth(monthOf(date))} className={`inline-flex items-center gap-1.5 ${stepClass}`}>
        <ArrowLeft size={14} />
        日历
      </Link>
      {earlier ? (
        <Link to={journalUrlOf(earlier)} className={stepClass}>
          ‹ {earlier}
        </Link>
      ) : (
        <span className="text-fd-muted-foreground">‹ 没有更早的日志</span>
      )}
      <strong className="tabular-nums">{date}</strong>
      {later ? (
        <Link to={journalUrlOf(later)} className={stepClass}>
          {later} ›
        </Link>
      ) : (
        <span className="text-fd-muted-foreground">没有更晚的日志 ›</span>
      )}
      {dueModules.length > 0 && (
        <span className="ml-auto flex flex-wrap items-center gap-2">
          当天截止：
          {dueModules.map((module) => (
            <Link key={module.id} to={recordPageUrlOf(module.id)} style={colors.get(module.id)} className="inline-flex items-center gap-1.5 rounded-md bg-module-soft px-2 py-0.5 text-fd-foreground no-underline">
              <span className="inline-block size-2 rotate-45 rounded-[1px] bg-module" />
              {module.title}
            </Link>
          ))}
        </span>
      )}
    </div>
  )
}

/** 还没有日志页的那一天：网页上不能写日志，只提示让 AI 写；今天以后的日子写「还没到这一天」 */
export function EmptyJournalDay({ date }: { date: string }) {
  const isFuture = date > isoDateOf(todayDay())
  return (
    <div className="grid justify-items-center gap-2 py-10 text-center">
      <p className="m-0">{isFuture ? '还没到这一天。' : '这一天还没有日志。'}</p>
      {!isFuture && <p className="m-0 text-[13px] text-fd-muted-foreground">日志由 AI 写：对你的 AI 说「把今天的工作记进日志」，它写进站点的 journal/{date}.mdx 给你看，你同意了再提交审核。</p>}
    </div>
  )
}

/**
 * /calendar/:date 的页面组件：读 journalLoader 的数据；评论提交到这一页自己的路由 action（commentAction）。
 * JournalBody 是站点的日志正文组件，CommentBody 是站点的评论正文组件
 */
export function JournalPage({ JournalBody, CommentBody }: { JournalBody: JournalBodyComponent; CommentBody: CommentBodyComponent }) {
  const data = useLoaderData<JournalPageData>()
  const { date } = data
  return (
    <DocsPage>
      <title>{`${date} 的日志 · ${data.siteName}`}</title>
      <JournalDayBar data={data} />
      <h1 className="text-2xl font-semibold tracking-tight">{date}</h1>
      <PageComments page={journalUrlOf(date)} comments={data.comments} CommentBody={CommentBody}>
        <DocsBody>{data.hasJournal ? <JournalBody date={date} /> : <EmptyJournalDay date={date} />}</DocsBody>
      </PageComments>
    </DocsPage>
  )
}
