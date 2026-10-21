type FeedListener = (data: unknown) => void
/** launchers 记每个频道有几个带着令牌订阅的连接（启动方），浏览器的订阅不算 */
type FeedHub = { latest: Map<string, unknown>; listeners: Map<string, Set<FeedListener>>; launchers: Map<string, number> }

/**
 * 推送通道各频道现在的值与订阅者，挂在 globalThis 上。不变式：站点的服务端代码（经 Vite 的模块运行器加载）与 vite 插件在同一个进程里，
 * 经同一个 Symbol.for 键取到同一份；dev 下站点模块随热更新重新执行时，订阅表若跟着模块走，已连着的浏览器就收不到之后的推送
 */
const feedHubKey = Symbol.for('@godcreator/god-docsite/feed-hub')

export function feedHub(): FeedHub {
  const holder = globalThis as { [feedHubKey]?: FeedHub }
  holder[feedHubKey] ??= { latest: new Map(), listeners: new Map(), launchers: new Map() }
  return holder[feedHubKey]
}

/** 订阅一个频道之后的每次推送（不先发现在的值）；返回退订的函数 */
export function subscribeFeedHub(channel: string, listener: FeedListener): () => void {
  const listeners = feedHub().listeners
  const ofChannel = listeners.get(channel) ?? new Set()
  listeners.set(channel, ofChannel)
  ofChannel.add(listener)
  return () => ofChannel.delete(listener)
}
