import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { recordPageUrlOf } from '../../core/layout.js'
import { byDue, dueStateOf } from '../../core/modules.js'
import type { ModuleState, TaskState } from '../../core/state.js'
import { dayOf, moduleProgressOf, timelineAxisOf, todayDay } from '../../core/timeline.js'
import { DueMark } from '../shared/module-marks.js'
import { StatusDot } from '../shared/parts.js'

/** 记号在时间轴上超过这个位置（百分比），日期写在记号左边，免得出了轴的右端 */
const labelOnLeftAfterPercent = 80

type TimelineAxis = ReturnType<typeof timelineAxisOf>

function MonthHeader({ axis }: { axis: TimelineAxis }) {
  const monthLabel = (day: number) => `${new Date(day).getUTCMonth() + 1} 月`
  return (
    <div className="relative h-8 border-b border-fd-border bg-fd-muted">
      <span className="absolute inset-0 overflow-hidden">
        {axis.monthStarts.map((day) => (
          <span key={day} className="absolute top-0 bottom-0 border-l border-fd-border pt-1.5 pl-1 text-[11.5px] whitespace-nowrap text-fd-muted-foreground" style={{ left: `${axis.percentOf(day)}%` }}>
            {monthLabel(day)}
          </span>
        ))}
      </span>
      <span className="absolute top-0.5 -translate-x-1/2 rounded bg-open px-1 text-[10.5px] leading-4 text-white" style={{ left: `${axis.percentOf(axis.today)}%` }}>
        今天
      </span>
    </div>
  )
}

type GanttRowProps = { module: ModuleState; tasks: TaskState[]; axis: TimelineAxis; color: CSSProperties | undefined; selected: boolean; onSelect: (id: string) => void }

/** 甘特图的一行：左边模块名（点了筛选看板）与打开按钮，右边截止日的记号与日期 */
function GanttRow({ module, tasks, axis, color, selected, onSelect }: GanttRowProps) {
  const { done, total } = moduleProgressOf(module.id, tasks)
  const dueState = dueStateOf(module, tasks, axis.today)
  const finished = dueState === 'finished'
  const overdue = dueState === 'overdue'
  const duePercent = axis.percentOf(dayOf(module.due))
  const labelOnLeft = duePercent > labelOnLeftAfterPercent
  return (
    <div className="contents" style={color}>
      <div className={`flex min-w-0 items-center gap-1 border-b border-fd-border pr-1 ${selected ? 'bg-fd-accent' : finished ? 'bg-done-soft' : ''}`}>
        <button type="button" onClick={() => onSelect(module.id)} aria-pressed={selected} title={selected ? '看全部任务' : '只看这个模块的任务'} className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left">
          <span className="size-2.5 shrink-0 rounded-sm bg-module" />
          {finished && <StatusDot status="done" size={12} />}
          <span title={module.title} className={`truncate ${selected ? 'font-semibold' : ''}`}>
            {module.title}
          </span>
          <span className="ml-auto shrink-0 text-[11.5px] text-fd-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </button>
        <Link to={recordPageUrlOf(module.id)} title="打开模块那一页" aria-label={`打开模块 ${module.title}`} className="inline-flex size-6 shrink-0 items-center justify-center rounded text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground">
          <ExternalLink size={13} />
        </Link>
      </div>
      <div className={`relative min-h-9 border-b border-fd-border ${selected ? 'bg-fd-accent/60' : ''}`}>
        {axis.monthStarts.map((day) => (
          <span key={day} className="absolute top-0 bottom-0 border-l border-fd-border/60" style={{ left: `${axis.percentOf(day)}%` }} />
        ))}
        <span className="absolute top-0 bottom-0 border-l-2 border-open/70" style={{ left: `${axis.percentOf(axis.today)}%` }} />
        <span
          title={`${module.title}：${module.due} 截止，做完 ${done} / ${total}`}
          className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5 text-[11.5px] whitespace-nowrap ${labelOnLeft ? '-translate-x-[calc(100%-6px)] flex-row-reverse' : '-translate-x-1.5'}`}
          style={{ left: `${duePercent}%` }}
        >
          <DueMark state={dueState} />
          <span className={`${overdue ? 'text-danger' : 'text-fd-muted-foreground'} ${selected ? 'font-semibold' : ''}`}>
            {module.due.slice(5)}
            {overdue && ' 已过期'}
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * 甘特图只画模块：每个模块一行，只在截止日画一个记号（DueMark），旁边写截止日；行上写「做完几个 / 共几个」。
 * 点模块名只看这个模块的任务（再点取消），点旁边的打开按钮进模块那一页
 */
export function Gantt({ modules, tasks, colors, selectedId, onSelect }: { modules: ModuleState[]; tasks: TaskState[]; colors: Map<string, CSSProperties>; selectedId: string | null; onSelect: (id: string) => void }) {
  if (modules.length === 0) return <p className="m-0 text-[13px] text-fd-muted-foreground">还没有模块。模块是一块大的工作，有截止日，画在这里；具体的小任务在下面的看板里，可以归进某个模块。</p>
  const sorted = [...modules].sort(byDue)
  const axis = timelineAxisOf(
    sorted.map((module) => dayOf(module.due)),
    todayDay(),
  )
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border border-fd-border">
        <div className="grid grid-cols-[fit-content(200px)_minmax(280px,1fr)] text-[12.5px]">
          <div className="border-b border-fd-border bg-fd-muted px-3 py-1.5 text-fd-muted-foreground">模块</div>
          <MonthHeader axis={axis} />
          {sorted.map((module) => (
            <GanttRow key={module.id} module={module} tasks={tasks} axis={axis} color={colors.get(module.id)} selected={selectedId === module.id} onSelect={onSelect} />
          ))}
        </div>
      </div>
      <p className="m-0 text-[12px] text-fd-muted-foreground">
        每个模块一行，菱形画在截止日，颜色是模块的颜色；全部做完换成勾，过了截止日还没做完加红框。看板上任务卡片左边的色条是它所属模块的颜色。点模块名，下面的看板只显示它的任务。
      </p>
    </div>
  )
}
