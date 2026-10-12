import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { ModuleState, TaskState } from '@godcreator/collab-model/task-model'
import { dayOf, moduleProgressOf } from '../timeline.js'

/** 模块按截止日排，同一天的按 id：甘特图的行序，也是分模块色的顺序 */
export const byDue = (a: ModuleState, b: ModuleState) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id)

/** 样式表里模块色的种数（--collab-module-0 到 -7） */
const modulePaletteSize = 8

/**
 * 按甘特图上的顺序轮流分模块色，相邻的模块颜色不同；值是写在元素上的 --module、--module-soft。
 * 甘特图、看板卡片、日历、RecordLink 都用这一份，同一个模块在各处是同一种颜色
 */
export function moduleColorsOf(modules: ModuleState[]): Map<string, CSSProperties> {
  return new Map(
    [...modules].sort(byDue).map((module, index) => {
      const slot = index % modulePaletteSize
      return [module.id, { '--module': `var(--collab-module-${slot})`, '--module-soft': `var(--collab-module-${slot}-soft)` } as CSSProperties]
    }),
  )
}

export type DueState = 'finished' | 'overdue' | 'pending'

/** 模块到了截止日的样子：全部做完（任务数大于 0 且都做完）、过了截止日还没做完、还没到 */
export function dueStateOf(module: ModuleState, tasks: TaskState[], today: number): DueState {
  const { done, total } = moduleProgressOf(module.id, tasks)
  if (total > 0 && done === total) return 'finished'
  return dayOf(module.due) < today ? 'overdue' : 'pending'
}

const dueStateLabel: Record<DueState, string> = { finished: '全部做完', overdue: '过了截止日还没做完', pending: '还没做完' }

/** 模块截止日的记号，用模块色（外层元素要带 moduleColorsOf 给的样式）：没做完是实心菱形，全部做完是勾，过期加红框 */
export function DueMark({ state, size = 11 }: { state: DueState; size?: number }) {
  if (state === 'finished') {
    return (
      <span aria-label={dueStateLabel.finished} className="inline-flex shrink-0 items-center justify-center rounded-full bg-module text-fd-background" style={{ width: size + 3, height: size + 3 }}>
        <Check size={size - 1} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span
      aria-label={dueStateLabel[state]}
      className={`inline-block shrink-0 rotate-45 rounded-[2px] bg-module ${state === 'overdue' ? 'outline-2 outline-offset-2 outline-danger outline-solid' : ''}`}
      style={{ width: size, height: size }}
    />
  )
}
