import type { Notification } from '@godcreator/collab-model/notification-model'
import type { CollabProblem, ModuleState, Person, TaskState } from '@godcreator/collab-model/task-model'

/** 站里的一页：地址与标题，任务链接页面时从这里选 */
export type SitePageRef = { url: string; title: string }

/**
 * 整站布局的 loader 交给界面的协作数据，浏览器端与服务端是同一个形状。
 * person 是本机身份（站点人员列表里的 id，也是 Gitea 用户名），只读时为 null；
 * projectLeads、notifications 是 gwb-collab 经推送通道交来的，还没交来时为 null
 */
export type CollabSiteData = {
  tasks: TaskState[]
  modules: ModuleState[]
  problems: CollabProblem[]
  people: Person[]
  person: string | null
  projectLeads: string[] | null
  notifications: Notification[] | null
  pages: SitePageRef[]
  journalDates: string[]
}

/** 浏览器写任务与模块的接口：POST { action, record } */
export const collabApiUrl = '/api/collab'

export const collabWriteActions = ['create', 'update', 'delete'] as const
export type CollabWriteAction = (typeof collabWriteActions)[number]

export const calendarUrl = '/calendar'

/** 某一天（YYYY-MM-DD）的日志页 */
export function journalUrlOf(date: string): string {
  return `${calendarUrl}/${date}`
}

/** 日志页的文件名与日期规则：collab-model 的 project-model/journal-files.ts（Node 侧）有同一份，改时两处一起 */
export const journalFilePattern = /^(\d{4}-\d{2}-\d{2})\.mdx$/

/** YYYY-MM-DD 是不是真实存在的日期 */
export function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const day = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date
}
