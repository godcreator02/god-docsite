import path from 'node:path'
import { itemOf, itemsDirOf, libraryName, pageFileOf } from './library.mjs'

/** 平台引用扫描调它：这一条在本站的各页文件，本站没有回 undefined */
export function resolveReference(id, place) {
  const itemsDir = itemsDirOf(place)
  const item = itemsDir === undefined ? undefined : itemOf(itemsDir, id)
  return item?.pages.map((page) => pageFileOf(item, page.name))
}

/** 自包含检查报缺项时附上的补法 */
export function publishHint(id, siteDir) {
  return `把 ${libraryName} 的条目 ${id} 复制进 ${path.join(siteDir, libraryName)}`
}