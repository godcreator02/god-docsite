// 原型：模拟一个库的功能包服务端部分（正式做法里各库功能包各写各的，这里两个试验功能共用同一份以省篇幅）
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ReferenceResolver, SiteReferences } from './references.server'
import type { SectionEntry, SiteSection } from './sections'

type ItemMeta = { title: string; pages: Array<{ name: string; title: string }> }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export interface FakeLibraryOptions {
  /** 正式做法里个人站从 providedDirs() 取、shared 站是站点目录下的发布目录 */
  dir: string
  component: string
  urlBase: string
  sectionName: string
  order: number
}

export function fakeLibrary({ dir, component, urlBase, sectionName, order }: FakeLibraryOptions) {
  function metaOf(id: string): ItemMeta | undefined {
    if (!uuidPattern.test(id)) return undefined
    const file = path.join(dir, id, 'meta.json')
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ItemMeta) : undefined
  }

  function entryOf(id: string, meta: ItemMeta): SectionEntry {
    const pages = meta.pages.map((page) => ({ name: page.title, url: `/${urlBase}/${id}/${page.name}` }))
    return pages.length === 1 ? { name: meta.title, url: pages[0]!.url } : { name: meta.title, url: pages[0]!.url, children: pages }
  }

  const references: ReferenceResolver = {
    components: [component],
    resolveReference(id) {
      const meta = metaOf(id)
      return meta?.pages.map((page) => path.join(dir, id, 'mdx', `${page.name}.mdx`))
    },
  }

  function sections(found: SiteReferences): SiteSection[] {
    const ids = [...new Set(found.references.filter((reference) => reference.component === component).map((reference) => reference.id))]
    const items = ids.flatMap((id) => {
      const meta = metaOf(id)
      return meta === undefined ? [] : [entryOf(id, meta)]
    })
    items.sort((a, b) => ('name' in a && 'name' in b ? a.name.localeCompare(b.name, 'zh') : 0))
    return [{ name: sectionName, order, entries: [{ name: '检索', url: `/${urlBase}` }, ...items] }]
  }

  function pageFile(id: string, page: string | undefined): string | undefined {
    const meta = metaOf(id)
    const name = page ?? meta?.pages[0]?.name
    if (meta === undefined || name === undefined || !meta.pages.some((known) => known.name === name)) return undefined
    return path.join(dir, id, 'mdx', `${name}.mdx`)
  }

  function all(): Array<{ id: string; title: string; url: string }> {
    return readdirSync(dir).flatMap((id) => {
      const meta = metaOf(id)
      return meta === undefined ? [] : [{ id, title: meta.title, url: `/${urlBase}/${id}/${meta.pages[0]!.name}` }]
    })
  }

  return { references, sections, pageFile, all }
}
