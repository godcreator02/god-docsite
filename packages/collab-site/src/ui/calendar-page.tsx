import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { WidePageToggle } from '@godcreator/docsite-kit/ui'
import { recordPageUrlOf, type ModuleState } from '@godcreator/collab-model/task-model'
import { calendarUrl, isRealDate, journalUrlOf } from '../site-data.js'
import { dayMs, isoDateOf, todayDay } from '../timeline.js'
import { useCollabData } from './collab-data.js'
import { DueMark, dueStateOf, moduleColorsOf } from './module-marks.js'

/** 月份写成 YYYY-MM；日期取前 7 位就是它所在的月 */
const monthOf = (date: string) => date.slice(0, 7)

/** 某个月往前、往后挪几个月 */
function shiftedMonth(month: string, by: number): string {
  const first = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1))
  return isoDateOf(first.getTime()).slice(0, 7)
}

/** 月历要画的日子：从这个月一号所在那一周的周一，到月底所在那一周的周日 */
function calendarDaysOf(month: string): string[] {
  const first = Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
  const last = Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  const mondayIndex = (day: number) => (new Date(day).getUTCDay() + 6) % 7
  const start = first - mondayIndex(first) * dayMs
  const end = last + (6 - mondayIndex(last)) * dayMs
  return Array.from({ length: (end - start) / dayMs + 1 }, (_, index) => isoDateOf(start + index * dayMs))
}

/** 日历地址里的月份：/calendar?month=2026-10；不写就是今天所在的月，写了不是 YYYY-MM 就回 null */
function requestedMonthOf(value: string | null, today: string): string | null {
  if (value === null) return monthOf(today)
  return /^\d{4}-\d{2}$/.test(value) && isRealDate(`${value}-01`) ? value : null
}

const calendarUrlOfMonth = (month: string) => `${calendarUrl}?month=${month}`

const weekdayNames = ['一', '二', '三', '四', '五', '六', '日']

/** 当天截止的模块：每个一个记号，颜色是模块色 */
function DueMarks({ modules, date }: { modules: ModuleState[]; date: string }) {
  const { tasks } = useCollabData()
  const colors = moduleColorsOf(modules)
  const today = todayDay()
  return modules
    .filter((module) => module.due === date)
    .map((module) => (
      <span key={module.id} title={`${module.title} 截止`} style={colors.get(module.id)} className="inline-flex">
        <DueMark state={dueStateOf(module, tasks, today)} size={9} />
      </span>
    ))
}

const stepLinkClass = 'inline-flex size-7 items-center justify-center rounded-md text-fd-muted-foreground no-underline hover:bg-fd-accent hover:text-fd-foreground'

/**
 * /calendar：一个月的月历，一周从周一开始。有日志页的日子画一个点，模块截止那天画同色记号，今天另有底色；
 * 点任何一天进那一天的日志页。不显示日志是谁写的
 */
export function CalendarPage() {
  const [searchParams] = useSearchParams()
  const { modules, journalDates } = useCollabData()
  const today = isoDateOf(todayDay())
  const month = requestedMonthOf(searchParams.get('month'), today)
  if (month === null) return <p className="text-danger">地址里的 month 要写成 YYYY-MM，比如 {calendarUrlOfMonth(monthOf(today))}</p>
  const hasJournal = new Set(journalDates)
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold">日历</h1>
        <span className="ml-auto flex items-center gap-1 text-[14px]">
          <Link to={calendarUrlOfMonth(shiftedMonth(month, -1))} title="上一个月" aria-label="上一个月" className={stepLinkClass}>
            <ChevronLeft size={16} />
          </Link>
          <strong className="tabular-nums">
            {month.slice(0, 4)} 年 {Number(month.slice(5, 7))} 月
          </strong>
          <Link to={calendarUrlOfMonth(shiftedMonth(month, 1))} title="下一个月" aria-label="下一个月" className={stepLinkClass}>
            <ChevronRight size={16} />
          </Link>
          {month !== monthOf(today) && (
            <Link to={calendarUrl} className="ml-1 rounded-md border border-fd-border px-2 py-0.5 text-[12.5px] text-fd-foreground no-underline hover:bg-fd-accent">
              回到本月
            </Link>
          )}
        </span>
        <WidePageToggle />
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border-t border-l border-fd-border text-[13px]">
        {weekdayNames.map((weekday) => (
          <div key={weekday} className="border-r border-b border-fd-border bg-fd-muted py-1 text-center text-[12px] text-fd-muted-foreground">
            {weekday}
          </div>
        ))}
        {calendarDaysOf(month).map((date) => {
          const outside = monthOf(date) !== month
          const journal = hasJournal.has(date)
          return (
            <Link
              key={date}
              to={journalUrlOf(date)}
              title={journal ? `${date} 的日志` : `${date}：还没有日志`}
              className={`flex min-h-20 flex-col gap-1.5 border-r border-b border-fd-border p-1.5 text-fd-foreground no-underline hover:bg-fd-accent ${date === today ? 'bg-open/10' : ''} ${outside ? 'text-fd-muted-foreground' : ''}`}
            >
              <span className={`tabular-nums ${date === today ? 'font-semibold text-open' : ''}`}>{Number(date.slice(8))}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {journal && <span aria-label="有日志" className="size-2 rounded-full bg-info" />}
                <DueMarks modules={modules} date={date} />
              </span>
            </Link>
          )
        })}
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fd-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-info" /> 有日志
        </span>
        <span>菱形：模块截止，颜色是模块的颜色；全部做完是勾，过了截止日还没做完加红框</span>
        <span>日志由 AI 写进站点的 journal/&lt;日期&gt;.mdx，网页上只看</span>
      </p>
    </div>
  )
}

/** 某一天的日志页顶上那一条：回到那一月的日历、前后有日志的日子、当天截止的模块 */
export function JournalDayBar({ date }: { date: string }) {
  const { modules, journalDates } = useCollabData()
  const colors = moduleColorsOf(modules)
  const earlier = journalDates.filter((day) => day < date).at(-1)
  const later = journalDates.find((day) => day > date)
  const dueModules = modules.filter((module) => module.due === date)
  const stepClass = 'text-fd-muted-foreground no-underline hover:text-fd-foreground'
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
