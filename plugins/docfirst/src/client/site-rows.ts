/** 窗格显示用的纯函数：剩多久、站叫什么、状态怎么说。不碰 DOM，tests/site-rows.test.ts 直接测 */

/** docfirst.site.list 回的一个站，跟 node 侧的 HostedSiteState 同形 */
export interface SiteRow {
  dir: string
  port: number | null
  status: 'running' | 'building' | 'starting' | 'stopped' | 'expired' | 'failed'
  pid: number | null
  url: string | null
  expiresAt: string | null
  error: string | null
}

export const SITE_LIST_COMMAND = 'docfirst.site.list'

/** 列表多久重新取一次；倒计时另按秒走 */
export const REFRESH_MS = 5_000

const STATUS_LABELS: Record<SiteRow['status'], string> = {
  running: '开着',
  building: '构建中',
  starting: '启动中',
  stopped: '停着',
  expired: '已到期',
  failed: '出错',
}

export const statusLabel = (status: SiteRow['status']): string => STATUS_LABELS[status]

/** 状态文字用哪种颜色：开着的照常，出错的标红，其余淡色。状态名放在 .ts 里：写进 .tsx 会被样式检查当成漏了前缀的类名 */
export const statusTone = (status: SiteRow['status']): 'normal' | 'error' | 'muted' => (status === 'running' ? 'normal' : status === 'failed' ? 'error' : 'muted')

/** 站目录只留最后两段，`D:\…\gwb-block-note-redesign\docs-site` → `gwb-block-note-redesign/docs-site` */
export function shortName(dir: string): string {
  return dir.split(/[\\/]+/).filter((part) => part !== '').slice(-2).join('/')
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** 还剩多久到期：一小时以上写到分，一小时以内写到秒；过了时刻还没停（停的动作在排队）写「正在停」 */
export function remainingText(expiresAt: string, now: number): string {
  const left = Math.floor((Date.parse(expiresAt) - now) / 1000)
  if (left <= 0) return '正在停'
  const hours = Math.floor(left / 3600)
  const minutes = Math.floor((left % 3600) / 60)
  const seconds = left % 60
  return hours > 0 ? `${String(hours)} 小时 ${pad(minutes)} 分` : `${String(minutes)} 分 ${pad(seconds)} 秒`
}

/** 报错只显示第一行，全文放在悬停提示里 */
export const firstLine = (text: string): string => text.split('\n', 1)[0] ?? ''
