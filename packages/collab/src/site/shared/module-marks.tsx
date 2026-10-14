import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { moduleColorSlotsOf, type DueState } from '../../core/modules.js'
import type { ModuleState } from '../../core/state.js'

/** 一个色号的模块色：写在元素上的 --module、--module-soft，里面的 bg-module、text-module 就是这个颜色（样式在包的 styles.css） */
export function moduleColorStyleOf(slot: number): CSSProperties {
  return { '--module': `var(--collab-module-${slot})`, '--module-soft': `var(--collab-module-${slot}-soft)` } as CSSProperties
}

/** 模块 id → 模块色，按 moduleColorSlotsOf 分 */
export function moduleColorsOf(modules: ReadonlyArray<Pick<ModuleState, 'id' | 'due'>>): Map<string, CSSProperties> {
  return new Map([...moduleColorSlotsOf(modules)].map(([id, slot]) => [id, moduleColorStyleOf(slot)]))
}

const dueStateLabel: Record<DueState, string> = { finished: '全部做完', overdue: '过了截止日还没做完', pending: '还没做完' }

/** 模块截止日的记号，用模块色（外层元素要带模块色的样式）：没做完是实心菱形，全部做完是勾，过期加红框 */
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
