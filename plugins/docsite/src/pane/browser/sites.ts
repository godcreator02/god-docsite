/** docsite.site.list 回执里的一行，形状照 node 侧 src/site-list.ts 的 SiteListing */
export type SiteRow = {
  dir: string
  state: 'running' | 'stopped' | 'failed'
  url: string | null
  error: string | null
  title: string | null
  hosted: boolean
  by: string | null
}

/** docsite.site.add 登记的站记的 by；窗格里只有这种站能「不再托管」，别的插件登记的由那个插件管 */
export const addedByCommand = 'docsite.site.add'

/** 状态的颜色：正常（绿）、出错（红）、没有结论（灰） */
export type Tone = 'ok' | 'bad' | 'muted'

export function siteStateOf(site: SiteRow): { tone: Tone; label: string } {
  if (site.state === 'running') return { tone: 'ok', label: '运行中' }
  if (site.state === 'failed') return { tone: 'bad', label: '没能启动' }
  return { tone: 'muted', label: '已停' }
}

/** 这个站从哪来：手动加的、某个插件登记的，或者没登记、只是这次被启动过 */
export function sourceOf(site: SiteRow): { label: string; title: string } {
  if (!site.hosted) return { label: '临时', title: '没有登记为常驻，只是这次被启动过（建站检查、验页面）；工作台重启后不再启动' }
  if (site.by === addedByCommand) return { label: '手动', title: '用 docsite.site.add 登记的常驻站点，工作台每次启动都启动它' }
  return { label: site.by ?? '', title: `${site.by ?? ''} 登记的常驻站点，登记与撤销由它管；工作台每次启动都启动它` }
}

/** 窗格里能不能「不再托管」：只有手动登记的；插件登记的去那个插件撤（协作站移出项目列表），不然它下次加载又登记回来 */
export function canUnhost(site: SiteRow): boolean {
  return site.hosted && site.by === addedByCommand
}

/** 站名：站点 content/meta.json 的 title，没有就用目录名（协作站的目录名都是 site，取上一级） */
export function siteNameOf(site: SiteRow): string {
  if (site.title !== null) return site.title
  const segments = site.dir.split(/[\\/]/).filter(Boolean)
  const last = segments.at(-1) ?? site.dir
  return last === 'site' && segments.length > 1 ? `${segments.at(-2)}/site` : last
}

/** 命令总线的回执：{ ok: true, data } 或 { ok: false, error } */
export type Receipt<T> = { ok: true; data: T } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function receiptOf<T>(reply: unknown): Receipt<T> {
  if (!isRecord(reply)) return { ok: false, error: `命令回执不是对象：${JSON.stringify(reply)}` }
  if (reply.ok === true) return { ok: true, data: reply.data as T }
  return { ok: false, error: typeof reply.error === 'string' ? reply.error : JSON.stringify(reply) }
}
