import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseReportJson } from '../core/json.ts'
import { safeRelativePath, validateDocument } from '../core/validate.ts'
import { ReportContentError } from '../core/types.ts'

/** 站点里的报告：站点根下 reports/<报告 id>/content.json，章节与图片在同一个报告目录里 */
export const reportsDirName = 'reports'

/** 报告 id 就是报告目录名，出现在网址里：小写字母、数字与 -，以字母或数字开头 */
export const REPORT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

/** 报告的入口，相对站点目录 */
export function reportEntryOf(reportId: string): string {
  if (!REPORT_ID_PATTERN.test(reportId)) throw new ReportContentError(`报告 id 只能是小写字母、数字与 -，以字母或数字开头：${JSON.stringify(reportId)}`)
  return `${reportsDirName}/${reportId}/content.json`
}

/** 站点里的报告 id：reports/ 下有 content.json 的目录，按名字排；目录名不合 REPORT_ID_PATTERN 的直接报错，不悄悄跳过 */
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
    const hasEntry = await stat(path.join(reportsDir, entry.name, 'content.json')).then(
      (info) => info.isFile(),
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false
        throw error
      },
    )
    if (!hasEntry) continue
    reportEntryOf(entry.name)
    ids.push(entry.name)
  }
  return ids.sort()
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
    const absolute = path.join(root, relative)
    let real: string
    try {
      real = await realpath(absolute)
    } catch {
      throw new ReportContentError('Missing or unreadable file', relative)
    }
    const inside = path.relative(root, real)
    if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) throw new ReportContentError('File escapes report root', relative)
    const text = await readFile(real, 'utf8')
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
