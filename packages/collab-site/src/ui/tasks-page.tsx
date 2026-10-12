import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Calendar, ExternalLink, ListPlus } from 'lucide-react'
import { recordPageUrlOf, taskStatuses, type ModuleState, type Person, type TaskState, type TaskStatus } from '@godcreator/collab-model/task-model'
import { plainLinesOf } from '../plain-lines.js'
import { dayOf, isLaterThanModule, moduleProgressOf, timelineAxisOf, todayDay } from '../timeline.js'
import { useCollabData, useNameOf } from './collab-data.js'
import { byDue, DueMark, dueStateOf, moduleColorsOf } from './module-marks.js'
import { PageRef } from './page-ref.js'
import { Dialog, ErrorLine, PersonAvatar, PersonName, PlainButton, PrimaryButton, StatusDot, statusLabel, useCanWrite } from './parts.js'
import { useCollabWriter } from './requests.js'

export const inputClass = 'h-8 w-full rounded-md border border-fd-border bg-fd-background px-2 text-[13px] outline-none focus:border-fd-muted-foreground'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[12px] text-fd-muted-foreground">
      {label}
      {children}
    </label>
  )
}

function FormButtons({ saving, canSave, submitLabel, onCancel }: { saving: boolean; canSave: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <PlainButton onClick={onCancel}>取消</PlainButton>
      <PrimaryButton type="submit" disabled={saving || !canSave}>
        {submitLabel}
      </PrimaryButton>
    </div>
  )
}

/** 建好一条记录就打开它那一页；写入被拒时把原因留在表单里 */
function useCreateAndOpen(record: () => Record<string, unknown>) {
  const navigate = useNavigate()
  const { create } = useCollabWriter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { id } = await create(record())
      await navigate(recordPageUrlOf(id))
    } catch (writeError) {
      setError((writeError as Error).message)
      setSaving(false)
    }
  }
  return { saving, error, submit }
}

/** 新建任务：只填标题，筛选着某个模块时归进它；其余在任务那一页上填 */
function NewTaskForm({ module, onCancel }: { module?: string; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const { modules } = useCollabData()
  const moduleTitle = module === undefined ? undefined : modules.find((entry) => entry.id === module)?.title
  const { saving, error, submit } = useCreateAndOpen(() => ({ type: 'task', status: 'todo', title: title.trim(), ...(module && { module }) }))
  return (
    <form onSubmit={submit} className="grid gap-2.5">
      <Field label="标题">
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="要做的事" />
      </Field>
      <p className="m-0 text-[12px] text-fd-muted-foreground">{moduleTitle ? `归进模块「${moduleTitle}」。` : ''}建好后打开任务那一页，在那里填负责人、截止日和任务内容。</p>
      <ErrorLine message={error} />
      <FormButtons saving={saving} canSave={title.trim() !== ''} submitLabel="新建任务" onCancel={onCancel} />
    </form>
  )
}

/** 新建模块：标题、截止日必填（甘特图要画），其余在模块那一页上填 */
function NewModuleForm({ onCancel }: { onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const { saving, error, submit } = useCreateAndOpen(() => ({ type: 'module', title: title.trim(), due }))
  return (
    <form onSubmit={submit} className="grid gap-2.5">
      <Field label="标题">
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="一块大的工作，比如「采样板」" />
      </Field>
      <Field label="截止日">
        <input type="date" required value={due} onChange={(event) => setDue(event.target.value)} className={inputClass} />
      </Field>
      <p className="m-0 text-[12px] text-fd-muted-foreground">建好后打开模块那一页，在那里填负责人和模块内容。</p>
      <ErrorLine message={error} />
      <FormButtons saving={saving} canSave={title.trim() !== '' && due !== ''} submitLabel="新建模块" onCancel={onCancel} />
    </form>
  )
}

/** 看板显示哪些任务：全部、某个模块的、没归入模块的 */
type BoardFilter = { kind: 'all' } | { kind: 'module'; id: string } | { kind: 'unassigned' }

function tasksShownBy(filter: BoardFilter, tasks: TaskState[]) {
  if (filter.kind === 'all') return tasks
  if (filter.kind === 'unassigned') return tasks.filter((task) => task.module === undefined)
  return tasks.filter((task) => task.module === filter.id)
}

function tasksOwnedBy(personId: string | null, tasks: TaskState[]) {
  return personId === null ? tasks : tasks.filter((task) => task.owner === personId)
}

/** 一个人的工作量：没做完的任务数、其中过了截止日的数、他负责的模块 */
function workloadOf(personId: string, tasks: TaskState[], modules: ModuleState[], today: number) {
  const unfinished = tasks.filter((task) => task.owner === personId && task.status !== 'done')
  const overdue = unfinished.filter((task) => task.due !== undefined && dayOf(task.due) < today).length
  const ownedModules = modules.filter((module) => module.owner === personId).sort(byDue)
  return { unfinished: unfinished.length, overdue, ownedModules }
}

function PersonCard({ person, today, selected, onSelect }: { person: Person; today: number; selected: boolean; onSelect: (id: string) => void }) {
  const { tasks, modules } = useCollabData()
  const { unfinished, overdue, ownedModules } = workloadOf(person.id, tasks, modules, today)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(person.id)}
      title={selected ? '看全部人的任务' : `只看 ${person.name} 的任务`}
      className={`flex min-w-0 items-start gap-2.5 rounded-lg border p-3 text-left ${selected ? 'border-fd-primary bg-fd-accent' : 'border-fd-border bg-fd-card hover:border-fd-muted-foreground'}`}
    >
      <PersonAvatar personId={person.id} size={32} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={`truncate text-[13.5px] ${selected ? 'font-semibold' : ''}`}>{person.name}</span>
        <span className="truncate text-[11.5px] text-fd-muted-foreground">{person.id}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-fd-muted-foreground tabular-nums">
          <span>{unfinished} 个没做完</span>
          {overdue > 0 && <span className="text-danger">{overdue} 个过期</span>}
        </span>
        {ownedModules.length > 0 && <span className="truncate text-[11.5px] text-fd-muted-foreground">负责模块：{ownedModules.map((module) => module.title).join('、')}</span>}
      </span>
    </button>
  )
}

