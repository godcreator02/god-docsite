import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { isSiteAudience, siteAudiences, type SiteAudience } from '../core/site-audience.js'

export { siteAudiences, type SiteAudience } from '../core/site-audience.js'

/** 站点根下的身份文件：写明这个站拿来干什么、给谁看、按哪一代布局建的 */
export const siteIdentityFileName = 'docsite.json'

/** 现在的布局是第 2 代；布局再变时加一，旧号的站要照说明手动升级，不自动搬 */
export const currentSiteFormat = 2

/** base 基础站、docs 文档站（docfirst）、collab 协作站 */
export const siteKinds = ['base', 'docs', 'collab'] as const
export type SiteKind = (typeof siteKinds)[number]

export type SiteIdentity = { kind: SiteKind; audience: SiteAudience; format: number }

const isSiteKind = (value: unknown): value is SiteKind => typeof value === 'string' && (siteKinds as readonly string[]).includes(value)

export function siteIdentityFileOf(siteDir: string): string {
  return path.join(siteDir, siteIdentityFileName)
}

/** 协作站一定有别人看：写成 personal 就报错 */
function checkAudienceOfKind(kind: SiteKind, audience: SiteAudience, where: string): void {
  if (kind === 'collab' && audience !== 'shared') throw new Error(`${where}：协作站（kind 为 collab）的 audience 只能是 shared`)
}

/** 解析身份文件的内容；写错了直接报错，写明哪一项不对 */
export function parseSiteIdentity(text: string, file: string): SiteIdentity {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${file} 不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  const shape = `{ "kind": ..., "audience": ..., "format": ${currentSiteFormat} }`
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${file} 要是一个对象：${shape}`)
  const { kind, audience, format, ...rest } = parsed as Record<string, unknown>
  const unknownKeys = Object.keys(rest)
  if (unknownKeys.length > 0) throw new Error(`${file} 里有认不出的键 ${unknownKeys.join('、')}：只写 kind、audience 与 format`)
  if (!isSiteKind(kind)) throw new Error(`${file} 的 kind 要是 ${siteKinds.join(' / ')} 之一，收到 ${JSON.stringify(kind)}`)
  if (format !== currentSiteFormat) {
    throw new Error(
      `${file} 的 format 是 ${JSON.stringify(format)}，这一版平台只认第 ${currentSiteFormat} 代布局：用 gwb-docsite 的 docsite.site.upgrade 列出要照平台包 template/ 改的文件，改完再把 format 改成 ${currentSiteFormat}`,
    )
  }
  if (!isSiteAudience(audience)) {
    throw new Error(`${file} 的 audience 要是 ${siteAudiences.join(' / ')} 之一，收到 ${JSON.stringify(audience)}：只有自己在本机看的站写 personal，别人也会 clone 下来看的写 shared`)
  }
  checkAudienceOfKind(kind, audience, file)
  return { kind, audience, format }
}

/** 站点的身份；没有身份文件为 null（不是平台建的站，或是有身份文件之前建的站），写错了报错 */
export function siteIdentityOf(siteDir: string): SiteIdentity | null {
  const file = siteIdentityFileOf(siteDir)
  if (!existsSync(file)) return null
  return parseSiteIdentity(readFileSync(file, 'utf8'), file)
}

/** 站点的 audience：站点模板的 site.server.ts 在站点加载时调它；没有身份文件、写错了、布局代号不对都直接报错，站点起不来 */
export function siteAudienceOf(siteDir: string): SiteAudience {
  const identity = siteIdentityOf(siteDir)
  if (identity === null) throw new Error(`${siteDir} 下没有身份文件 ${siteIdentityFileName}：平台建的站都有它，写明 kind、audience 与 format`)
  return identity.audience
}

/** 写站点的身份文件：建站时由建站的一方写一次，之后归站点 */
export function writeSiteIdentity(siteDir: string, kind: SiteKind, audience: SiteAudience): SiteIdentity {
  if (!isSiteKind(kind)) throw new Error(`kind 要是 ${siteKinds.join(' / ')} 之一，收到 ${JSON.stringify(kind)}`)
  if (!isSiteAudience(audience)) throw new Error(`audience 要是 ${siteAudiences.join(' / ')} 之一，收到 ${JSON.stringify(audience)}`)
  checkAudienceOfKind(kind, audience, `${siteDir} 的身份`)
  const identity: SiteIdentity = { kind, audience, format: currentSiteFormat }
  writeFileSync(siteIdentityFileOf(siteDir), `${JSON.stringify(identity, null, 2)}\n`)
  return identity
}
