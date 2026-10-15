import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { calendarUrl, journalUrlOf, recordPageUrlOf, tasksPageUrl } from '../../core/layout.js'
import { byDue, dueStateOf, moduleColorSlotsOf } from '../../core/modules.js'
import type { ModuleState, TaskState } from '../../core/state.js'
import { dayOf, moduleProgressOf, todayDay } from '../../core/timeline.js'
import type { ProjectHomeData } from '../page-data.js'
import { DueMark, moduleColorStyleOf } from '../shared/module-marks.js'
import { PersonAvatar, StatusDot, statusLabel } from '../shared/parts.js'
import { CollabViewerProvider, useCollabViewer, useNameOf } from '../shared/viewer.js'

/** 每一栏最多列几条，多出来的到任务页、日历去看 */
const shownTaskCount = 8
const shownModuleCount = 5

const buttonClassName = 'rounded-lg px-4 py-2 text-sm font-medium transition-colors'

function Section({ title, more, children }: { title: string; more?: { to: string; text: string }; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-fd-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {more && (
          <Link to={more.to} className="text-[13px] text-fd-muted-foreground hover:text-fd-foreground">
            {more.text} →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] text-fd-muted-foreground">{children}</p>
}

function TaskRow({ task, today }: { task: TaskState; today: number }) {
  const overdue = task.due !== undefined && dayOf(task.due) < today
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span title={statusLabel[task.status]}>
        <StatusDot status={task.status} />
      </span>
      <Link to={recordPageUrlOf(task.id)} className="min-w-0 flex-1 truncate text-[14px] hover:underline">
        {task.title}
      </Link>
      {task.due !== undefined && <span className={`shrink-0 text-[12px] tabular-nums ${overdue ? 'text-danger' : 'text-fd-muted-foreground'}`}>{task.due}</span>}
      {task.owner !== undefined && <PersonAvatar personId={task.owner} size={20} />}
    </li>
  )
}

function ModuleRow({ module, tasks, colorSlot, today }: { module: ModuleState; tasks: TaskState[]; colorSlot: number; today: number }) {
  const { done, total } = moduleProgressOf(module.id, tasks)
  return (
    <li className="flex min-w-0 items-center gap-2" style={moduleColorStyleOf(colorSlot)}>
      <DueMark state={dueStateOf(module, tasks, today)} />
      <Link to={recordPageUrlOf(module.id)} className="min-w-0 flex-1 truncate text-[14px] hover:underline">
        {module.title}
      </Link>
      <span className="shrink-0 text-[12px] text-fd-muted-foreground tabular-nums">
        {done}/{total} · {module.due} 截止
      </span>
    </li>
  )
}

/** 我没做完的任务（有本机身份时），只读时是全部没做完的任务；按截止日排，没写截止日的在后面 */
function OpenTasks({ tasks, today }: { tasks: TaskState[]; today: number }) {
  const { person } = useCollabViewer()
  const open = tasks
    .filter((task) => task.status !== 'done' && (person === null || task.owner === person))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.id.localeCompare(b.id))
  return (
    <Section title={person === null ? '没做完的任务' : '我没做完的任务'} more={{ to: tasksPageUrl, text: '全部任务' }}>
      {open.length === 0 ? (
        <Empty>{person === null ? '任务都做完了' : '分给我的任务都做完了'}</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {open.slice(0, shownTaskCount).map((task) => (
            <TaskRow key={task.id} task={task} today={today} />
          ))}
          {open.length > shownTaskCount && <li className="text-[12px] text-fd-muted-foreground">还有 {open.length - shownTaskCount} 个</li>}
        </ul>
      )}
    </Section>
  )
}

/** 还没做完的模块，按截止日排：过期的、快到期的在前 */
function UpcomingModules({ tasks, modules, today }: { tasks: TaskState[]; modules: ModuleState[]; today: number }) {
  const colorSlots = moduleColorSlotsOf(modules)
  const unfinished = [...modules].sort(byDue).filter((module) => dueStateOf(module, tasks, today) !== 'finished')
  return (
    <Section title="快到期的模块" more={{ to: tasksPageUrl, text: '甘特图' }}>
      {unfinished.length === 0 ? (
        <Empty>没有没做完的模块</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {unfinished.slice(0, shownModuleCount).map((module) => (
            <ModuleRow key={module.id} module={module} tasks={tasks} colorSlot={colorSlots.get(module.id)!} today={today} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function RecentJournals({ dates }: { dates: string[] }) {
  return (
    <Section title="最近的日志" more={{ to: calendarUrl, text: '日历' }}>
      {dates.length === 0 ? (
        <Empty>还没有写过日志</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {dates.map((date) => (
            <li key={date}>
              <Link to={journalUrlOf(date)} className="text-[14px] tabular-nums hover:underline">
                {date}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Members({ tasks }: { tasks: TaskState[] }) {
  const people = useCollabViewer().people.filter((person) => !person.agent)
  const nameOf = useNameOf()
  return (
    <Section title="成员">
      {people.length === 0 ? (
        <Empty>站点的 people.json 里还没有人</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {people.map((person) => {
            const open = tasks.filter((task) => task.owner === person.id && task.status !== 'done').length
            return (
              <li key={person.id} className="flex items-center gap-2">
                <PersonAvatar personId={person.id} size={24} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{nameOf(person.id)}</span>
                <span className="text-[12px] text-fd-muted-foreground tabular-nums">{open} 个没做完</span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/**
 * 协作站的首页正文：项目名、一句话与两个按钮，下面四栏——没做完的任务（有本机身份时只列我的）、快到期的模块、最近的日志、成员。
 * 放在站点 app/routes/home.tsx 的 SiteHomeLayout 里；数据由 projectHomeLoader 给，docsUrl 是平台 siteHomeData 的「文档」地址
 */
export function ProjectHome({ siteName, docsUrl, data }: { siteName: string; docsUrl: string; data: ProjectHomeData }) {
  const today = todayDay()
  const openCount = data.tasks.filter((task) => task.status !== 'done').length
  const unfinishedModules = data.modules.filter((module) => dueStateOf(module, data.tasks, today) !== 'finished').length
  return (
    <CollabViewerProvider viewer={data}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14">
        <section className="flex flex-col items-center gap-4 text-center">
          <h1 className="m-0 text-4xl font-bold">{siteName}</h1>
          <p className="m-0 text-fd-muted-foreground tabular-nums">
            {openCount} 个任务没做完 · {unfinishedModules} 个模块进行中
          </p>
          <div className="flex gap-3">
            <Link to={docsUrl} className={`${buttonClassName} bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90`}>
              看文档
            </Link>
            <Link to={tasksPageUrl} className={`${buttonClassName} border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent`}>
              看任务
            </Link>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <OpenTasks tasks={data.tasks} today={today} />
          <UpcomingModules tasks={data.tasks} modules={data.modules} today={today} />
          <RecentJournals dates={data.recentJournalDates} />
          <Members tasks={data.tasks} />
        </div>
      </div>
    </CollabViewerProvider>
  )
}