/** 人员列表一人一张卡（agent 不列）。点一张卡，看板只显示他负责的任务（再点取消） */
function People({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const people = useCollabData().people.filter((person) => !person.agent)
  if (people.length === 0) return <p className="m-0 text-[13px] text-fd-muted-foreground">站点的 people.json 里还没有人</p>
  const today = todayDay()
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((person) => (
        <PersonCard key={person.id} person={person} today={today} selected={selectedId === person.id} onSelect={onSelect} />
      ))}
    </div>
  )
}

/** 记号在时间轴上超过这个位置（百分比），日期写在记号左边，免得出了轴的右端 */
const labelOnLeftAfterPercent = 80

/**
 * 甘特图只画模块：每个模块一行，只在截止日画一个记号（DueMark），旁边写截止日；行上写「做完几个 / 共几个」。
 * 点模块名只看这个模块的任务（再点取消），点旁边的打开按钮进模块那一页
 */
function Gantt({ colors, selectedId, onSelect }: { colors: Map<string, CSSProperties>; selectedId: string | null; onSelect: (id: string) => void }) {
  const { modules, tasks } = useCollabData()
  if (modules.length === 0) return <p className="m-0 text-[13px] text-fd-muted-foreground">还没有模块。模块是一块大的工作，有截止日，画在这里；具体的小任务在下面的看板里，可以归进某个模块。</p>
  const sorted = [...modules].sort(byDue)
  const axis = timelineAxisOf(
    sorted.map((module) => dayOf(module.due)),
    todayDay(),
  )
  const monthLabel = (day: number) => `${new Date(day).getUTCMonth() + 1} 月`
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border border-fd-border">
        <div className="grid grid-cols-[fit-content(200px)_minmax(280px,1fr)] text-[12.5px]">
          <div className="border-b border-fd-border bg-fd-muted px-3 py-1.5 text-fd-muted-foreground">模块</div>
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
          {sorted.map((module) => {
            const { done, total } = moduleProgressOf(module.id, tasks)
            const dueState = dueStateOf(module, tasks, axis.today)
            const finished = dueState === 'finished'
            const overdue = dueState === 'overdue'
            const selected = selectedId === module.id
            const duePercent = axis.percentOf(dayOf(module.due))
            const labelOnLeft = duePercent > labelOnLeftAfterPercent
            return (
              <div key={module.id} className="contents" style={colors.get(module.id)}>
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
          })}
        </div>
      </div>
      <p className="m-0 text-[12px] text-fd-muted-foreground">
        每个模块一行，菱形画在截止日，颜色是模块的颜色；全部做完换成勾，过了截止日还没做完加红框。看板上任务卡片左边的色条是它所属模块的颜色。点模块名，下面的看板只显示它的任务。
      </p>
    </div>
  )
}

const columnTone: Record<TaskStatus, string> = { todo: 'text-fd-muted-foreground', doing: 'text-info', done: 'text-done' }

/** 卡片上显示任务内容开头这么多行 */
const excerptLineCount = 3

