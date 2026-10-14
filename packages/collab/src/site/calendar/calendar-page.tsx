import type { CSSProperties } from 'react'
import { Link, useLoaderData, useSearchParams } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { calendarUrl, journalUrlOf } from '../../core/layout.js'
import { dueStateOf } from '../../core/modules.js'
import type { ModuleState, TaskState } from '../../core/state.js'
import { isoDateOf, todayDay } from '../../core/timeline.js'
import type { CalendarPageData } from '../page-data.js'
import { DueMark, moduleColorsOf } from '../shared/module-marks.js'
import { calendarDaysOf, calendarUrlOfMonth, monthOf, requestedMonthOf, shiftedMonth } from './month.js'

const weekdayNames = ['一', '二', '三', '四', '五', '六', '日']

/** 当天截止的模块：每个一个记号，颜色是模块色 */
function DueMarks({ date, modules, tasks, colors }: { date: string; modules: ModuleState[]; tasks: TaskState[]; colors: Map<string, CSSProperties> }) {
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

function MonthSwitcher({ month, today }: { month: string; today: string }) {
  return (
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
  )
}

/**
 * 日历的内容：一个月的月历，一周从周一开始。有日志页的日子画一个点，模块截止那天画同色记号，今天另有底色；
 * 点任何一天进那一天的日志页。不显示日志是谁写的
 */
export function CalendarView({ data }: { data: CalendarPageData }) {
  const [searchParams] = useSearchParams()
  const today = isoDateOf(todayDay())
  const month = requestedMonthOf(searchParams.get('month'), today)
  if (month === null) return <p className="text-danger">地址里的 month 要写成 YYYY-MM，比如 {calendarUrlOfMonth(monthOf(today))}</p>
  const hasJournal = new Set(data.journalDates)
  const colors = moduleColorsOf(data.modules)
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold">日历</h1>
        <MonthSwitcher month={month} today={today} />
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
                <DueMarks date={date} modules={data.modules} tasks={data.tasks} colors={colors} />
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

/** /calendar 的页面组件：读 calendarLoader 的数据 */
export function CalendarPage() {
  const data = useLoaderData<CalendarPageData>()
  return (
    <DocsPage>
      <title>{`日历 · ${data.siteName}`}</title>
      <CalendarView data={data} />
    </DocsPage>
  )
}
