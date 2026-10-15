import type { WordReportSite } from '@godcreator/word-report/site/server'
import { site } from '@/lib/site.server'
import { reportHrefBase } from './href'

/** 报告功能的站点信息，每次请求现组装：报告在站点根下的 reports/，站名取页面树根（content/meta.json 的 title） */
export function wordReportSite(): WordReportSite {
  const name = site.source.getPageTree().name
  return { siteDir: site.dir, siteName: typeof name === 'string' ? name : '', hrefBase: reportHrefBase }
}
