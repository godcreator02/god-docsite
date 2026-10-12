import { searchPath } from 'fumadocs-core/breadcrumb'
import type * as PageTree from 'fumadocs-core/page-tree'

/** 侧栏切换按钮里的一组：meta.json 写了 "root": true 的文件夹 */
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

function withPageInGroup(nodes: PageTree.Node[], groupId: string, page: PageTree.Item): PageTree.Node[] {
  return nodes.map((node) => {
    if (node.type !== 'folder') return node
    if (node.$id === groupId) return { ...node, children: [...node.children, page] }
    return { ...node, children: withPageInGroup(node.children, groupId, page) }
  })
}

export type SidebarTree = {
  /** 侧栏用的页面树 */
  tree: PageTree.Root
  /** 侧栏现在停在哪一组（文件夹的 $id）；页面树里没有分组时是 undefined */
  groupId: string | undefined
}

/**
 * 侧栏停在哪一组：当前地址在页面树里，就是它所在的那一组；不在（任务、全部评论这类站点自己的页面），停在最近看过的那一组，
 * 还没看过就停在第一组。fumadocs 按当前地址在页面树里找当前组，所以地址不在树里时把 hiddenPage（地址就是当前地址）
 * 塞进那一组，侧栏的切换按钮与页面列表才认得出它；hiddenPage 在侧栏里不显示（styles.css）
 */
export function sidebarTreeOf(full: PageTree.Root, pathname: string, lastGroupId: string | undefined, hiddenPage: Omit<PageTree.Item, 'url'>): SidebarTree {
  const path = searchPath(full.children, pathname)
  if (path) return { tree: full, groupId: path.findLast(isSidebarGroup)?.$id ?? lastGroupId }
  const groupId = lastGroupId ?? firstSidebarGroupOf(full.children)?.$id
  if (groupId === undefined) return { tree: full, groupId }
  const page: PageTree.Item = { ...hiddenPage, url: pathname }
  return { tree: { ...full, $id: `${full.$id}#${pathname}`, children: withPageInGroup(full.children, groupId, page) }, groupId }
}