/** 归进模块的卡片左边一条模块色；点卡片任何地方打开任务那一页，卡片里的页面链接照常跳到那一页 */
function BoardCard({ task, colors, showModule }: { task: TaskState; colors: Map<string, CSSProperties>; showModule: boolean }) {
  const navigate = useNavigate()
  const { modules } = useCollabData()
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
        {task.page && <PageRef url={task.page} />}
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

/** 三列等宽、允许比内容窄：长标题、长页面名在卡片里折行或省略，不把列撑宽 */
function Board({ tasks, colors, filter, setFilter }: { tasks: TaskState[]; colors: Map<string, CSSProperties>; filter: BoardFilter; setFilter: (filter: BoardFilter) => void }) {
  const shown = tasksShownBy(filter, tasks)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="看板显示哪些任务">
        <FilterChip label="全部" count={tasks.length} active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })} />
        <FilterChip label="未归入模块" count={tasksShownBy({ kind: 'unassigned' }, tasks).length} active={filter.kind === 'unassigned'} onClick={() => setFilter({ kind: 'unassigned' })} />
      </div>
      <div className="grid gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        {taskStatuses.map((status) => {
          const items = shown.filter((task) => task.status === status)
          return (
            <div key={status} className="flex min-w-0 flex-col rounded-lg bg-fd-muted p-2">
              <div className={`flex items-center gap-2 px-1.5 pt-0.5 pb-2 text-[12.5px] font-semibold ${columnTone[status]}`}>
                <StatusDot status={status} size={13} />
                {statusLabel[status]}
                <span className="ml-auto text-[12px] font-normal text-fd-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <ul className="m-0 grid list-none gap-2 p-0">
                {items.length === 0 && <li className="m-0 px-2 py-3 text-center text-[12px] text-fd-muted-foreground">没有</li>}
                {items.map((task) => (
                  <BoardCard key={task.id} task={task} colors={colors} showModule={filter.kind !== 'module'} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type DialogState = { kind: 'new-task' } | { kind: 'new-module' } | null

function HeaderButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-fd-border px-3 text-[13px] hover:bg-fd-accent">
      <ListPlus size={14} />
      {label}
    </button>
  )
}

function PersonFilterNote({ personId, onClear }: { personId: string; onClear: () => void }) {
  const nameOf = useNameOf()
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-fd-muted-foreground">
      只看 {nameOf(personId)} 的任务
      <button type="button" onClick={onClear} className="inline-flex h-6 items-center rounded-md border border-fd-border px-2 text-[12px] text-fd-foreground hover:bg-fd-accent">
        取消
      </button>
    </span>
  )
}

/**
 * /tasks：从上到下三块。人员卡片写每人没做完、过期的任务数和负责的模块；甘特图画模块；看板放具体的小任务。
 * 点人员卡片看板只显示他负责的任务，点甘特图上的模块看板只显示它的任务，两个筛选同时生效。
 * 能写时新建任务、模块在弹窗里只填最少的几项，建好就打开它那一页
 */
export function TasksPage() {
  const { tasks, modules } = useCollabData()
  const canWrite = useCanWrite()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [filter, setFilter] = useState<BoardFilter>({ kind: 'all' })
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const done = tasks.filter((task) => task.status === 'done').length
  const close = () => setDialog(null)
  const selectedModuleId = filter.kind === 'module' ? filter.id : null
  const toggleModule = (id: string) => setFilter(selectedModuleId === id ? { kind: 'all' } : { kind: 'module', id })
  const togglePerson = (id: string) => setSelectedPersonId(selectedPersonId === id ? null : id)
  const moduleColors = moduleColorsOf(modules)
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold">任务</h1>
        <span className="text-[13px] text-fd-muted-foreground tabular-nums">
          全站已完成 {done} / {tasks.length}
        </span>
        {canWrite && (
          <span className="ml-auto flex gap-2">
            <HeaderButton label="新建模块" onClick={() => setDialog({ kind: 'new-module' })} />
            <HeaderButton label="新建任务" onClick={() => setDialog({ kind: 'new-task' })} />
          </span>
        )}
      </div>
      <section className="grid gap-3">
        <h2 className="m-0 text-lg font-semibold">人员</h2>
        <People selectedId={selectedPersonId} onSelect={togglePerson} />
      </section>
      <section className="grid gap-3">
        <h2 className="m-0 text-lg font-semibold">模块</h2>
        <Gantt colors={moduleColors} selectedId={selectedModuleId} onSelect={toggleModule} />
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="m-0 text-lg font-semibold">任务看板</h2>
          {selectedPersonId !== null && <PersonFilterNote personId={selectedPersonId} onClear={() => setSelectedPersonId(null)} />}
        </div>
        {tasks.length === 0 ? (
          <p className="m-0 text-[13px] text-fd-muted-foreground">还没有任务</p>
        ) : (
          <Board tasks={tasksOwnedBy(selectedPersonId, tasks)} colors={moduleColors} filter={filter} setFilter={setFilter} />
        )}
      </section>
      {dialog?.kind === 'new-task' && (
        <Dialog title="新建任务" onClose={close}>
          <NewTaskForm module={selectedModuleId ?? undefined} onCancel={close} />
        </Dialog>
      )}
      {dialog?.kind === 'new-module' && (
        <Dialog title="新建模块" onClose={close}>
          <NewModuleForm onCancel={close} />
        </Dialog>
      )}
    </div>
  )
}
