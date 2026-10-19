import { feedStreamUrlOf, isFeedChannel, type FeedStreamEnvelope } from '../core/feed.js'

type FeedValueListener = (data: unknown) => void

/** 推送客户端用到的浏览器能力，测试里换成假的 */
export type FeedClientEnvironment = {
  /** 连一条事件流收这几个频道，每收到一个值调 onValue；返回断开的函数 */
  openStream(channels: readonly string[], onValue: (channel: string, data: unknown) => void): () => void
  isVisible(): boolean
  onVisibilityChange(listener: () => void): void
}

export type SiteFeedClient = {
  /** 订阅一个频道：已经收到过值就马上回调一次，之后每推一次回调一次；返回退订的函数 */
  subscribe(channel: string, listener: FeedValueListener): () => void
}

type LocalChannel = { latest: { data: unknown } | null; listeners: Set<FeedValueListener> }

/**
 * 一个标签页里的推送客户端：这页要的全部频道合在一条事件流里，页面隐藏时断开、重新显示时再连。
 * Chrome 对同一个协议、主机、端口的 HTTP/1.1 连接整个浏览器配置合起来最多 6 个，长连接占着名额，页面请求就只能排队；
 * 频道只留最新一份、连上先收到现在的值，所以后台页断开不丢状态。
 * 要的频道只增不减：退订只摘掉回调，事件流里照旧收着那个频道
 */
export function createSiteFeedClient(environment: FeedClientEnvironment): SiteFeedClient {
  const local = new Map<string, LocalChannel>()
  let closeStream: (() => void) | null = null
  let reconnectQueued = false

  const deliver = (channel: string, data: unknown) => {
    const state = local.get(channel)
    if (state === undefined) return
    state.latest = { data }
    for (const listener of state.listeners) listener(data)
  }

  const disconnect = () => {
    closeStream?.()
    closeStream = null
  }

  const reconnect = () => {
    reconnectQueued = false
    disconnect()
    if (environment.isVisible()) closeStream = environment.openStream([...local.keys()].sort(), deliver)
  }

  /** 同一轮里新要的几个频道合成一次重连 */
  const queueReconnect = () => {
    if (reconnectQueued) return
    reconnectQueued = true
    queueMicrotask(reconnect)
  }

  environment.onVisibilityChange(() => {
    if (!environment.isVisible()) disconnect()
    else if (closeStream === null && local.size > 0) queueReconnect()
  })

  return {
    subscribe(channel, listener) {
      if (!isFeedChannel(channel)) throw new Error(`频道名 ${channel} 不对：只用字母、数字、_、-`)
      const known = local.get(channel)
      const state: LocalChannel = known ?? { latest: null, listeners: new Set() }
      local.set(channel, state)
      state.listeners.add(listener)
      if (state.latest !== null) listener(state.latest.data)
      if (known === undefined) queueReconnect()
      return () => state.listeners.delete(listener)
    },
  }
}

function openEventStream(channels: readonly string[], onValue: (channel: string, data: unknown) => void): () => void {
  const source = new EventSource(feedStreamUrlOf(channels))
  const [onlyChannel] = channels
  source.addEventListener('message', (event) => {
    const data = JSON.parse(event.data as string) as unknown
    if (channels.length === 1) onValue(onlyChannel!, data)
    else {
      const envelope = data as FeedStreamEnvelope
      onValue(envelope.channel, envelope.data)
    }
  })
  return () => source.close()
}

const browserEnvironment: FeedClientEnvironment = {
  openStream: openEventStream,
  isVisible: () => document.visibilityState === 'visible',
  onVisibilityChange: (listener) => document.addEventListener('visibilitychange', listener),
}

let browserClient: SiteFeedClient | null = null

/** 这个标签页的推送客户端，第一次用到时建 */
export function siteFeedClient(): SiteFeedClient {
  browserClient ??= createSiteFeedClient(browserEnvironment)
  return browserClient
}
