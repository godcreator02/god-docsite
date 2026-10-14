import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { Calendar } from 'lucide-react'
import { recordPageUrlOf } from '../../core/layout.js'
import { plainLinesOf } from '../../core/plain-lines.js'
import { taskStatuses, type TaskStatus } from '../../core/records.js'
import type { ModuleState, TaskState } from '../../core/state.js'
import { isLaterThanModule } from '../../core/timeline.js'
import type { SitePageRef } from '../page-data.js'
import { PageRef } from '../shared/page-ref.js'
import { PersonName, StatusDot, statusLabel } from '../shared/parts.js'

/** 看板显示哪些任务：全部、某个模块的、没归入模块的 */
export type BoardFilter = { kind: 'all' } | { kind: 'module'; id: string } | { kind: 'unassigned' }

function tasksShownBy(filter: BoardFilter, tasks: TaskState[]) {
  if (filter.kind === 'all') return tasks
  if (filter.kind === 'unassigned') return tasks.filter((task) => task.module === undefined)
  return tasks.filter((task) => task.module === filter.id)
}

/** 人员筛选：选了人只留他负责的任务 */
export function tasksOwnedBy(personId: string | null, tasks: TaskState[]) {
  return personId === null ? tasks : tasks.filter((task) => task.owner === personId)
}

const columnTone: Record<TaskStatus, string> = { todo: 'text-fd-muted-foreground', doing: 'text-info', done: 'text-done' }

/** 卡片上显示任务内容开头这么多行 */
const excerptLineCount = 3

type CardContext = { modules: ModuleState[]; pages: readonly SitePageRef[]; colors: Map<string, CSSProperties> }

/** 归进模块的卡片左边一条模块色；点卡片任何地方打开任务那一页，卡片里的页面链接照常跳到那一页 */
function BoardCard({ task, context, showModule }: { task: TaskState; context: CardContext; showModule: boolean }) {
  const navigate = useNavigate()
  const { modules, pages, colors } = context
  const done = task.status === 'done'
  const module = task.module === undefined ? undefined : modules.find((entry) => entry.id === task.module)
  const late = isLaterThanModule(task, modules)
  const url = recordPageUrlOf(task.id)
  const excerpt = task.detail === undefined ? [] : plainLinesOf(task.detail).slice(0, excerptLineCount)
  return (
    <li
      onClick={() => void navigate(url)}
      style={module ? colors.get(module.id) : undefined}
      className={`m-0 min-w-0 cursor-pointer space-y-1.5 rounded-lg border p-3 hover:border-fd-muted-foreground ${done ? 'border-done/40 bg-done-soft' : 'border-fd-border bg-fd-card'} ${module ? 'border-l-4 border-l-module' : ''}`}
    >
      {showModule && module && <span className="inline-block max-w-full truncate rounded bg-module-soft px-1.5 text-[11px] leading-5 text-module">{module.title}</span>}
      <p className="m-0 flex items-start gap-1.5 text-[13.5px] leading-snug">
        {done && (
          <span className="mt-0.5">
            <StatusDot status="done" size={14} />
          </span>
        )}
        <Link to={url} className="min-w-0 break-words text-fd-foreground no-underline">
          {task.title}
        </Link>
      </p>
      {excerpt.length > 0 && <p className="m-0 line-clamp-3 text-[12.5px] leading-relaxed break-words whitespace-pre-line text-fd-muted-foreground">{excerpt.join('\n')}</p>}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fd-muted-foreground">
        {task.owner ? <PersonName personId={task.owner} size={16} /> : <span>未指派</span>}
        {task.due && (
          <span className={`inline-flex items-center gap-1 ${late ? 'text-danger' : ''}`} title={late && module ? `晚于所属模块「${module.title}」的截止日 ${module.due}` : undefined}>
            <Calendar size={12} />
            {task.due}
          </span>
        )}
        {task.page && <PageRef url={task.page} pages={pages} />}
      </div>
    </li>
  )
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] ${active ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground' : 'border-fd-border hover:bg-fd-accent'}`}
    >
      {label}
      <span className={`tabular-nums ${active ? 'opacity-80' : 'text-fd-muted-foreground'}`}>{count}</span>
    </button>
  )
}

function BoardColumn({ status, tasks, context, showModule }: { status: TaskStatus; tasks: TaskState[]; context: CardContext; showModule: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-fd-muted p-2">
      <div className={`flex items-center gap-2 px-1.5 pt-0.5 pb-2 text-[12.5px] font-semibold ${columnTone[status]}`}>
        <StatusDot status={status} size={13} />
        {statusLabel[status]}
        <span className="ml-auto text-[12px] font-normal text-fd-muted-foreground tabular-nums">{tasks.length}</span>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0">
        {tasks.length === 0 && <li className="m-0 px-2 py-3 text-center text-[12px] text-fd-muted-foreground">没有</li>}
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} context={context} showModule={showModule} />
        ))}
      </ul>
    </div>
  )
}

/** 看板：三列等宽、允许比内容窄，长标题、长页面名在卡片里折行或省略，不把列撑宽；上面一行是「全部」「未归入模块」两个筛选 */
export function Board({ tasks, context, filter, setFilter }: { tasks: TaskState[]; context: CardContext; filter: BoardFilter; setFilter: (filter: BoardFilter) => void }) {
  const shown = tasksShownBy(filter, tasks)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="看板显示哪些任务">
        <FilterChip label="全部" count={tasks.length} active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })} />
        <FilterChip label="未归入模块" count={tasksShownBy({ kind: 'unassigned' }, tasks).length} active={filter.kind === 'unassigned'} onClick={() => setFilter({ kind: 'unassigned' })} />
      </div>
      <div className="grid gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        {taskStatuses.map((status) => (
          <BoardColumn key={status} status={status} tasks={shown.filter((task) => task.status === status)} context={context} showModule={filter.kind !== 'module'} />
        ))}
      </div>
    </div>
  )
}
