import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** 站点目录下放日志页的文件夹 */
export const journalDirName = 'journal'

/** 日志页的文件：journal/<日期>.mdx。功能包 @godcreator/collab-site 的 site-data.ts（浏览器侧）有同一份，改时两处一起 */
export const journalFilePattern = /^(\d{4}-\d{2}-\d{2})\.mdx$/

/** YYYY-MM-DD 是不是真实存在的日期 */
export function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const day = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date
}

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
