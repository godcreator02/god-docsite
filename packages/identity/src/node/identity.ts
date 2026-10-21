import { identityOf, type SiteIdentity } from '../core/identity.js'
import { sitePeople } from './people-file.js'

/** 站点怎么跑：dev 是本机由 gwb-docsite 启动、可以写的开发服务；start 是 build 之后的发布版，全面只读 */
export type SiteRunMode = 'dev' | 'start'

/** 发布版只读的原因：写评论、改任务要在自己电脑上由 gwb 启动的站点里做，改完经 git 同步 */
const publishedSiteReadonlyReason = '只读：这是 build 之后的发布版，评论与任务只能在本机由 gwb 插件 gwb-docsite 启动的站点里写'

/**
 * 这个站的本机身份。start（发布版）一律只读，给了身份码也不看；
 * dev 按托管方（gwb-docsite）交来的身份码在站点的人员列表里找人，站点模板从托管方上下文里取出来传进来，没有就是 undefined
 */
export function siteIdentity(siteDir: string, mode: SiteRunMode, identityCode: string | undefined): SiteIdentity {
  if (mode === 'start') return { person: null, reason: publishedSiteReadonlyReason }
  return identityOf(sitePeople(siteDir), identityCode)
}
