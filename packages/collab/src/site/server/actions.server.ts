import { commentIntents } from '@godcreator/comments/site/server'
import { authorizeWrite, WriteAccessError } from '@godcreator/identity'
import { data, redirect } from 'react-router'
import { recordPageUrlOf, tasksPageUrl } from '../../core/layout.js'
import { WriteRejected } from '../../core/write-rules.js'
import { createRecord, deleteRecords, updateRecord } from '../../node/write.js'
import type { CollabRouteArgs, CollabSite } from '../collab-site.js'
import type { WriteResult } from '../page-data.js'
import { isRecordIntent, recordIntents, type RecordIntent } from '../record-intents.js'
import { writeComment } from './comments.server.js'
import { requestSubmit, submitIntent, SubmitRequestRejected } from './submit.server.js'

/** 写入请求的表单不对：缺字段、多字段、字段是文件；status 是要回给浏览器的 400 */
class RecordFormRejected extends Error {
  readonly status = 400
}

async function formOf(request: Request): Promise<FormData> {
  try {
    return await request.formData()
  } catch (error) {
    if (error instanceof TypeError) throw new RecordFormRejected(`请求体要是表单：${error.message}`)
    throw error
  }
}

function textFieldsOf(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [name, value] of form) {
    if (typeof value !== 'string') throw new RecordFormRejected(`${name} 要是文字，收到的是文件`)
    if (name in fields) throw new RecordFormRejected(`${name} 写了不止一次`)
    fields[name] = value
  }
  return fields
}

/** 只收这几个字段，缺了、多了都拒绝 */
function exactFields<const Name extends string>(fields: Record<string, string>, intent: RecordIntent, names: readonly Name[]): Record<Name, string> {
  const unknownName = Object.keys(fields).find((name) => name !== 'intent' && !(names as readonly string[]).includes(name))
  if (unknownName !== undefined) throw new RecordFormRejected(`${intent} 认不出字段 ${unknownName}，能写的只有 intent、${names.join('、')}`)
  const missingName = names.find((name) => !(name in fields))
  if (missingName !== undefined) throw new RecordFormRejected(`${intent} 缺 ${missingName} 字段`)
  return fields as Record<Name, string>
}

/** 新建时的记录字段：intent 以外的全部字段；认不出的字段由写入规则按记录格式拒绝 */
function newRecordOf(fields: Record<string, string>): Record<string, string> {
  const { intent: _intent, ...record } = fields
  return record
}

/** 按 intent 新建、改一个字段或删掉一条记录；新建、删除成功后跳转，改字段成功回 { ok: true } */
async function performRecordWrite(fields: Record<string, string>, intent: RecordIntent, actor: string, site: CollabSite) {
  const repo = site.repoDir
  switch (intent) {
    case 'create-record': {
      const { id } = await createRecord({ repo, person: actor, body: newRecordOf(fields) })
      return redirect(recordPageUrlOf(id))
    }
    case 'update-record': {
      const { id, field, value } = exactFields(fields, intent, ['id', 'field', 'value'])
      await updateRecord({ repo, person: actor, body: { id, fields: { [field]: value } } })
      return data<WriteResult>({ ok: true, intent })
    }
    case 'delete-record': {
      const { id } = exactFields(fields, intent, ['id'])
      await deleteRecords({ repo, person: actor, body: { ids: [id] }, projectLeads: site.feed()?.projectLeads ?? [] })
      return redirect(tasksPageUrl)
    }
  }
}

function rejectionOf(error: unknown) {
  if (error instanceof WriteAccessError || error instanceof RecordFormRejected || error instanceof SubmitRequestRejected) return data<WriteResult>({ ok: false, error: error.message }, { status: error.status })
  if (error instanceof WriteRejected) return data<WriteResult>({ ok: false, error: error.message }, { status: 422 })
  throw error
}

/** 表单的 intent：评论包的交给评论写入，一键提交交给 gwb-collab，其余要是写任务与模块的三种 */
async function intentOf(request: Request): Promise<string | null> {
  const intent = (await formOf(request.clone())).get('intent')
  return typeof intent === 'string' ? intent : null
}

/**
 * 任务页与记录那一页的路由 action：写评论（评论包的 intent）、写任务与模块（record-intents.ts 的三种），或一键提交（request-submit，网页提示栏的按钮提交到这里）。
 * 写的人是本机身份，请求的 Origin 要等于 site.trustedOrigin；被写入规则拒绝回 422 与原话，表单不对回 400，
 * 只读或来源不对回 403。只改 collab/records/ 里的文件，不跑 git：一键提交只往频道 collab-submit 写一份请求
 */
export async function recordAction({ request }: CollabRouteArgs, site: CollabSite) {
  try {
    const intent = await intentOf(request)
    if ((commentIntents as readonly (string | null)[]).includes(intent)) return await writeComment(request, site)
    if (intent !== submitIntent && !isRecordIntent(intent)) {
      throw new RecordFormRejected(`认不出 intent ${JSON.stringify(intent)}，能写的只有 ${[...commentIntents, ...recordIntents, submitIntent].join('、')}`)
    }
    const actor = authorizeWrite(request, { identity: site.identity(), people: site.people(), origin: site.trustedOrigin }).id
    const fields = textFieldsOf(await formOf(request))
    if (intent === submitIntent) {
      const unknownName = Object.keys(fields).find((name) => name !== 'intent')
      if (unknownName !== undefined) throw new RecordFormRejected(`${submitIntent} 认不出字段 ${unknownName}，只收 intent`)
      requestSubmit(site, actor)
      return data<WriteResult>({ ok: true, intent })
    }
    return await performRecordWrite(fields, intent, actor, site)
  } catch (error) {
    return rejectionOf(error)
  }
}

/** 日志页的路由 action：只写评论 */
export function commentAction({ request }: CollabRouteArgs, site: CollabSite) {
  return writeComment(request, site)
}
