import type { WriteResult } from '../page-data.js'

/** 写入 action 回的被拒原话；还没回、成功、或回的是跳转时为 null */
export function writeErrorOf(result: WriteResult | undefined): string | null {
  return result !== undefined && !result.ok ? result.error : null
}
