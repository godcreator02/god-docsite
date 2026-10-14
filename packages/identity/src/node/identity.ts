import { identityOf, type SiteIdentity } from '../core/identity.js'
import { sitePeople } from './people-file.js'

/** 启动方（gwb-docsite）把本机的身份码放在这个环境变量里 */
export const identityCodeEnvName = 'DOCSITE_IDENTITY_CODE'

/**
 * 这个站的本机身份：按环境变量 DOCSITE_IDENTITY_CODE 的身份码在站点的人员列表里找人。
 * 只看环境变量里有没有码；发布出去的站由宿主保证不设这个环境变量，包里不看 DEV 编译标记
 */
export function siteIdentity(siteDir: string): SiteIdentity {
  return identityOf(sitePeople(siteDir), process.env[identityCodeEnvName])
}
