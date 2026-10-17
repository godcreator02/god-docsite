import { isSubmitInProgress } from '../../core/notifications/submit-state.js'
import type { CollabSite } from '../collab-site.js'

/** 网页上点一键提交的表单 intent */
export const submitIntent = 'request-submit'

/** 一键提交的请求被拒：站点没接、gwb-collab 没在听、已经在提交；status 是要回给浏览器的状态码 */
export class SubmitRequestRejected extends Error {
  readonly status: 409 | 501 | 503

  constructor(status: 409 | 501 | 503, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * 网页上点了一键提交：往频道 collab-submit 写一份 requested，由在听的 gwb-collab 接手提交审核。网站自己不跑 git。
 * 站点没接这个频道 501；gwb-collab 没在听 503（不写请求，免得留下一份没人接的）；已经在提交 409
 */
export function requestSubmit(site: CollabSite, person: string, now = new Date()): void {
  const channel = site.submit
  if (channel === undefined) throw new SubmitRequestRejected(501, '这个站没接一键提交：站点 app/features/collab/ 里的接线文件是旧的，照 @godcreator/collab 的 template/ 更新')
  if (!channel.workbenchListening()) throw new SubmitRequestRejected(503, '工作台没连着这个站：gwb-collab 没在运行，或者版本太旧、不认一键提交。点「复制给 AI」让 AI 调 collab.submit')
  const current = channel.state()
  if (isSubmitInProgress(current)) throw new SubmitRequestRejected(409, `已经在提交审核了（${current.by} 在 ${current.at} 发起的），等这次完了再点`)
  channel.publish({ state: 'requested', by: person, at: now.toISOString() })
}
