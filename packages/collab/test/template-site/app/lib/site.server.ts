import type { SiteSource } from '@godcreator/god-docsite/react'
import type { SiteIdentity, StoredPerson } from '@godcreator/identity'

/** 模板类型检查用的站点上下文：协作功能要站点 app/lib/site.server.ts 的 site 提供的字段，照平台模板里的写法 */
export declare const site: {
  dir: string
  source: SiteSource
  commentsDir: string
  people: () => StoredPerson[]
  identity: () => SiteIdentity
  trustedOrigin: () => string
  feedValue: (channel: string) => unknown
}
