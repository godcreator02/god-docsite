import { createReadStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { authorizeWrite, WriteAccessError } from '@godcreator/identity'
import { sitePeople } from '@godcreator/identity/node'
import { data } from 'react-router'
import { dueStateOf, moduleColorSlotsOf } from '../../core/modules.js'
import type { RepoLinkCheck } from '../../core/repo-links.js'
import { collabState, type ModuleState, type TaskState } from '../../core/state.js'
import { todayDay } from '../../core/timeline.js'
import { journalDatesOf } from '../../node/journal-files.js'
import { projectDirOfSite } from '../../node/project-dir.js'
import { browserContentTypeOf, checkRepoLink, openRepoLinkLocally, projectFileOf } from '../../node/repo-links.js'
import { readCollabSnapshot } from '../../node/snapshot.js'
import type { CollabRouteArgs, CollabSite } from '../collab-site.js'
import type { RecordLinkSummary, RecordLinkTargets, WriteResult } from '../page-data.js'

function recordLinkSummaryOf(id: string, tasks: TaskState[], modules: ModuleState[], colorSlots: ReadonlyMap<string, number>): RecordLinkSummary | null {
  const task = tasks.find((entry) => entry.id === id)
  if (task) {
    const module = task.module === undefined ? undefined : modules.find((entry) => entry.id === task.module)
    return { kind: 'task', id, title: task.title, status: task.status, module: module ? { id: module.id, title: module.title, colorSlot: colorSlots.get(module.id)! } : null }
  }
  const module = modules.find((entry) => entry.id === id)
  if (module) return { kind: 'module', id, title: module.title, due: module.due, dueState: dueStateOf(module, tasks, todayDay()), colorSlot: colorSlots.get(module.id)! }
  return null
}

/** GET ?id=<记录 id>（可写多个）：正文里的记录链接与日志链接要显示的；问到的记录删了就不在回答里 */
export async function recordLinksLoader({ request }: CollabRouteArgs, site: CollabSite): Promise<RecordLinkTargets> {
  const ids = new URL(request.url).searchParams.getAll('id')
  const { tasks, modules } = collabState(await readCollabSnapshot(site.repoDir))
  const colorSlots = moduleColorSlotsOf(modules)
  return { records: ids.flatMap((id) => recordLinkSummaryOf(id, tasks, modules, colorSlots) ?? []), journalDates: journalDatesOf(site.siteDir) }
}

/** 只读的站点（没有本机身份）不碰项目文件夹：发布出去的站点上，别的仓不该经它交出去 */
function readOnlyReasonOf(site: CollabSite): string | null {
  const identity = site.identity()
  return identity.person ? null : `只读的站点打不开 repo: 链接（${identity.reason}），在本机的协作站里打开`
}

/** GET ?target=<repo: 链接>：能不能打开、怎么打开；只读的站点一律回 read-only */
export async function repoLinksLoader({ request }: CollabRouteArgs, site: CollabSite): Promise<RepoLinkCheck> {
  const target = new URL(request.url).searchParams.get('target')
  if (target === null) throw data('缺 target 参数：GET ?target=repo:<仓>/<路径>', { status: 400 })
  const readOnly = readOnlyReasonOf(site)
  if (readOnly) return { target, state: 'read-only', problem: readOnly }
  return checkRepoLink(projectDirOfSite(site.siteDir), target)
}

/** 打开 repo: 链接被拒：status 是要回给浏览器的状态码，message 给人看 */
class RepoLinkOpenRejected extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function targetOf(form: FormData): string {
  const unknownName = [...form.keys()].find((name) => name !== 'target')
  if (unknownName !== undefined) throw new RepoLinkOpenRejected(400, `认不出字段 ${unknownName}，只收 target`)
  const target = form.get('target')
  if (typeof target !== 'string') throw new RepoLinkOpenRejected(400, '缺 target 字段，要是 repo: 链接的文字')
  return target
}

/** 打开前先查：打不开的、该由页面在浏览器里打开的拒绝 */
async function openableTarget(projectDir: string, target: string): Promise<void> {
  const check = await checkRepoLink(projectDir, target)
  if (check.state !== 'ok') throw new RepoLinkOpenRejected(422, `${target}：${check.problem}`)
  if (check.open.how === 'browser') throw new RepoLinkOpenRejected(422, `${target} 由页面在浏览器里打开，不经站点服务`)
}

/**
 * POST 表单 { target }：在本机用 VS Code 或系统默认程序打开一条 repo: 链接。要有本机身份、Origin 等于 site.trustedOrigin（403）；
 * 链接打不开 422；VS Code 的 code 命令运行失败 500，都带给人看的原话
 */
export async function repoLinkAction({ request }: CollabRouteArgs, site: CollabSite) {
  try {
    authorizeWrite(request, { identity: site.identity(), people: sitePeople(site.siteDir), origin: site.trustedOrigin })
    const target = targetOf(await request.formData())
    const projectDir = projectDirOfSite(site.siteDir)
    await openableTarget(projectDir, target)
    await openRepoLinkLocally(projectDir, target).catch((error: Error) => {
      throw new RepoLinkOpenRejected(500, error.message)
    })
    return data<WriteResult>({ ok: true, intent: 'open' })
  } catch (error) {
    if (error instanceof WriteAccessError || error instanceof RepoLinkOpenRejected) return data<WriteResult>({ ok: false, error: error.message }, { status: error.status })
    throw error
  }
}

/** GET <projectFileApiUrl><仓>/<路径>（路由参数 *）：PDF、图片、网页、视频交给浏览器；只读的站点回 403 */
export function projectFileLoader({ params }: CollabRouteArgs, site: CollabSite): Response {
  const readOnly = readOnlyReasonOf(site)
  if (readOnly) return new Response(readOnly, { status: 403 })
  const urlPath = params['*'] ?? ''
  let file: string
  try {
    file = projectFileOf(projectDirOfSite(site.siteDir), urlPath)
  } catch (error) {
    return new Response((error as Error).message, { status: 404 })
  }
  if (!existsSync(file)) return new Response(`没有 ${urlPath}`, { status: 404 })
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { 'content-type': browserContentTypeOf(file)! } })
}
