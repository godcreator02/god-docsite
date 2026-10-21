import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { siteIdentityOf, type SiteAudience, type SiteKind } from '@godcreator/god-docsite/identity'
import type { HostedSite } from './hosted-sites.js'
import { siteKeyOf, type SiteStatus } from './site-host.js'

/**
 * docsite.site.list 与站点窗格的一行：进程状态之外，站名、类别、给谁看、是不是常驻、谁登记的。
 * kind、audience 是站点身份文件 docsite.json 写的类别与给谁看，没有这个文件都为 null（这样的站托管不了，error 里写着原因）。
 * hosted 为 false 的是没登记、只是这次被启动过的站（建站检查、自己验页面时），by 为 null
 */
export type SiteListing = SiteStatus & { title: string | null; kind: SiteKind | null; audience: SiteAudience | null; hosted: boolean; by: string | null }

/** 站点读出来的名字、类别与给谁看：站名与身份文件各自写坏了都报错 */
export type SiteDescription = { title: string | null; kind: SiteKind | null; audience: SiteAudience | null }

export function siteDescriptionOf(dir: string): SiteDescription {
  const identity = siteIdentityOf(dir)
  return { title: siteTitleOf(dir), kind: identity?.kind ?? null, audience: identity?.audience ?? null }
}

/** 站名：站点 content/meta.json 的 title；文件不在或没写 title 为 null，文件不是合法 JSON 就报错 */
export function siteTitleOf(dir: string): string | null {
  const file = path.join(dir, 'content', 'meta.json')
  if (!existsSync(file)) return null
  let meta: unknown
  try {
    meta = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  const title = typeof meta === 'object' && meta !== null ? (meta as { title?: unknown }).title : undefined
  return typeof title === 'string' ? title : null
}

/** 常驻的站按登记的先后排在前面，后面是只被启动过、没登记的站 */
export function siteListingsOf(hosted: HostedSite[], started: SiteStatus[], statusOf: (dir: string) => SiteStatus, describe: (dir: string) => SiteDescription): SiteListing[] {
  const hostedKeys = new Set(hosted.map((site) => siteKeyOf(site.dir)))
  const hostedRows = hosted.map((site) => ({ ...statusOf(site.dir), ...describe(site.dir), hosted: true, by: site.by }))
  const startedOnly = started.filter((status) => !hostedKeys.has(siteKeyOf(status.dir))).map((status) => ({ ...status, ...describe(status.dir), hosted: false, by: null }))
  return [...hostedRows, ...startedOnly]
}
