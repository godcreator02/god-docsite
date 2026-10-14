import { calendarUrl } from '../../core/layout.js'
import { isRealDate } from '../../core/journal.js'
import { dayMs, isoDateOf } from '../../core/timeline.js'

/** 月份写成 YYYY-MM；日期取前 7 位就是它所在的月 */
export const monthOf = (date: string) => date.slice(0, 7)

/** 某个月往前、往后挪几个月 */
export function shiftedMonth(month: string, by: number): string {
  const first = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1))
  return isoDateOf(first.getTime()).slice(0, 7)
}

/** 月历要画的日子：从这个月一号所在那一周的周一，到月底所在那一周的周日 */
export function calendarDaysOf(month: string): string[] {
  const first = Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
  const last = Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  const mondayIndex = (day: number) => (new Date(day).getUTCDay() + 6) % 7
  const start = first - mondayIndex(first) * dayMs
  const end = last + (6 - mondayIndex(last)) * dayMs
  return Array.from({ length: (end - start) / dayMs + 1 }, (_, index) => isoDateOf(start + index * dayMs))
}

/** 日历地址里的月份：/calendar?month=2026-10；不写就是今天所在的月，写了不是 YYYY-MM 就回 null */
export function requestedMonthOf(value: string | null, today: string): string | null {
  if (value === null) return monthOf(today)
  return /^\d{4}-\d{2}$/.test(value) && isRealDate(`${value}-01`) ? value : null
}

export const calendarUrlOfMonth = (month: string) => `${calendarUrl}?month=${month}`
