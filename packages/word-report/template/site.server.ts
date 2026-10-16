import { commentsAccessOf } from '@godcreator/comments/site'
import { pageThreadsOf } from '@godcreator/comments/site/server'
import type { WordReportSite } from '@godcreator/word-report/site/server'
import { site } from '@/lib/site.server'
import { reportHrefBase } from './href'

/** 报告功能的站点信息，每次请求现组装：报告在站点根下的 reports/，站名取页面树根（content/meta.json 的 title），评论取站点的评论集合 */
export function wordReportSite(): WordReportSite {
  const name = site.source.getPageTree().name
  return {
    siteDir: site.dir,
    siteName: typeof name === 'string' ? name : '',
    hrefBase: reportHrefBase,
    pageComments: (page) => ({
      threads: pageThreadsOf({ entries: site.commentEntries, people: site.people(), page }),
      access: commentsAccessOf(site.identity()),
    }),
  }
}
