/** 一天的毫秒数；dayOf 换出的日子之间正好差它的整数倍 */
export const dayMs = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' 开头的日期换成 UTC 零点的毫秒数，只比较日子，不管时区 */
export function dayOf(date: string) {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
}

/** UTC 零点的毫秒数换回 YYYY-MM-DD */
export function isoDateOf(day: number) {
  return new Date(day).toISOString().slice(0, 10)
}

export function todayDay() {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

/** 模块的进度：归进这个模块的任务做完几个、共几个。模块不存状态，完没完成都从这里看 */
export function moduleProgressOf(moduleId: string, tasks: ReadonlyArray<{ module?: string; status: string }>) {
  const inModule = tasks.filter((task) => task.module === moduleId)
  return { done: inModule.filter((task) => task.status === 'done').length, total: inModule.length }
}

/** 任务的截止日晚于它所属模块的截止日；日期是 YYYY-MM-DD，按字符串比就是按日期比 */
export function isLaterThanModule(task: { module?: string; due?: string }, modules: ReadonlyArray<{ id: string; due: string }>) {
  if (task.module === undefined || task.due === undefined) return false
  const module = modules.find((entry) => entry.id === task.module)
  return module !== undefined && task.due > module.due
}

/** 时间轴：起点是最早的截止日与今天里更早的那天，前面留两天；终点是最晚的截止日与今天里更晚的那天，后面留三天。每个月的一号画刻度 */
export function timelineAxisOf(dues: number[], today: number) {
  const from = Math.min(today, ...dues) - 2 * dayMs
  const to = Math.max(today, ...dues) + 3 * dayMs
  const monthStarts: number[] = []
  const cursor = new Date(from)
  cursor.setUTCDate(1)
  for (cursor.setUTCMonth(cursor.getUTCMonth() + 1); cursor.getTime() < to; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) monthStarts.push(cursor.getTime())
  const percentOf = (day: number) => ((day - from) / (to - from)) * 100
  return { today, from, to, monthStarts, percentOf }
}
