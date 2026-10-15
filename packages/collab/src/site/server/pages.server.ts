import { data } from 'react-router'
import { isRealDate } from '../../core/journal.js'
import { journalMentionsOf } from '../../core/journal-mentions.js'
import { journalUrlOf, recordPageUrlOf, tasksPageUrl } from '../../core/layout.js'
import { isRecordId } from '../../core/records.js'
import { collabState, type ModuleState, type TaskState } from '../../core/state.js'
import { journalDatesOf, journalSourcesOf } from '../../node/journal-files.js'
import { readCollabSnapshot } from '../../node/snapshot.js'
import type { CollabRouteArgs, CollabSite } from '../collab-site.js'
import type { CalendarPageData, JournalPageData, ProjectHomeData, RecordPageData, ShownRecord, TasksPageData } from '../page-data.js'
import { pageCommentsOf } from './comments.server.js'
import { viewerOf } from './viewer.server.js'

/*
 * 页面的 loader。路由参数的名字是站点路由表与这里的约定：记录那一页是 tasks/:recordId，日志页是 calendar/:date
 */

async function collabStateOf(site: CollabSite) {
  return collabState(await readCollabSnapshot(site.repoDir))
}

/** /tasks：全部任务与模块、人员、站里的页面、这一页的评论 */
export async function tasksLoader(_args: CollabRouteArgs, site: CollabSite): Promise<TasksPageData> {
  const { tasks, modules } = await collabStateOf(site)
  return { siteName: site.siteName, ...viewerOf(site), tasks, modules, pages: [...site.pages()], comments: await pageCommentsOf(site, tasksPageUrl) }
}

function recordNotFound(recordId: string) {
  return data(`没有 id 为 ${recordId} 的任务或模块，可能已经被删掉了`, { status: 404 })
}

function shownRecordOf(recordId: string, tasks: TaskState[], modules: ModuleState[]): ShownRecord | null {
  const task = tasks.find((entry) => entry.id === recordId)
  if (task) return { kind: 'task', task }
  const module = modules.find((entry) => entry.id === recordId)
  if (module) return { kind: 'module', module, moduleTasks: tasks.filter((entry) => entry.module === module.id) }
  return null
}

/**
 * /tasks/:recordId：只交这一条任务或模块（模块连同归进它的任务）、选所属模块用的模块列表、日志里的进展与这一页的评论；
 * id 不是记录 id、或没有这条记录时抛 404
 */
export async function recordLoader({ params }: CollabRouteArgs, site: CollabSite): Promise<RecordPageData> {
  const recordId = params['recordId'] ?? ''
  if (!isRecordId(recordId)) throw recordNotFound(recordId)
  const { tasks, modules } = await collabStateOf(site)
  const record = shownRecordOf(recordId, tasks, modules)
  if (record === null) throw recordNotFound(recordId)
  const titleById = new Map([...tasks, ...modules].map((entry) => [entry.id, entry.title]))
  return {
    siteName: site.siteName,
    ...viewerOf(site),
    record,
    modules,
    pages: [...site.pages()],
    mentions: journalMentionsOf(recordId, journalSourcesOf(site.siteDir), (id) => titleById.get(id) ?? '已删除的记录'),
    comments: await pageCommentsOf(site, recordPageUrlOf(recordId)),
  }
}

/** /calendar：任务与模块（模块截止的记号要看任务做完没有）、有日志的日子 */
export async function calendarLoader(_args: CollabRouteArgs, site: CollabSite): Promise<CalendarPageData> {
  const { tasks, modules } = await collabStateOf(site)
  return { siteName: site.siteName, tasks, modules, journalDates: journalDatesOf(site.siteDir) }
}

/** 项目首页最多列几天的日志 */
const recentJournalDayCount = 5

/** /（项目首页）：人员与本机身份、全部任务与模块、最近有日志的几天 */
export async function projectHomeLoader(_args: CollabRouteArgs, site: CollabSite): Promise<ProjectHomeData> {
  const { tasks, modules } = await collabStateOf(site)
  const recentJournalDates = [...journalDatesOf(site.siteDir)].sort().reverse().slice(0, recentJournalDayCount)
  return { ...viewerOf(site), tasks, modules, recentJournalDates }
}

/** /calendar/:date：那一天有没有日志、前后有日志的日子、模块（当天截止的要配色）、这一页的评论；日期不是真实的 YYYY-MM-DD 时抛 404 */
export async function journalLoader({ params }: CollabRouteArgs, site: CollabSite): Promise<JournalPageData> {
  const date = params['date'] ?? ''
  if (!isRealDate(date)) throw data(`地址里的日期「${date}」不是 YYYY-MM-DD 的真实日期`, { status: 404 })
  const journalDates = journalDatesOf(site.siteDir)
  const { modules } = await collabStateOf(site)
  return { siteName: site.siteName, date, hasJournal: journalDates.includes(date), journalDates, modules, comments: await pageCommentsOf(site, journalUrlOf(date)) }
}
