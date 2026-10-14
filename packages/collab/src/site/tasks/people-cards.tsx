import type { PublicPerson } from '@godcreator/identity'
import { byDue } from '../../core/modules.js'
import type { ModuleState, TaskState } from '../../core/state.js'
import { dayOf, todayDay } from '../../core/timeline.js'
import { PersonAvatar } from '../shared/parts.js'
import { useCollabViewer } from '../shared/viewer.js'

/** 一个人的工作量：没做完的任务数、其中过了截止日的数、他负责的模块 */
function workloadOf(personId: string, tasks: TaskState[], modules: ModuleState[], today: number) {
  const unfinished = tasks.filter((task) => task.owner === personId && task.status !== 'done')
  const overdue = unfinished.filter((task) => task.due !== undefined && dayOf(task.due) < today).length
  const ownedModules = modules.filter((module) => module.owner === personId).sort(byDue)
  return { unfinished: unfinished.length, overdue, ownedModules }
}

type WorkSet = { tasks: TaskState[]; modules: ModuleState[] }

function PersonCard({ person, work, today, selected, onSelect }: { person: PublicPerson; work: WorkSet; today: number; selected: boolean; onSelect: (id: string) => void }) {
  const { unfinished, overdue, ownedModules } = workloadOf(person.id, work.tasks, work.modules, today)
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

/** 人员列表一人一张卡（agent 不列），写每人没做完、过期的任务数和负责的模块。点一张卡，看板只显示他负责的任务（再点取消） */
export function PeopleCards({ work, selectedId, onSelect }: { work: WorkSet; selectedId: string | null; onSelect: (id: string) => void }) {
  const people = useCollabViewer().people.filter((person) => !person.agent)
  if (people.length === 0) return <p className="m-0 text-[13px] text-fd-muted-foreground">站点的 people.json 里还没有人</p>
  const today = todayDay()
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((person) => (
        <PersonCard key={person.id} person={person} work={work} today={today} selected={selectedId === person.id} onSelect={onSelect} />
      ))}
    </div>
  )
}
