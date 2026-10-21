// 原型：平台在布局 loader 里做的事：一次引用扫描，交给各功能的 sections，并进页面树
import { featureServers } from '@/features/server.generated'
import { site } from '@/lib/site.server'
import { siteReferences, type SiteReferences } from './references.server'
import type { SiteSection } from './sections'

export function scanSite(): SiteReferences {
  const resolvers = Object.values(featureServers).flatMap((server) => (server.references === undefined ? [] : [server.references]))
  return siteReferences(site.contentDir, resolvers)
}

export function siteSections(references: SiteReferences): SiteSection[] {
  return Object.values(featureServers)
    .flatMap((server) => server.sections?.(references) ?? [])
    .sort((a, b) => a.order - b.order)
}
