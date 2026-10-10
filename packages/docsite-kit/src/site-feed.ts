/**
 * 推送通道：gwb 插件往开发服务推数据（协作站的通知、项目负责人等），按频道只留最新一份。
 * 插件启动开发服务时把口令放进环境变量 DOCSITE_FEED_TOKEN，之后 POST /__docsite/feed/<频道>，请求头 x-docsite-token 带口令，正文是 JSON。
 * 开发服务存下来，经 Vite 的 WebSocket 发事件 docsite:feed 给浏览器；浏览器用 useSiteFeed、服务端用 siteFeedOf 取
 */

export const feedTokenEnvName = 'DOCSITE_FEED_TOKEN'
export const feedEndpointPrefix = '/__docsite/feed'
export const feedTokenHeader = 'x-docsite-token'
export const feedEvent = 'docsite:feed'

/** 发给浏览器的事件内容 */
export type FeedMessage = { channel: string; data: unknown }

const channelPattern = /^[\w-]+$/

/** 频道名：字母、数字、_、- */
export function isFeedChannel(channel: string) {
  return channelPattern.test(channel)
}

/** 推来的数据存在进程里：开发服务插件（Node 直接加载）与路由的 loader（经 Vite 的模块运行器加载）是两份模块，只有 globalThis 是同一个 */
const storeKey = Symbol.for('@godcreator/docsite-kit/site-feeds')

export function feedStore(): Map<string, unknown> {
  const holder = globalThis as { [storeKey]?: Map<string, unknown> }
  holder[storeKey] ??= new Map()
  return holder[storeKey]
}
