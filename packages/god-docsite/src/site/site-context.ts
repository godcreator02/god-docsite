import type * as PageTree from 'fumadocs-core/page-tree'
import type { SerializedPageTree } from 'fumadocs-core/source/client'
import type { HtmlHeadingAnchor } from '../core/html-text.js'
import type { FilePageData } from './page-sources.js'

/** MDX 页面在 page.data 里用到的部分：集合要开 postprocess.includeProcessedMarkdown，才有 getText('processed') */
export type MdxPageData = {
  title?: string | undefined
  description?: string | undefined
  getText(type: 'raw' | 'processed'): Promise<string>
}

/** 站点 loader 里的一页：type 是来源的名字，站点的 source.ts 按 { mdx, tsx, html } 三个来源建 loader */
export type SitePage =
  | { type: 'mdx'; path: string; url: string; slugs: string[]; data: MdxPageData }
  | { type: 'tsx' | 'html'; path: string; url: string; slugs: string[]; data: FilePageData }

/** 平台用到的 fumadocs loader 的那几样（站点 source.ts 里 loader() 的结果） */
export interface SiteSource {
  getPage(slugs: string[]): SitePage | undefined
  getPages(): SitePage[]
  getPageTree(): PageTree.Root
  serializePageTree(tree: PageTree.Root): Promise<SerializedPageTree>
}

/**
 * 站点上下文里平台用到的部分：站点的 app/lib/site.server.ts 造一个，经参数传给平台与功能包的 loader、action。
 * mode：react-router dev 下是 dev，react-router-serve 跑构建产物是 start
 */
export interface DocsiteContext {
  dir: string
  mode: 'dev' | 'start'
  source: SiteSource
  /** 内容目录的绝对路径：TSX、HTML 页面与它们引用的文件都在里面 */
  contentDir: string
}

type SitePageCommon = {
  /** 页面在内容目录里的路径（如 index.mdx）：评论等按它归属到页 */
  key: string
  url: string
  title: string
  description: string | undefined
  siteName: string
}

/** 页面路由的 loader 交给浏览器的一页 */
export type SitePageData = SitePageCommon &
  ({ type: 'mdx'; path: string } | { type: 'tsx'; file: string } | { type: 'html'; src: string; headings: HtmlHeadingAnchor[] })

/** 布局路由的 loader 交给浏览器的：页面树只在这里给，页面路由不再带 */
export interface SiteLayoutData {
  pageTree: SerializedPageTree
  siteName: string
  /** 站内地址到标题：正文链接显示成带标题的小卡片 */
  pageTitles: Record<string, string>
}
