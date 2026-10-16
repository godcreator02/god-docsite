/**
 * `@godcreator/word-report/site/server`：报告列表、报告页与报告里图片的 loader，报告每次从站点 reports/ 现读、现组装。
 */
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { assembleDocument } from '../core/assemble.ts'
import type { AssemblyResult, ReportDocument } from '../core/types.ts'
import { readReportFiles, REPORT_ID_PATTERN, reportEntryOf, reportIdsOf } from '../node/report-files.ts'
import { reportHrefOf, type ReportListData, type ReportPageComments, type ReportPageData, type ReportSummary, type ReportTocItem } from './page-data.ts'

export type { ReportListData, ReportPageComments, ReportPageData, ReportSummary, ReportTocItem } from './page-data.ts'

/**
 * 报告功能的站点信息：站点目录（报告在它的 reports/ 下）、站名、报告页的地址前缀，
 * 以及按评论归属键取一页评论的函数（报告页的归属键是它的地址，如 /reports/sample）
 */
export type WordReportSite = { siteDir: string; siteName: string; hrefBase: string; pageComments: (page: string) => ReportPageComments }

/** loader 用到的路由参数：报告页是 :report，图片再加 * */
export type ReportRouteArgs = { params: Partial<Record<string, string>> }

/** 组装结果里有 Object.create(null) 的对象：换成普通对象再交给 React Router 序列化 */
const plainOf = (result: AssemblyResult): AssemblyResult => JSON.parse(JSON.stringify(result)) as AssemblyResult

async function assembledReport(siteDir: string, reportId: string): Promise<AssemblyResult> {
  const entry = reportEntryOf(reportId)
  return assembleDocument(entry, await readReportFiles(siteDir, entry), { mode: 'complete' })
}

/** 地址里的报告 id：形状不对或站点里没有这份报告都是 404 */
async function reportIdOf(params: ReportRouteArgs['params'], siteDir: string): Promise<string> {
  const reportId = params['report'] ?? ''
  if (!REPORT_ID_PATTERN.test(reportId) || !(await reportIdsOf(siteDir)).includes(reportId)) throw new Response(`站点里没有报告 ${reportId}`, { status: 404 })
  return reportId
}

function summaryOf(reportId: string, files: Record<string, string> | null, result: AssemblyResult | null, problem: string | null): ReportSummary {
  const metadata: Partial<ReportDocument['metadata']> = result?.document.metadata ?? {}
  const entryDocument = files === null ? null : (JSON.parse(files[reportEntryOf(reportId)]!) as ReportDocument)
  return {
    id: reportId,
    title: metadata.title ?? reportId,
    revision: metadata.revision ?? null,
    date: metadata.date ?? null,
    authors: metadata.authors ?? [],
    chapterCount: entryDocument?.blocks.filter((block) => block.type === 'include').length ?? 0,
    warningCount: result?.warnings.length ?? 0,
    problem,
  }
}

/** 报告列表：站点 reports/ 下的每份报告各一行；读不对的报告也列出来，带上原话 */
export async function reportListLoader(_args: ReportRouteArgs, site: WordReportSite): Promise<ReportListData> {
  const reports: ReportSummary[] = []
  for (const reportId of await reportIdsOf(site.siteDir)) {
    let files: Record<string, string> | null = null
    try {
      files = await readReportFiles(site.siteDir, reportEntryOf(reportId))
      reports.push(summaryOf(reportId, files, assembleDocument(reportEntryOf(reportId), files, { mode: 'complete' }), null))
    } catch (error) {
      reports.push(summaryOf(reportId, null, null, error instanceof Error ? error.message : String(error)))
    }
  }
  return { siteName: site.siteName, hrefBase: site.hrefBase, reports }
}

/** 报告页右侧目录：前两层的节，标题带编号 */
function tocOf(result: AssemblyResult): ReportTocItem[] {
  const items: ReportTocItem[] = []
  const visit = (blocks: ReportDocument['blocks'], depth: number) => {
    for (const block of blocks) {
      if (block.type !== 'section') continue
      const number = result.index[block.id]?.number
      items.push({ title: number ? `${number} ${block.title}` : block.title, url: `#${block.id}`, depth })
      if (depth < 3) visit(block.children as ReportDocument['blocks'], depth + 1)
    }
  }
  visit(result.document.blocks, 2)
  return items
}

/** 报告页：整份报告组装成一页（各章按 include 的顺序接在一起）；报告读不对直接报错，原话在错误页上 */
export async function reportPageLoader({ params }: ReportRouteArgs, site: WordReportSite): Promise<ReportPageData> {
  const reportId = await reportIdOf(params, site.siteDir)
  const result = plainOf(await assembledReport(site.siteDir, reportId))
  return { siteName: site.siteName, hrefBase: site.hrefBase, reportId, report: result, toc: tocOf(result), comments: site.pageComments(reportHrefOf(site.hrefBase, reportId)) }
}

const imageContentTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

/** 报告里的一张图：地址是组装后的路径 assets/<文档 id>/<文件名>，只给这份报告用到的图 */
export async function reportAssetLoader({ params }: ReportRouteArgs, site: WordReportSite): Promise<Response> {
  const reportId = await reportIdOf(params, site.siteDir)
  const compiledPath = `assets/${params['*'] ?? ''}`
  const source = (await assembledReport(site.siteDir, reportId)).assets[compiledPath]
  if (source === undefined) return new Response(`报告 ${reportId} 里没有图 ${compiledPath}`, { status: 404 })
  const contentType = imageContentTypes[path.extname(source).toLowerCase()]
  if (contentType === undefined) throw new Error(`报告 ${reportId} 的图 ${source} 不是 png 或 jpg`)
  return new Response(Readable.toWeb(createReadStream(path.join(site.siteDir, source))) as ReadableStream, { headers: { 'content-type': contentType } })
}
