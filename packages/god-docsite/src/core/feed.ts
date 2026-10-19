/**
 * 推送通道的协议（外部契约，gwb-docsite 照它推）：启动方经环境变量给站点进程一个令牌，
 * 推的一方 POST JSON 到 `/__docsite/feed/<频道>` 并在请求头里带上同一个令牌；每个频道只留最新一份。
 * 订阅是 GET 同一地址、请求头 Accept 写 text/event-stream：浏览器不带令牌；启动方带上令牌订阅，站点就知道它在听（站点往频道里写请求、由启动方接手时用）。
 * 订阅地址的最后一段可以是逗号隔开的几个频道（`/__docsite/feed/a,b`），一条事件流收这几个频道，每条事件的 data 是 `{"channel":频道,"data":值}`；
 * 只写一个频道时 data 就是值本身
 */
export const feedTokenEnvName = 'DOCSITE_FEED_TOKEN'
export const feedEndpointPrefix = '/__docsite/feed'
export const feedTokenHeader = 'x-docsite-token'
/** 订阅地址里隔开几个频道的符号；频道名里不会有它 */
export const feedChannelListSeparator = ','

const channelPattern = /^[\w-]+$/

/** 频道名：字母、数字、_、- */
export function isFeedChannel(channel: string) {
  return channelPattern.test(channel)
}

export function feedUrlOf(channel: string) {
  if (!isFeedChannel(channel)) throw new Error(`频道名 ${channel} 不对：只用字母、数字、_、-`)
  return `${feedEndpointPrefix}/${channel}`
}

/** 订阅几个频道的一条事件流的地址；只有一个频道时就是 feedUrlOf(频道)，事件 data 是值本身 */
export function feedStreamUrlOf(channels: readonly string[]) {
  if (channels.length === 0) throw new Error('至少订阅一个频道')
  for (const channel of channels) if (!isFeedChannel(channel)) throw new Error(`频道名 ${channel} 不对：只用字母、数字、_、-`)
  return `${feedEndpointPrefix}/${channels.join(feedChannelListSeparator)}`
}

/** 几个频道合在一条事件流里时，每条事件的 data */
export type FeedStreamEnvelope = { channel: string; data: unknown }
