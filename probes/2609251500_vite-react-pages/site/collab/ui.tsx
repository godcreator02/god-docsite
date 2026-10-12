import { Link } from 'react-router'
import { sitePages, type Task } from './data'
import { useCurrentPage } from './page-context'

const statusLabel: Record<Task['status'], string> = { todo: '未开始', doing: '进行中', done: '已完成' }
const statusStyle: Record<Task['status'], string> = {
  todo: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  doing: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <input type="checkbox" checked={task.status === 'done'} readOnly className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <span className={task.status === 'done' ? 'text-fd-muted-foreground line-through' : undefined}>{task.title}</span>
        {task.detail && <span className="block text-xs text-fd-muted-foreground">{task.detail}</span>}
      </div>
      <span className={`shrink-0 rounded px-1.5 text-xs leading-5 ${statusStyle[task.status]}`}>{statusLabel[task.status]}</span>
      <span className="w-16 shrink-0 text-right text-xs leading-5 text-fd-muted-foreground">{task.owner ?? '未指派'}</span>
    </li>
  )
}

function groupTasks(tasks: Task[]) {
  const groups = new Map<string, { when?: string; tasks: Task[] }>()
  for (const task of tasks) {
    const name = task.group ?? '未分组'
    if (!groups.has(name)) groups.set(name, { when: task.groupWhen, tasks: [] })
    groups.get(name)!.tasks.push(task)
  }
  return [...groups.entries()]
}

/** 当前页 collab.json 里的任务，按 group 分组；只显示，改状态由 AI 改 JSON */
export function TaskList() {
  const { collab } = useCurrentPage()
  const done = collab.tasks.filter((t) => t.status === 'done').length
  return (
    <div className="not-prose space-y-3 text-sm">
      <p className="text-fd-muted-foreground">
        已完成 {done} / {collab.tasks.length}
      </p>
      {groupTasks(collab.tasks).map(([name, group]) => (
        <div key={name} className="rounded-md border border-fd-border bg-fd-card px-4 py-3">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{name}</h3>
            {group.when && <span className="font-mono text-xs text-fd-muted-foreground">{group.when}</span>}
          </div>
          <ul>
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** 全站页面清单：每页未解决的批注数与未完成的任务数 */
export function PageIndex() {
  return (
    <ul className="not-prose divide-y divide-fd-border rounded-md border border-fd-border">
      {sitePages
        .filter((page) => page.url !== '/')
        .map((page) => {
          const openComments = page.collab.comments.filter((c) => c.status === 'open').length
          const openTasks = page.collab.tasks.filter((t) => t.status !== 'done').length
          return (
            <li key={page.key} className="flex items-center justify-between gap-4 px-4 py-2">
              <Link to={page.url} className="font-medium hover:underline">
                {page.title}
              </Link>
              <span className="text-xs text-fd-muted-foreground">
                未解决批注 {openComments} · 未完成任务 {openTasks}
              </span>
            </li>
          )
        })}
    </ul>
  )
}

/** 全站任务总览：按状态分三列 */
export function TaskBoard() {
  const all = sitePages.flatMap((page) => page.collab.tasks.map((task) => ({ task, page })))
  return (
    <div className="not-prose grid gap-4 md:grid-cols-3">
      {(['todo', 'doing', 'done'] as const).map((status) => {
        const items = all.filter(({ task }) => task.status === status)
        return (
          <section key={status} className="rounded-md border border-fd-border bg-fd-card p-3">
            <h2 className="mb-2 font-semibold">
              {statusLabel[status]}（{items.length}）
            </h2>
            <ul className="space-y-2 text-sm">
              {items.map(({ task, page }) => (
                <li key={`${page.key}:${task.id}`} className="rounded border border-fd-border p-2">
                  <p>{task.title}</p>
                  <p className="text-xs text-fd-muted-foreground">
                    <Link to={page.url} className="hover:underline">
                      {page.title}
                    </Link>
                    {' · '}
                    {task.owner ?? '未指派'}
                    {task.due ? ` · 截止 ${task.due}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
