import type { CommentsAccess, PageThreadSummary } from '@godcreator/comments/site'
import type { AssemblyResult } from '../core/types.ts'

/** 报告列表里的一行：报告读不对时 problem 是原话，标题退回报告 id */
export type ReportSummary = {
  id: string
  title: string
  revision: string | null
  date: string | null
  authors: string[]
  /** 入口里 include 的章数；不分章的报告是 0 */
  chapterCount: number
  /** 组装时的提示条数（如单章里指向别章的引用） */
  warningCount: number
  problem: string | null
}

export type ReportListData = { siteName: string; hrefBase: string; reports: ReportSummary[] }

/** 报告页右侧目录的一项：url 是 #<节的 id> */
export type ReportTocItem = { title: string; url: string; depth: number }

/** 报告页上的评论：归属这一页的评论串，以及本机身份能不能写 */
export type ReportPageComments = { threads: PageThreadSummary[]; access: CommentsAccess }

export type ReportPageData = { siteName: string; hrefBase: string; reportId: string; report: AssemblyResult; toc: ReportTocItem[]; comments: ReportPageComments }

/** 报告页地址 */
export const reportHrefOf = (hrefBase: string, reportId: string) => `${hrefBase}/${reportId}`

/** 报告里一张图的地址：组装后图的路径是 assets/<文档 id>/<文件名>，挂在报告页地址下面 */
export const reportAssetHrefOf = (hrefBase: string, reportId: string, compiledPath: string) => `${reportHrefOf(hrefBase, reportId)}/${compiledPath}`
