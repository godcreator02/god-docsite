import type { ReactNode } from 'react'
import type { LoaderPlugin } from 'fumadocs-core/source'

export interface PageTreeLink {
  name: string
  /** 站内地址，要和 routes.ts 里声明的一致 */
  url: string
  icon?: ReactNode
}

/** 页面树插件：在侧栏根部末尾加几个站内入口（全站评论、功能包的页面），接在站点 source.ts 的 loader({ plugins }) 里 */
export function pageTreeLinksPlugin(links: readonly PageTreeLink[]): LoaderPlugin {
  return {
    name: 'god-docsite:page-tree-links',
    transformPageTree: {
      root(root) {
        root.children.push(...links.map((link) => ({ type: 'page' as const, name: link.name, url: link.url, icon: link.icon, $id: `god-docsite-link:${link.url}` })))
        return root
      },
    },
  }
}
