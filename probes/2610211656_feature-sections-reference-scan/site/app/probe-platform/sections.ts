// 原型：功能 site.server.ts 的 sections 回的分区，换成页面树里的 root 文件夹
import type * as PageTree from 'fumadocs-core/page-tree'

export type SectionEntry = { name: string; url: string; children?: SectionEntry[] } | { separator: string }

export interface SiteSection {
  name: string
  order: number
  entries: SectionEntry[]
}

function nodeOf(entry: SectionEntry): PageTree.Node {
  if ('separator' in entry) return { type: 'separator', name: entry.separator }
  const page: PageTree.Item = { type: 'page', name: entry.name, url: entry.url }
  if (entry.children === undefined) return page
  return { type: 'folder', name: entry.name, index: page, children: entry.children.map(nodeOf) }
}

export function sectionFolder(section: SiteSection): PageTree.Folder {
  return { type: 'folder', name: section.name, root: true, $id: `section:${section.name}`, children: section.entries.map(nodeOf) }
}

function entryTitles(entries: readonly SectionEntry[]): Array<[string, string]> {
  return entries.flatMap((entry): Array<[string, string]> => ('separator' in entry ? [] : [[entry.url, entry.name], ...entryTitles(entry.children ?? [])]))
}

/** 分区条目并进站内地址到标题：正文里指向条目页的链接显示成带标题的卡片 */
export function sectionPageTitles(sections: readonly SiteSection[]): Record<string, string> {
  return Object.fromEntries(sections.flatMap((section) => entryTitles(section.entries)))
}
