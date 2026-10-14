import type { SiteIdentity } from '@godcreator/identity'
import type { Params } from 'react-router'
import type { SiteFeed } from '../core/notifications/site-feed.js'
import type { SitePageRef } from './page-data.js'

/**
 * 站点交给协作功能的站点信息：site/server 里每个 loader / action 的第二个参数，由站点的 site.server.ts 造一份。
 * 函数项每次请求调用一次：人员列表、页面、推送来的数据改了不用重启服务
 */
export type CollabSite = {
  /** 站名：页面标题写成「任务 · 站名」 */
  siteName: string
  /** 站点目录：人员列表 people.json、日志页 journal/ 在这里 */
  siteDir: string
  /** 协作仓的仓根：任务与模块在 <repoDir>/collab/records/ */
  repoDir: string
  /** 站点的评论目录：协作页上的评论读写这里 */
  commentsDir: string
  /** 写入请求的 Origin 头要和它完全一样 */
  trustedOrigin: string
  /** 本机身份：没有人时站点只读 */
  identity: () => SiteIdentity
  /** 站里的页面：任务链接页面时从这里选 */
  pages: () => readonly SitePageRef[]
  /** 推送通道交来的最新一份（通知、项目负责人）；还没交来为 null */
  feed: () => SiteFeed | null
}

/** loader / action 用到的 React Router 参数：站点转发文件把收到的 args 原样传进来 */
export type CollabRouteArgs = { request: Request; params: Params }
