import type { BaseSiteContext, SiteSection, SiteSectionEntry } from '@godcreator/god-docsite/server'
import { itemOf, itemsDirOf, type LibraryItem } from 'fixture-papers'

const component = 'FixturePaper'
const urlBase = '/fixture-papers'

/** 一页的条目是一项；几页的是一组，首页作为第一个子项 */
function entryOf(item: LibraryItem): SiteSectionEntry {
  const itemUrl = `${urlBase}/${item.id}`
  if (item.pages.length === 1) return { name: item.title, url: itemUrl }
  return { name: item.title, children: item.pages.map((page, index) => ({ name: page.title, url: index === 0 ? itemUrl : `${itemUrl}/${page.name}` })) }
}

/** 侧栏的分区：只列从内容页走得到的引用里出现的条目（平台的引用扫描，含别的功能包的外部页里写的引用） */
export async function sections(site: BaseSiteContext): Promise<SiteSection[]> {
  const itemsDir = itemsDirOf({ siteDir: site.dir, audience: site.audience, providedDirs: site.providedDirs() })
  const { references } = await site.references()
  const ids = [...new Set(references.filter((reference) => reference.component === component).map((reference) => reference.id))].sort()
  const items = itemsDir === undefined ? [] : ids.flatMap((id) => itemOf(itemsDir, id) ?? [])
  return [{ name: '试验论文', order: 10, searchUrl: urlBase, entries: items.map(entryOf) }]
}
