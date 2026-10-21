import type * as PageTree from 'fumadocs-core/page-tree'
import type { BaseSiteContext } from './site-context.js'

/** 分区里的一项：一页、一组（文件夹，不带 index，首页由功能包作为第一个子项给出）、或一条带字的分隔线 */
export type SiteSectionEntry = { name: string; url: string } | { name: string; children: readonly SiteSectionEntry[] } | { separator: string }

/** 功能 site.server.ts 的 sections 回的一个侧栏分区：并进页面树成一个 root 文件夹，最上面一项由平台加成「检索」 */
export interface SiteSection {
  name: string
  /** 各功能的分区放在内容目录的顶层文件夹之后，按它从小到大排；相同时按功能名、再按分区名 */
  order: number
  /** 「检索」指向的页 */
  searchUrl: string
  entries: readonly SiteSectionEntry[]
}

/** server.generated.ts 里的一项：功能名与它 site.server.ts 导出的 sections（写成方法，功能可以只收更宽的站点上下文） */
export interface FeatureSections<Site = BaseSiteContext> {
  feature: string
  sections(site: Site): readonly SiteSection[] | Promise<readonly SiteSection[]>
}

export interface LoadedSiteSection extends SiteSection {
  feature: string
}

export const sectionSearchName = '检索'

/** 每次请求都调各功能的 sections：条目变了刷新页面就跟上，算得慢的由功能自己缓存 */
export async function loadSiteSections<Site>(site: Site, featureSections: readonly FeatureSections<Site>[]): Promise<LoadedSiteSection[]> {
  const loaded = await Promise.all(featureSections.map(async ({ feature, sections }) => (await sections(site)).map((section) => ({ ...section, feature }))))
  return loaded.flat().sort((a, b) => a.order - b.order || a.feature.localeCompare(b.feature) || a.name.localeCompare(b.name))
}

function sectionNodeOf(entry: SiteSectionEntry): PageTree.Node {
  if ('separator' in entry) return { type: 'separator', name: entry.separator }
  if ('url' in entry) return { type: 'page', name: entry.name, url: entry.url }
  return { type: 'folder', name: entry.name, children: entry.children.map(sectionNodeOf) }
}

/** 一个分区换成页面树的 root 文件夹：目录切换按钮里多一项，当前页在分区里时侧栏停在这一组 */
export function sectionFolderOf(section: LoadedSiteSection): PageTree.Folder {
  return {
    type: 'folder',
    name: section.name,
    root: true,
    $id: `section:${section.feature}:${section.name}`,
    children: [{ type: 'page', name: sectionSearchName, url: section.searchUrl }, ...section.entries.map(sectionNodeOf)],
  }
}

function entryTitlesOf(entries: readonly SiteSectionEntry[]): Array<[string, string]> {
  return entries.flatMap((entry): Array<[string, string]> => {
    if ('separator' in entry) return []
    if ('url' in entry) return [[entry.url, entry.name]]
    return entryTitlesOf(entry.children)
  })
}

/** 分区里的页并进站内地址到标题：正文里指向这些页的链接显示成带标题的卡片 */
export function sectionPageTitlesOf(sections: readonly LoadedSiteSection[]): Array<[string, string]> {
  return sections.flatMap((section) => entryTitlesOf(section.entries))
}
