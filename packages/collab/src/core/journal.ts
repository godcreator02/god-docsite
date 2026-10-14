/** 站点目录下放日志页的文件夹 */
export const journalDirName = 'journal'

/** 日志页的文件：journal/<日期>.mdx */
export const journalFilePattern = /^(\d{4}-\d{2}-\d{2})\.mdx$/

/** YYYY-MM-DD 是不是真实存在的日期 */
export function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const day = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date
}

/** journal/ 里的一项不合规矩时的说法：只能是 <真实日期>.mdx，不放子文件夹与别的文件；合规矩为 null */
export function journalEntryProblemOf(entry: { name: string; isFile: boolean }): string | null {
  const file = `${journalDirName}/${entry.name}`
  if (!entry.isFile) return `${file}：${journalDirName}/ 里只放 <日期>.mdx，不放文件夹`
  const date = journalFilePattern.exec(entry.name)?.[1]
  if (date === undefined) return `${file}：日志页的文件名要是 YYYY-MM-DD.mdx`
  if (!isRealDate(date)) return `${file}：${date} 不是真实存在的日期`
  return null
}
