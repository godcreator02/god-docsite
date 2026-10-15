import type * as PageTree from 'fumadocs-core/page-tree'
import type { DocsiteContext } from './site-context.js'
import { withLoosePagesGrouped } from './sidebar-tree.js'

/** 首页路由 loader 交给 SiteHomeLayout 的数据 */
export interface SiteHomeData {
  /** 站名：内容目录 meta.json 的 title */
  siteName: string
  /** 「文档」链接的地址：侧栏目录切换按钮第一组里的第一页 */
  docsUrl: string
}

function firstPageUrlOf(nodes: readonly PageTree.Node[]): string | undefined {
  for (const node of nodes) {
    if (node.type === 'page' && !node.external) return node.url
    if (node.type !== 'folder') continue
    if (node.index) return node.index.url
    const nested = firstPageUrlOf(node.children)
    if (nested !== undefined) return nested
  }
}

/**
 * 首页路由（app/routes/home.tsx，fumadocs 的 HomeLayout，不在整站布局里）loader 的平台部分。
 * 首页占着 /：内容目录根上写了 index 页（它的地址也是 /）就报错，不让两个页面抢同一个地址
 */
export function siteHomeData({ source }: Pick<DocsiteContext, 'source'>): SiteHomeData {
  const contentHome = source.getPage([])
  if (contentHome !== undefined) {
    throw new Error(`内容目录里的 ${contentHome.path} 的地址是 /，和首页 app/routes/home.tsx 抢同一个地址：首页的内容写在 home.tsx 里，把这一页改名或删掉`)
  }
  const tree = source.getPageTree()
  const docsUrl = firstPageUrlOf(withLoosePagesGrouped(tree).children)
  if (docsUrl === undefined) throw new Error('内容目录里一页都没有：首页的「文档」链接没处可去，在 content/ 里至少写一页')
  return { siteName: typeof tree.name === 'string' ? tree.name : '', docsUrl }
}
