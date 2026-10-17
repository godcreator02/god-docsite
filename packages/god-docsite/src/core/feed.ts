/**
 * 推送通道的协议（外部契约，gwb-docsite 照它推）：启动方经环境变量给站点进程一个令牌，
 * 推的一方 POST JSON 到 `/__docsite/feed/<频道>` 并在请求头里带上同一个令牌；每个频道只留最新一份。
 * 订阅是 GET 同一地址、请求头 Accept 写 text/event-stream：浏览器不带令牌；启动方带上令牌订阅，站点就知道它在听（站点往频道里写请求、由启动方接手时用）
 */
export const feedTokenEnvName = 'DOCSITE_FEED_TOKEN'
export const feedEndpointPrefix = '/__docsite/feed'
export const feedTokenHeader = 'x-docsite-token'

const channelPattern = /^[\w-]+$/

/** 频道名：字母、数字、_、- */
export function isFeedChannel(channel: string) {
  return channelPattern.test(channel)
}

export function feedUrlOf(channel: string) {
  if (!isFeedChannel(channel)) throw new Error(`频道名 ${channel} 不对：只用字母、数字、_、-`)
  return `${feedEndpointPrefix}/${channel}`
}
