/**
 * `@godcreator/word-report/site/server`：报告列表、报告页与报告里图片的 loader，报告每次从站点 reports/ 现读、现组装。
 */
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { assembleDocument } from '../core/assemble.ts'
import { assembleMdxReport, mdxReportInputsOf } from '../core/mdx/index.ts'
import type { AssemblyResult, ReportDocument } from '../core/types.ts'
import { isMdxEntry, readMdxReportFiles, readReportFiles, REPORT_ID_PATTERN, reportEntryIn, reportIdsOf } from '../node/report-files.ts'
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

type ReadAndAssembled = { files: Record<string, string>; result: AssemblyResult; chapterCount: number }

/** MDX 报告编译一遍要几百毫秒，一页几十张图各请求一次：同一入口的每个原文都没变就用上次的结果 */
const lastMdxAssembly = new Map<string, { files: Record<string, string>; result: AssemblyResult }>()
const sameFiles = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([file, text]) => b[file] === text)

function assembledMdx(siteDir: string, entry: string, files: Record<string, string>): AssemblyResult {
  const key = `${siteDir}\0${entry}`
  const previous = lastMdxAssembly.get(key)
  if (previous && sameFiles(previous.files, files)) return previous.result
  const result = assembleMdxReport({ reportId: path.posix.basename(path.posix.dirname(entry)), entry, files }, { mode: 'complete' })
  lastMdxAssembly.set(key, { files, result })
  return result
}

/** 读一份报告并组装：JSON 报告的章数是入口里 include 的个数，MDX 报告是入口文件头 chapters 的个数 */
async function readAndAssemble(siteDir: string, reportId: string): Promise<ReadAndAssembled> {
  const entry = await reportEntryIn(siteDir, reportId)
  if (isMdxEntry(entry)) {
    const files = await readMdxReportFiles(siteDir, entry)
    return { files, result: assembledMdx(siteDir, entry, files), chapterCount: mdxReportInputsOf(files[entry]!, entry).chapters.length }
  }
  const files = await readReportFiles(siteDir, entry)
  const entryDocument = JSON.parse(files[entry]!) as ReportDocument
  return { files, result: assembleDocument(entry, files, { mode: 'complete' }), chapterCount: entryDocument.blocks.filter((block) => block.type === 'include').length }
}

async function assembledReport(siteDir: string, reportId: string): Promise<AssemblyResult> {
  return (await readAndAssemble(siteDir, reportId)).result
}

/** 地址里的报告 id：形状不对或站点里没有这份报告都是 404 */
async function reportIdOf(params: ReportRouteArgs['params'], siteDir: string): Promise<string> {
  const reportId = params['report'] ?? ''
  if (!REPORT_ID_PATTERN.test(reportId) || !(await reportIdsOf(siteDir)).includes(reportId)) throw new Response(`站点里没有报告 ${reportId}`, { status: 404 })
  return reportId
}

function summaryOf(reportId: string, read: ReadAndAssembled | null, problem: string | null): ReportSummary {
  const metadata: Partial<ReportDocument['metadata']> = read?.result.document.metadata ?? {}
  return {
    id: reportId,
    title: metadata.title ?? reportId,
    revision: metadata.revision ?? null,
    date: metadata.date ?? null,
    authors: metadata.authors ?? [],
    chapterCount: read?.chapterCount ?? 0,
    warningCount: read?.result.warnings.length ?? 0,
    problem,
  }
}

/** 报告列表：站点 reports/ 下的每份报告各一行；读不对的报告也列出来，带上原话 */
export async function reportListLoader(_args: ReportRouteArgs, site: WordReportSite): Promise<ReportListData> {
  const reports: ReportSummary[] = []
  for (const reportId of await reportIdsOf(site.siteDir)) {
    try {
      reports.push(summaryOf(reportId, await readAndAssemble(site.siteDir, reportId), null))
    } catch (error) {
      reports.push(summaryOf(reportId, null, error instanceof Error ? error.message : String(error)))
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
