import { identityOf, type SiteIdentity } from '../core/identity.js'
import { sitePeople } from './people-file.js'

/** 启动方（gwb-docsite）把本机的身份码放在这个环境变量里 */
export const identityCodeEnvName = 'DOCSITE_IDENTITY_CODE'

/** 站点怎么跑：dev 是本机由 gwb-docsite 启动、可以写的开发服务；start 是 build 之后的发布版，全面只读 */
export type SiteRunMode = 'dev' | 'start'

/** 发布版只读的原因：写评论、改任务要在自己电脑上由 gwb 启动的站点里做，改完经 git 同步 */
const publishedSiteReadonlyReason = '只读：这是 build 之后的发布版，评论与任务只能在本机由 gwb 插件 gwb-docsite 启动的站点里写'

/**
 * 这个站的本机身份。start（发布版）一律只读，环境变量里有身份码也不看；
 * dev 按环境变量 DOCSITE_IDENTITY_CODE 的身份码在站点的人员列表里找人
 */
export function siteIdentity(siteDir: string, mode: SiteRunMode): SiteIdentity {
  if (mode === 'start') return { person: null, reason: publishedSiteReadonlyReason }
  return identityOf(sitePeople(siteDir), process.env[identityCodeEnvName])
}
