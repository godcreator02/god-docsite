import type { ModuleGroup } from './module-groups.js'
import type { ModuleState, TaskState } from './state.js'
import { dayOf, moduleProgressOf } from './timeline.js'

/** 模块按截止日排，同一天的按 id：甘特图的行序，也是分模块色的顺序 */
export const byDue = (a: Pick<ModuleState, 'id' | 'due'>, b: Pick<ModuleState, 'id' | 'due'>) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id)

/** 样式表里模块色的种数（--collab-module-0 到 -7） */
export const modulePaletteSize = 8

/**
 * 按甘特图上的顺序轮流分模块色，相邻的模块颜色不同：模块 id → 色号。
 * 甘特图、看板卡片、日历、记录链接都用这一份，同一个模块在各处是同一种颜色
 */
export function moduleColorSlotsOf(modules: ReadonlyArray<Pick<ModuleState, 'id' | 'due'>>): Map<string, number> {
  return new Map([...modules].sort(byDue).map((module, index) => [module.id, index % modulePaletteSize]))
}

/** 任务页上的一张甘特图：group 为 null 的是不分组时的那一张，或分组之后剩下的「未分组」 */
export type ModuleSection = { group: ModuleGroup | null; modules: ModuleState[] }

/**
 * 模块分到各张甘特图：不分组时只有一张；分组时按分组列表的先后，没有模块的分组不画，
 * 没写分组、或写的分组不在列表里的（这已经列成问题）放进最后一张「未分组」。每张里按截止日排
 */
export function moduleSectionsOf(modules: readonly ModuleState[], groups: readonly ModuleGroup[]): ModuleSection[] {
  const sorted = [...modules].sort(byDue)
  if (groups.length === 0) return [{ group: null, modules: sorted }]
  const declaredIds = new Set(groups.map((group) => group.id))
  const sections: ModuleSection[] = groups.map((group) => ({ group, modules: sorted.filter((module) => module.group === group.id) })).filter((section) => section.modules.length > 0)
  const ungrouped = sorted.filter((module) => module.group === undefined || !declaredIds.has(module.group))
  if (ungrouped.length > 0) sections.push({ group: null, modules: ungrouped })
  return sections
}

export type DueState = 'finished' | 'overdue' | 'pending'

/** 模块到了截止日的样子：全部做完（任务数大于 0 且都做完）、过了截止日还没做完、还没到 */
export function dueStateOf(module: Pick<ModuleState, 'id' | 'due'>, tasks: ReadonlyArray<Pick<TaskState, 'module' | 'status'>>, today: number): DueState {
  const { done, total } = moduleProgressOf(module.id, tasks)
  if (total > 0 && done === total) return 'finished'
  return dayOf(module.due) < today ? 'overdue' : 'pending'
}
