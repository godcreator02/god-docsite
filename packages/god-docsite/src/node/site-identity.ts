import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** 站点根下的身份文件：写明这个站拿来干什么、按哪一代布局建的 */
export const siteIdentityFileName = 'docsite.json'

/** 现在的布局是第 1 代；布局再变时加一，旧号的站要照说明手动升级，不自动搬 */
export const currentSiteFormat = 1

/** base 基础站、docs 文档站（docfirst）、collab 协作站 */
export const siteKinds = ['base', 'docs', 'collab'] as const
export type SiteKind = (typeof siteKinds)[number]

export type SiteIdentity = { kind: SiteKind; format: number }

const isSiteKind = (value: unknown): value is SiteKind => typeof value === 'string' && (siteKinds as readonly string[]).includes(value)

export function siteIdentityFileOf(siteDir: string): string {
  return path.join(siteDir, siteIdentityFileName)
}

/** 解析身份文件的内容；写错了直接报错，写明哪一项不对 */
export function parseSiteIdentity(text: string, file: string): SiteIdentity {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${file} 不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${file} 要是一个对象：{ "kind": ..., "format": ${currentSiteFormat} }`)
  const { kind, format, ...rest } = parsed as Record<string, unknown>
  const unknownKeys = Object.keys(rest)
  if (unknownKeys.length > 0) throw new Error(`${file} 里有认不出的键 ${unknownKeys.join('、')}：只写 kind 与 format`)
  if (!isSiteKind(kind)) throw new Error(`${file} 的 kind 要是 ${siteKinds.join(' / ')} 之一，收到 ${JSON.stringify(kind)}`)
  if (format !== currentSiteFormat) {
    throw new Error(`${file} 的 format 是 ${JSON.stringify(format)}，这一版平台只认第 ${currentSiteFormat} 代布局：照平台包的 template/ 把站点升级到第 ${currentSiteFormat} 代，再改 format`)
  }
  return { kind, format }
}

/** 站点的身份；没有身份文件为 null（不是平台建的站，或是有身份文件之前建的站），写错了报错 */
export function siteIdentityOf(siteDir: string): SiteIdentity | null {
  const file = siteIdentityFileOf(siteDir)
  if (!existsSync(file)) return null
  return parseSiteIdentity(readFileSync(file, 'utf8'), file)
}

/** 写站点的身份文件：建站时由建站的一方写一次，之后归站点 */
export function writeSiteIdentity(siteDir: string, kind: SiteKind): SiteIdentity {
  if (!isSiteKind(kind)) throw new Error(`kind 要是 ${siteKinds.join(' / ')} 之一，收到 ${JSON.stringify(kind)}`)
  const identity: SiteIdentity = { kind, format: currentSiteFormat }
  writeFileSync(siteIdentityFileOf(siteDir), `${JSON.stringify(identity, null, 2)}\n`)
  return identity
}
