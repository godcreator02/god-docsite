import type { CommentsAccess, PageThreadSummary } from '@godcreator/comments/site'
import type { PublicPerson, SiteIdentity } from '@godcreator/identity'
import type { JournalMention } from '../core/journal-mentions.js'
import type { ModuleGroup } from '../core/module-groups.js'
import type { DueState } from '../core/modules.js'
import type { Notification } from '../core/notifications/notifications.js'
import type { TaskStatus } from '../core/records.js'
import type { ModuleState, TaskState } from '../core/state.js'

/*
 * loader 交给页面组件的数据：服务端的 loader 与浏览器里的组件是同一个形状。
 * 人员一律是公开形状（publicPeopleOf 的结果），不带身份码
 */

/** 站里的一页：地址与标题，任务链接页面时从这里选 */
export type SitePageRef = { url: string; title: string }

/**
 * 看页面的人与项目里的人：person 是本机身份（人员列表里的 id，也是 Gitea 用户名），只读时为 null；
 * projectLeads 是推送通道交来的项目负责人，还没交来为 null
 */
export type CollabViewer = { people: PublicPerson[]; person: string | null; projectLeads: string[] | null }

/** 一页上的评论：这一页的评论串与能不能写 */
export type PageComments = { threads: PageThreadSummary[]; access: CommentsAccess }

/** 整站布局用的轻量数据：公开人员、本机身份、推送通道交来的通知与交给 AI 的提示词（还没交来都为 null）；不读 collab/ */
export type CollabLayoutData = { people: PublicPerson[]; person: string | null; notifications: Notification[] | null; aiPrompt: string | null }

export type TasksPageData = CollabViewer & {
  siteName: string
  tasks: TaskState[]
  modules: ModuleState[]
  /** collab/groups.json 列的分组，空的是不分组：甘特图只画一张 */
  groups: ModuleGroup[]
  pages: SitePageRef[]
  comments: PageComments
}

/** 记录那一页画的那一条：任务，或模块连同归进它的任务 */
export type ShownRecord = { kind: 'task'; task: TaskState } | { kind: 'module'; module: ModuleState; moduleTasks: TaskState[] }

export type RecordPageData = CollabViewer & {
  siteName: string
  record: ShownRecord
  /** 全部模块：任务选所属模块用 */
  modules: ModuleState[]
  /** 分组：模块选所属分组用，空的是不分组 */
  groups: ModuleGroup[]
  pages: SitePageRef[]
  mentions: JournalMention[]
  comments: PageComments
}

export type CalendarPageData = { siteName: string; tasks: TaskState[]; modules: ModuleState[]; journalDates: string[] }

/**
 * 项目首页：全部任务与模块（没做完的、快到期的由页面挑）、最近有日志的几天（新的在前）。
 * 首页在整站布局之外，没有布局给的 IdentityProvider：identity 与 people 由首页自己交给它，头像才查得到
 */
export type ProjectHomeData = CollabViewer & { identity: SiteIdentity; tasks: TaskState[]; modules: ModuleState[]; recentJournalDates: string[] }

export type JournalPageData = {
  siteName: string
  date: string
  hasJournal: boolean
  journalDates: string[]
  /** 全部模块：当天截止的模块按甘特图的顺序配色 */
  modules: ModuleState[]
  comments: PageComments
}

/** 正文里一条记录链接要显示的：任务带状态与所属模块的色号，模块带截止日的样子与色号 */
export type RecordLinkSummary =
  | { kind: 'task'; id: string; title: string; status: TaskStatus; module: { id: string; title: string; colorSlot: number } | null }
  | { kind: 'module'; id: string; title: string; due: string; dueState: DueState; colorSlot: number }

/** 记录链接资源路由的回答：问到的记录里还在的那些（删了的不在里面），以及有日志的日子 */
export type RecordLinkTargets = { records: RecordLinkSummary[]; journalDates: string[] }

/** 写入 action 的回答：成功，或被拒时给人看的原话（随 4xx 状态码）；新建与删除成功时 action 直接跳转，不回这个 */
export type WriteResult = { ok: true; intent: string } | { ok: false; error: string }
