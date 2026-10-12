/**
 * 推送通道的协议件（无 Node、无 React）：gwb 插件往开发服务推数据，按频道只留最新一份。
 * 浏览器 hook（./site-feed-hook）与组合包 vite 插件里的服务共用这一份
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
