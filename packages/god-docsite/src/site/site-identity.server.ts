import type { SiteAudience } from '../core/site-audience.js'
import { siteIdentityFileName, siteIdentityOf } from '../node/site-identity.js'

/** 站点模板的 site.server.ts 在站点加载时调它：身份文件的 audience；没有身份文件、写错了、布局代号不对都直接报错，站点起不来 */
export function siteAudienceOf(siteDir: string): SiteAudience {
  const identity = siteIdentityOf(siteDir)
  if (identity === null) throw new Error(`${siteDir} 下没有身份文件 ${siteIdentityFileName}：平台建的站都有它，写明 kind、audience 与 format`)
  return identity.audience
}
