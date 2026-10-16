import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseReportJson } from '../core/json.ts'
import { MDX_ENTRY_NAME, mdxReportInputsOf } from '../core/mdx/index.ts'
import { safeRelativePath, validateDocument } from '../core/validate.ts'
import { ReportContentError } from '../core/types.ts'

/** 站点里的报告：站点根下 reports/<报告 id>/，入口是 content.json（JSON 报告）或 index.mdx（MDX 报告），两种只能有一种 */
export const reportsDirName = 'reports'
export const JSON_ENTRY_NAME = 'content.json'

/** 报告 id 就是报告目录名，出现在网址里：小写字母、数字与 -，以字母或数字开头 */
export const REPORT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

/** JSON 报告的入口，相对站点目录；报告是哪种格式要看磁盘，用 reportEntryIn */
export function reportEntryOf(reportId: string): string {
  if (!REPORT_ID_PATTERN.test(reportId)) throw new ReportContentError(`报告 id 只能是小写字母、数字与 -，以字母或数字开头：${JSON.stringify(reportId)}`)
  return `${reportsDirName}/${reportId}/${JSON_ENTRY_NAME}`
}

export const isMdxEntry = (entry: string): boolean => entry === MDX_ENTRY_NAME || entry.endsWith(`/${MDX_ENTRY_NAME}`)

async function isFile(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false
      throw error
    },
  )
}

/** 报告目录里有哪种入口：两种都有直接报错，都没有回 undefined */
async function entryNameIn(reportDir: string, reportId: string): Promise<string | undefined> {
  const [hasJson, hasMdx] = await Promise.all([isFile(path.join(reportDir, JSON_ENTRY_NAME)), isFile(path.join(reportDir, MDX_ENTRY_NAME))])
  if (hasJson && hasMdx) throw new ReportContentError(`报告目录里 ${JSON_ENTRY_NAME} 和 ${MDX_ENTRY_NAME} 只能留一个`, `${reportsDirName}/${reportId}`)
  return hasJson ? JSON_ENTRY_NAME : hasMdx ? MDX_ENTRY_NAME : undefined
}

/** 一份报告的入口，相对站点目录：reports/<id>/content.json 或 reports/<id>/index.mdx */
export async function reportEntryIn(siteDir: string, reportId: string): Promise<string> {
  const jsonEntry = reportEntryOf(reportId)
  const name = await entryNameIn(path.join(siteDir, path.dirname(jsonEntry)), reportId)
  if (name === undefined) throw new ReportContentError(`站点里没有报告 ${reportId}：reports/${reportId}/ 下既没有 ${JSON_ENTRY_NAME} 也没有 ${MDX_ENTRY_NAME}`, siteDir)
  return `${reportsDirName}/${reportId}/${name}`
}

/** 站点里的报告 id：reports/ 下有入口文件的目录，按名字排；目录名不合 REPORT_ID_PATTERN 的直接报错，不悄悄跳过 */
export async function reportIdsOf(siteDir: string): Promise<string[]> {
  const reportsDir = path.join(siteDir, reportsDirName)
  let entries
  try {
    entries = await readdir(reportsDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const ids: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if ((await entryNameIn(path.join(reportsDir, entry.name), entry.name)) === undefined) continue
    reportEntryOf(entry.name)
    ids.push(entry.name)
  }
  return ids.sort()
}

/** 读站点目录里的一个文件（相对路径），挡住经符号链接跑出站点目录的 */
async function readInsideSite(root: string, relative: string): Promise<string> {
  let real: string
  try {
    real = await realpath(path.join(root, relative))
  } catch {
    throw new ReportContentError('Missing or unreadable file', relative)
  }
  const inside = path.relative(root, real)
  if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) throw new ReportContentError('File escapes report root', relative)
  return readFile(real, 'utf8')
}

/**
 * 读一份报告组装要的全部 JSON 文件（入口与它 include 到的章节），键是相对站点目录的路径，交给 assembleDocument。
 * 不读图片、不解码：网页显示用；检查与导出用 readReport，它还核对图片与快照
 */
export async function readReportFiles(siteDir: string, entry: string): Promise<Record<string, string>> {
  const root = await realpath(siteDir)
  const files: Record<string, string> = {}
  const load = async (relative: string): Promise<void> => {
    if (Object.hasOwn(files, relative)) return
    const text = await readInsideSite(root, relative)
    files[relative] = text
    const document = parseReportJson(text, relative)
    validateDocument(document, relative)
    for (const [index, block] of document.blocks.entries()) {
      if (block.type !== 'include') continue
      try {
        safeRelativePath(block.src)
      } catch (error) {
        throw new ReportContentError((error as Error).message, relative, `/blocks/${index}/src`)
      }
      await load(path.posix.join(path.posix.dirname(relative), block.src))
    }
  }
  await load(entry)
  return files
}

/** 读一份 MDX 报告的全部原文：入口、chapters 列的各章、存在时的 references.mdx，键是相对站点目录的路径，交给 assembleMdxReport */
export async function readMdxReportFiles(siteDir: string, entry: string): Promise<Record<string, string>> {
  const root = await realpath(siteDir)
  const files: Record<string, string> = { [entry]: await readInsideSite(root, entry) }
  const { chapters, references } = mdxReportInputsOf(files[entry]!, entry)
  for (const chapter of chapters) files[chapter] = await readInsideSite(root, chapter)
  if (await isFile(path.join(root, references))) files[references] = await readInsideSite(root, references)
  return files
}
