/**
 * 到点自动关的算术。纯函数：时间由调用方传进来，不读系统时钟，所以状态机与界面两头
 * 都能用同一份（浏览器半只拿 formatRemaining 与 WARN_BEFORE_MS）。
 *
 * 为什么用**绝对到期时刻 + 定期对表**而不是一个 setTimeout：机器睡一觉 setTimeout 会漂，
 * 醒来时它还以为没到点；对表是每半分钟拿 now 跟到期时刻比一次，睡多久都对。
 */

/** 到点前多久给「延长」：五分钟 */
export const WARN_BEFORE_MS = 5 * 60_000

/** 对表间隔：半分钟 */
export const TICK_MS = 30_000

/** 设置项 auto-stop-minutes 的缺省：两小时 */
export const DEFAULT_AUTO_STOP_MINUTES = 120

/**
 * 设置值 → 分钟数。数字与数字串都认（设置件 number 型的值从界面来时可能是字符串），
 * 0 合法（= 不自动关）；缺、空、负数、非数一律回缺省。
 */
export function autoStopMinutes(raw: unknown, fallback = DEFAULT_AUTO_STOP_MINUTES): number {
  let n = Number.NaN
  if (typeof raw === 'number') n = raw
  else if (typeof raw === 'string' && raw.trim() !== '') n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

/** 绝对到期时刻；0 分钟 = 没有到期时刻 */
export function deadlineFor(now: number, minutes: number): number | undefined {
  return minutes <= 0 ? undefined : now + minutes * 60_000
}

/** 剩余毫秒 → 「1h58m」「9m」「<1m」；负数也显 <1m（到点那一刻还没来得及停时不显负数） */
export function formatRemaining(ms: number): string {
  if (ms < 60_000) return '<1m'
  const minutes = Math.floor(ms / 60_000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}m` : `${m}m`
}

export type Due = 'ok' | 'warn' | 'expired'

/** 对表：没有到期时刻永远 ok；进了提前量 warn；过了点 expired */
export function dueState(deadline: number | undefined, now: number): Due {
  if (deadline === undefined) return 'ok'
  const remaining = deadline - now
  if (remaining <= 0) return 'expired'
  return remaining <= WARN_BEFORE_MS ? 'warn' : 'ok'
}
