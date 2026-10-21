/** 推送频道：托管方要站点已经开着的应用窗口换到某一页（gwb-docsite 的 docsite.site.open 带 path、窗口已经开着时） */
export const openPageChannel = 'open-page'

/** 托管方新开应用窗口时加在地址上的查询参数：带着它打开过的标签页才跟随 open-page，打开后从地址里去掉 */
export const appWindowParam = 'docsite-app-window'

/** path 是站内地址；at 是推送时的毫秒时间戳，页面只跟随它开始听以后推的 */
export type OpenPageRequest = { path: string; at: number }

/** 站内地址：以 / 开头、不以 // 开头（那是另一个主机），不带空白 */
export function isSitePath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/\s/.test(value)
}

/** 推进频道 open-page 的数据核对形状，不对就报错写明哪一项 */
export function parseOpenPageRequest(value: unknown): OpenPageRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`频道 ${openPageChannel} 的数据要是 { path, at }，收到 ${JSON.stringify(value)}`)
  const { path, at } = value as Record<string, unknown>
  if (!isSitePath(path)) throw new Error(`频道 ${openPageChannel} 的 path 要是以 / 开头的站内地址，收到 ${JSON.stringify(path)}`)
  if (typeof at !== 'number' || !Number.isFinite(at)) throw new Error(`频道 ${openPageChannel} 的 at 要是毫秒时间戳，收到 ${JSON.stringify(at)}`)
  return { path, at }
}
