import path from 'node:path'
import { siteFeedValue, sitePageRefs } from '@godcreator/god-docsite/server'
import { pushedSiteFeedOf, siteFeedChannel } from '@godcreator/collab'
import type { CollabSite } from '@godcreator/collab/site/server'
import { site } from '@/lib/site.server'

/** 协作仓的布局：站点在仓根的 site/，任务与模块在仓根的 collab/records/ */
const repoDir = path.dirname(site.dir)

function siteName(): string {
  const { name } = site.source.getPageTree()
  return typeof name === 'string' ? name : ''
}

/**
 * 协作功能的站点信息，每次请求现组装：站名、页面、可信 origin 都取站点上下文此刻的值。
 * 不在模块顶层算：可信 origin 在构建与预渲染时算不出来（没有端口），顶层算会让整个服务端包加载失败
 */
export function collabSite(): CollabSite {
  return {
    siteName: siteName(),
    siteDir: site.dir,
    repoDir,
    commentsDir: site.commentsDir,
    trustedOrigin: site.trustedOrigin(),
    people: site.people,
    identity: site.identity,
    pages: () => sitePageRefs(site).map(({ url, title }) => ({ url, title })),
    feed: () => pushedSiteFeedOf(siteFeedValue(siteFeedChannel)),
  }
}
