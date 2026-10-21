import type * as PageTree from 'fumadocs-core/page-tree'
import type { SerializedPageTree } from 'fumadocs-core/source/client'
import type { HtmlHeadingAnchor } from '../core/html-text.js'
import type { SiteAudience } from '../core/site-audience.js'
import type { SiteReferences } from '../core/site-references.js'
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
  /** 身份文件 docsite.json 的 audience：功能包按它决定读本机提供的目录（personal）还是只读站点目录里的文件（shared） */
  audience: SiteAudience
  source: SiteSource
  /** 内容目录的绝对路径：TSX、HTML 页面与它们引用的文件都在里面 */
  contentDir: string
}

/** 人员列表里的一人：identity 包的 StoredPerson 满足它；带身份码，只在服务端用 */
export type SitePerson = { id: string; name: string }

/** 本机身份：identity 包的 SiteIdentity 满足它；person 为 null 时站点只读，reason 写明原因 */
export type SiteViewer = { person: SitePerson | null; reason?: string | undefined }

/** 评论集合（fumadocs-mdx 集合）里的一条：info.path 相对评论目录 */
export type SiteCommentEntry = { info: { path: string } }

/**
 * 基础站点上下文：模板 app/lib/site.server.ts 导出的 site 满足它；source 用来取站名与页面列表。
 * 功能包模板里的 site.server.ts 从它组装本功能要的上下文，布局 loader 把它作为第二个参数传给各功能的 layoutData。
 * 函数字段每次调用都现读：people.json、身份码、可信地址改了不用重启
 */
export interface BaseSiteContext<Person extends SitePerson = SitePerson, Viewer extends SiteViewer = SiteViewer, CommentEntry extends SiteCommentEntry = SiteCommentEntry>
  extends DocsiteContext {
  /** 评论目录的绝对路径：评论写入 action 往这里写 */
  commentsDir: string
  /** 评论集合的全部条目（构建期编译；dev 下随文件增删更新） */
  commentEntries: readonly CommentEntry[]
  /** people.json 的人员列表 */
  people(): readonly Person[]
  /** 本机身份：dev 下是启动方经环境变量 DOCSITE_IDENTITY_CODE 给的码在 people.json 里认出的人；start（发布版）一律只读 */
  identity(): Viewer
  /** 写入请求的 Origin 头要等于它：DOCSITE_ORIGIN，否则 dev 取平台 vite 插件写的 DOCSITE_DEV_ORIGIN、start 取 HOST/PORT */
  trustedOrigin(): string
  /** 推送通道这个频道现在的值，没推过是 undefined；功能的 layoutData 只能经它读（feature.tsx 进浏览器，不能 import 平台的 ./server） */
  feedValue(channel: string): unknown
  /** 平台的引用扫描：从内容页出发，各功能包登记的组件引用了哪些条目、本站缺哪些；同时来的调用共用一次扫描 */
  references(): Promise<SiteReferences>
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
