import path from 'node:path'
import { siteFeedChannel, siteFeedOf as checkedSiteFeedOf, type SiteFeed } from '@godcreator/collab-model/notification-model'
import { collabState, isPlainObject } from '@godcreator/collab-model/task-model'
import { createRecord, deleteRecords, readCollabSnapshot, updateRecord, WriteRejected } from '@godcreator/collab-model/task-model/node'
import { feedStore } from '@godcreator/docsite-feed'
import { authorizeWrite, siteIdentity, sitePeople, WriteAccessError } from '@godcreator/docsite-identity/server'
import { journalMentionsOf, type JournalMention } from '../journal.js'
import { journalDatesOf, journalSourcesOf } from '@godcreator/collab-model/project-model'
import { collabWriteActions, type CollabSiteData, type CollabWriteAction, type SitePageRef } from '../site-data.js'

export type { CollabSiteData, JournalMention, SitePageRef }

/*
 * 路由文件的 loader 与 action 调用的函数。站点目录是进程的当前目录（基础包也这样算），协作仓的仓根是它的上一级：
 * 任务与模块在 <仓根>/collab/records/，人员列表在站点目录的 people.json
 */

const siteDirOf = () => process.cwd()
const repoOf = (siteDir: string) => path.dirname(siteDir)

/** gwb-collab 经推送通道交来的最新一份；还没交来为 null。推来的是外部输入，形状不对就报错 */
function collabFeed(): SiteFeed | null {
  const pushed = feedStore().get(siteFeedChannel)
  return pushed === undefined ? null : checkedSiteFeedOf(pushed)
}

/** 整站布局的 loader 调用：任务、模块、人员、本机身份、通知、有日志的日子；pages 是站里的页面，由骨架从页面树取来 */
export async function collabSiteData(pages: SitePageRef[]): Promise<CollabSiteData> {
  const siteDir = siteDirOf()
  const { tasks, modules, problems } = collabState(await readCollabSnapshot(repoOf(siteDir)))
  const feed = collabFeed()
  return {
    tasks,
    modules,
    problems,
    people: sitePeople(siteDir),
    person: siteIdentity(siteDir).person?.id ?? null,
    projectLeads: feed?.projectLeads ?? null,
    notifications: feed?.notifications ?? null,
    pages,
    journalDates: journalDatesOf(siteDir),
  }
}

/** 一条任务或一个模块那一页的「日志里的进展」：段里引用的别的记录换成它当前的标题，删了的写「已删除的记录」 */
export async function recordJournalMentions(recordId: string): Promise<JournalMention[]> {
  const siteDir = siteDirOf()
  const { tasks, modules } = collabState(await readCollabSnapshot(repoOf(siteDir)))
  const titleById = new Map([...tasks, ...modules].map((record) => [record.id, record.title]))
  return journalMentionsOf(recordId, journalSourcesOf(siteDir), (id) => titleById.get(id) ?? '已删除的记录')
}

const errorResponse = (status: number, error: string) => Response.json({ error }, { status })

function parseWriteRequest(value: unknown): { action: CollabWriteAction; record: Record<string, unknown> } | string {
  if (!isPlainObject(value)) return '请求体要是 { action, record }'
  const unknownKey = Object.keys(value).find((key) => key !== 'action' && key !== 'record')
  if (unknownKey !== undefined) return `请求里认不出的字段 ${unknownKey}；只接受 action 与 record`
  const { action, record } = value
  if (!(collabWriteActions as readonly unknown[]).includes(action)) return `action 只能是 ${collabWriteActions.join('、')}，收到 ${JSON.stringify(action)}`
  if (!isPlainObject(record)) return 'record 要是一个对象'
  return { action: action as CollabWriteAction, record }
}

/** 这个站的可信 origin：写请求的 Origin 头要和它完全一样。开发与 start 端口不同时，启动方经 DOCSITE_ORIGIN 给对的那一个 */
export const siteOrigin = process.env.DOCSITE_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 4450}`

/**
 * 写任务与模块的接口（POST /api/collab，{ action, record }）：create 新建、update 改字段、delete 删掉，
 * 写的人是本机身份（Origin 核对照骨架的评论写入）；被写入规则拒绝回 422 和原话，只读或 Origin 不对回 403。只改 collab/records/ 里的文件，不跑 git
 */
export async function collabRecordResponse(request: Request): Promise<Response> {
  if (request.method !== 'POST') return errorResponse(405, `只接受 POST，收到 ${request.method}`)
  const siteDir = siteDirOf()
  let person: string
  try {
    person = authorizeWrite(request, { identity: siteIdentity(siteDir), people: sitePeople(siteDir), origin: siteOrigin }).id
  } catch (error) {
    if (error instanceof WriteAccessError) return errorResponse(error.status, error.message)
    throw error
  }
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return errorResponse(400, `请求体不是合法 JSON：${error.message}`)
  }
  const parsed = parseWriteRequest(body)
  if (typeof parsed === 'string') return errorResponse(400, parsed)
  const repo = repoOf(siteDir)
  try {
    if (parsed.action === 'create') return Response.json(await createRecord({ repo, person, body: parsed.record }))
    if (parsed.action === 'update') return Response.json(await updateRecord({ repo, person, body: parsed.record }))
    return Response.json(await deleteRecords({ repo, person, body: parsed.record, projectLeads: collabFeed()?.projectLeads ?? [] }))
  } catch (error) {
    if (error instanceof WriteRejected) return errorResponse(422, error.message)
    throw error
  }
}
