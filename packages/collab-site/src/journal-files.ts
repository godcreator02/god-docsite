import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { isRealDate, journalFilePattern } from './site-data.js'

/** 站点目录下放日志页的文件夹 */
export const journalDirName = 'journal'

/** journal/ 里不合规矩的文件：只能是 <真实日期>.mdx，不放子文件夹与别的文件 */
export function journalProblemsOf(siteDir: string): string[] {
  const journalDir = path.join(siteDir, journalDirName)
  if (!existsSync(journalDir)) return []
  return readdirSync(journalDir, { withFileTypes: true }).flatMap((entry) => {
    const file = `${journalDirName}/${entry.name}`
    if (!entry.isFile()) return [`${file}：${journalDirName}/ 里只放 <日期>.mdx，不放文件夹`]
    const date = journalFilePattern.exec(entry.name)?.[1]
    if (date === undefined) return [`${file}：日志页的文件名要是 YYYY-MM-DD.mdx`]
    if (!isRealDate(date)) return [`${file}：${date} 不是真实存在的日期`]
    return []
  })
}

/** 有日志页的日子，按日期排；journal/ 不合规矩就报错，写明是哪几个文件 */
export function journalDatesOf(siteDir: string): string[] {
  const problems = journalProblemsOf(siteDir)
  if (problems.length > 0) throw new Error(problems.join('\n'))
  const journalDir = path.join(siteDir, journalDirName)
  if (!existsSync(journalDir)) return []
  return readdirSync(journalDir)
    .map((name) => journalFilePattern.exec(name)![1]!)
    .sort()
}

/** 日期 → 那一天日志页的 MDX 原文，按日期排 */
export function journalSourcesOf(siteDir: string): Map<string, string> {
  return new Map(journalDatesOf(siteDir).map((date) => [date, readFileSync(path.join(siteDir, journalDirName, `${date}.mdx`), 'utf8')]))
}
