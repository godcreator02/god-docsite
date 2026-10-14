import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { journalDirName, journalEntryProblemOf, journalFilePattern } from '../core/journal.js'

/** journal/ 里不合规矩的文件：只能是 <真实日期>.mdx，不放子文件夹与别的文件 */
export function journalProblemsOf(siteDir: string): string[] {
  const journalDir = path.join(siteDir, journalDirName)
  if (!existsSync(journalDir)) return []
  return readdirSync(journalDir, { withFileTypes: true }).flatMap((entry) => journalEntryProblemOf({ name: entry.name, isFile: entry.isFile() }) ?? [])
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
