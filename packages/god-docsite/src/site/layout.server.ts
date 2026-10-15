import { createHash } from 'node:crypto'
import type * as PageTree from 'fumadocs-core/page-tree'
import type { SerializedPageTree } from 'fumadocs-core/source/client'
import type { SidebarLink } from './sidebar-links.js'
import type { DocsiteContext, SiteLayoutData } from './site-context.js'

/**
 * 序列化后的页面树，根的 $id 换成内容摘要。
 * 不变式：@fumadocs/base-ui 的 TreeContextProvider 按根 $id 缓存整棵树，根 $id 不变时新增页面、改标题后侧栏不更新
 */
export function withContentDigestId(serialized: SerializedPageTree): SerializedPageTree {
  const digest = createHash('sha256').update(JSON.stringify(serialized.data)).digest('hex').slice(0, 16)
  return { ...serialized, data: { ...serialized.data, $id: `site-tree-${digest}` } }
}

/** 页面树里名字是纯文字的链接项：meta.json 里写的站内链接也算站内地址 */
function treeLinkTitlesOf(nodes: readonly PageTree.Node[]): Array<[string, string]> {
  return nodes.flatMap((node): Array<[string, string]> => {
    if (node.type === 'page') return typeof node.name === 'string' && !node.external ? [[node.url, node.name]] : []
    if (node.type === 'folder') return [...(node.index ? treeLinkTitlesOf([node.index]) : []), ...treeLinkTitlesOf(node.children)]
    return []
  })
}

/**
 * 站内地址到标题：页面树里的链接项、功能的侧栏入口（featureRuntime.sidebarLinks）与全部页面；
 * 正文链接按它显示成带标题的卡片（交给 SiteLinksProvider）
 */
export function sitePageTitles({ source }: Pick<DocsiteContext, 'source'>, sidebarLinks: readonly SidebarLink[]): Record<string, string> {
  return Object.fromEntries([
    ...treeLinkTitlesOf(source.getPageTree().children),
    ...sidebarLinks.map((link): [string, string] => [link.url, link.name]),
    ...source.getPages().map((page): [string, string] => [page.url, page.data.title ?? page.url]),
  ])
}

/** 布局路由 loader 的平台部分：页面树（根 $id 是内容摘要）、站名（内容目录 meta.json 的 title）、站内地址到标题（含功能的侧栏入口） */
export async function siteLayoutData({ source }: Pick<DocsiteContext, 'source'>, sidebarLinks: readonly SidebarLink[]): Promise<SiteLayoutData> {
  const tree = source.getPageTree()
  return {
    pageTree: withContentDigestId(await source.serializePageTree(tree)),
    siteName: typeof tree.name === 'string' ? tree.name : '',
    pageTitles: sitePageTitles({ source }, sidebarLinks),
  }
}
