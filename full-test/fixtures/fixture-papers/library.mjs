import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** 条目目录的名字：shared 站在站点目录下，个人站是托管方提供的同名目录 */
export const libraryName = 'fixture-papers'

/** 条目放在哪：shared 站只读发布进站点目录的，个人站读托管方提供的目录，没提供是 undefined（这台电脑上没有） */
export function itemsDirOf({ siteDir, audience, providedDirs }) {
  return audience === 'shared' ? path.join(siteDir, libraryName) : providedDirs[libraryName]
}

/** 一个条目：meta.json 写 title 与 pages（页名到标题，按写的先后），mdx/<页名>.mdx 是各页；没有这一条回 undefined */
export function itemOf(itemsDir, id) {
  if (!/^[a-z0-9-]+$/.test(id)) return undefined
  const dir = path.join(itemsDir, id)
  const metaFile = path.join(dir, 'meta.json')
  if (!existsSync(metaFile)) return undefined
  const meta = JSON.parse(readFileSync(metaFile, 'utf8'))
  return { id, dir, title: meta.title, pages: Object.entries(meta.pages).map(([name, title]) => ({ name, title })) }
}

export function allItems(itemsDir) {
  if (itemsDir === undefined || !existsSync(itemsDir)) return []
  return readdirSync(itemsDir)
    .sort()
    .flatMap((id) => itemOf(itemsDir, id) ?? [])
}

export function pageFileOf(item, pageName) {
  return path.join(item.dir, 'mdx', `${pageName}.mdx`)
}