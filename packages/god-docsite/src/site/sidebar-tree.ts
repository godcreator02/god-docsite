import { searchPath } from 'fumadocs-core/breadcrumb'
import type * as PageTree from 'fumadocs-core/page-tree'

/** 侧栏目录切换按钮里的一组：meta.json 写了 "root": true 的文件夹 */
function isSidebarGroup(node: PageTree.Node): node is PageTree.Folder {
  return node.type === 'folder' && Boolean(node.root)
}

function firstSidebarGroupOf(nodes: PageTree.Node[]): PageTree.Folder | undefined {
  for (const node of nodes) {
    if (node.type !== 'folder') continue
    if (node.root) return node
    const nested = firstSidebarGroupOf(node.children)
    if (nested) return nested
  }
}

/** 页面树里有没有不在任何一组里的页面（包括不是分组的文件夹的首页） */
function hasPageOutsideGroups(nodes: PageTree.Node[]): boolean {
  return nodes.some((node) => {
    if (node.type === 'page') return true
    if (node.type !== 'folder' || node.root) return false
    return node.index !== undefined || hasPageOutsideGroups(node.children)
  })
}

function withPageInGroup(nodes: PageTree.Node[], groupId: string, page: PageTree.Item): PageTree.Node[] {
  return nodes.map((node) => {
    if (node.type !== 'folder') return node
    if (node.$id === groupId) return { ...node, children: [...node.children, page] }
    return { ...node, children: withPageInGroup(node.children, groupId, page) }
  })
}

/** 侧栏停在哪一组：分组文件夹的 $id；null 是不在任何一组里（侧栏显示整棵页面树） */
export type SidebarGroupId = string | null

export interface SidebarTree {
  /** 侧栏用的页面树 */
  tree: PageTree.Root
  groupId: SidebarGroupId
}

/**
 * 侧栏停在哪一组。当前地址在页面树里，就是它所在的那一组（不在组里就是 null）；不在页面树里（任务、全站评论这类功能页面），
 * 停在最近看过的那一组；还没看过页面树里的页面时，页面树里有组外的页面就显示整棵树，全部页面都在组里就停在第一组。
 * fumadocs 按当前地址在页面树里找当前组，所以要停在某一组时把 hiddenPage（地址就是当前地址）塞进那一组，
 * 目录切换按钮与页面列表才认得出它；hiddenPage 在侧栏里不显示（styles.css）
 */
export function sidebarTreeOf(full: PageTree.Root, pathname: string, lastGroupId: SidebarGroupId | undefined, hiddenPage: Omit<PageTree.Item, 'url'>): SidebarTree {
  const path = searchPath(full.children, pathname)
  if (path) return { tree: full, groupId: path.findLast(isSidebarGroup)?.$id ?? null }
  const groupId = lastGroupId !== undefined ? lastGroupId : hasPageOutsideGroups(full.children) ? null : (firstSidebarGroupOf(full.children)?.$id ?? null)
  if (groupId === null) return { tree: full, groupId }
  const page: PageTree.Item = { ...hiddenPage, url: pathname }
  return { tree: { ...full, $id: `${full.$id}#${pathname}`, children: withPageInGroup(full.children, groupId, page) }, groupId }
}
