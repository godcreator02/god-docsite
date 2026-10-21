import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { feedChannelListSeparator, feedTokenEnvName, feedTokenHeader, isFeedChannel, type FeedStreamEnvelope } from '../core/feed.js'
import { hostChannel, parseHostContext } from '../core/host-context.js'
import { feedHub, subscribeFeedHub } from '../node/feed-hub.js'

type FeedListener = (data: unknown) => void

/**
 * 启动方（带着 DOCSITE_FEED_TOKEN 订阅的一方，比如 gwb-docsite）此刻有没有在听这个频道：
 * 站点要启动方替它做事时（往频道里写一份请求），先用它确认有人接
 */
export function siteFeedHasLauncher(channel: string): boolean {
  return (feedHub().launchers.get(channel) ?? 0) > 0
}

function countLauncher(channel: string, delta: 1 | -1): void {
  const launchers = feedHub().launchers
  launchers.set(channel, (launchers.get(channel) ?? 0) + delta)
}

/** 某个频道现在的值，还没推过是 undefined：给布局、页面的 loader 读 */
export function siteFeedValue<Data>(channel: string): Data | undefined {
  return feedHub().latest.get(channel) as Data | undefined
}

/** 存下某个频道的新值并发给所有订阅者；推送 action 与站点自己的服务端代码都用它 */
export function publishSiteFeed(channel: string, data: unknown): void {
  if (!isFeedChannel(channel)) throw new Error(`频道名 ${channel} 不对：只用字母、数字、_、-`)
  const hub = feedHub()
  hub.latest.set(channel, data)
  for (const listener of hub.listeners.get(channel) ?? []) listener(data)
}

function channelOf(params: LoaderFunctionArgs['params']): string {
  const channel = params['channel']
  if (channel === undefined || !isFeedChannel(channel)) throw textResponse(404, `频道名 ${String(channel)} 不对：只用字母、数字、_、-；读现在的值、推送一次只能一个频道`)
  return channel
}

/** 订阅地址最后一段里的频道：一个频道，或逗号隔开的几个（listed 为 true，事件 data 要带上频道名） */
function streamChannelsOf(params: LoaderFunctionArgs['params']): { channels: string[]; listed: boolean } {
  const segment = params['channel']
  if (segment === undefined) throw textResponse(404, '订阅地址缺频道名')
  const channels = [...new Set(segment.split(feedChannelListSeparator))]
  const wrong = channels.find((channel) => !isFeedChannel(channel))
  if (wrong !== undefined) throw textResponse(404, `频道名 ${wrong} 不对：只用字母、数字、_、-，几个频道用逗号隔开`)
  return { channels, listed: segment.includes(feedChannelListSeparator) }
}

function textResponse(status: number, text: string) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

/**
 * 几个频道合在一条事件流里：先发各频道现在的值（推过才有），之后每推一次发一次，对方断开时退订；
 * listed 时每条事件的 data 是 { channel, data }，否则是值本身。launcher 是带着令牌订阅的启动方
 */
function eventStreamOf(channels: readonly string[], listed: boolean, signal: AbortSignal, launcher: boolean): Response {
  const encoder = new TextEncoder()
  let unsubscribe = () => {}
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      const senderOf = (channel: string): FeedListener =>
        listed ? (data) => write({ channel, data } satisfies FeedStreamEnvelope) : write
      controller.enqueue(encoder.encode(': connected\n\n'))
      const hub = feedHub()
      const unsubscribeListeners = channels.map((channel) => {
        const send = senderOf(channel)
        if (hub.latest.has(channel)) send(hub.latest.get(channel))
        return subscribeFeedHub(channel, send)
      })
      if (launcher) for (const channel of channels) countLauncher(channel, 1)
      let unsubscribed = false
      unsubscribe = () => {
        if (unsubscribed) return
        unsubscribed = true
        for (const unsubscribeListener of unsubscribeListeners) unsubscribeListener()
        if (launcher) for (const channel of channels) countLauncher(channel, -1)
      }
      signal.addEventListener('abort', () => {
        unsubscribe()
        if (closed) return
        closed = true
        controller.close()
      })
    },
    cancel() {
      closed = true
      unsubscribe()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

/**
 * 推送通道的资源路由 loader（路由 `__docsite/feed/:channel`）：请求头要 text/event-stream（EventSource）时回事件流，
 * 地址最后一段可以是逗号隔开的几个频道；否则回这个频道现在的值的 JSON（还没推过是 null）。
 * 事件流的请求头带了令牌就算启动方在听（siteFeedHasLauncher），令牌不对 403
 */
export function feedLoader({ request, params }: LoaderFunctionArgs): Response {
  if (!request.headers.get('accept')?.includes('text/event-stream')) {
    return Response.json(siteFeedValue(channelOf(params)) ?? null, { headers: { 'Cache-Control': 'no-cache' } })
  }
  const { channels, listed } = streamChannelsOf(params)
  const token = request.headers.get(feedTokenHeader)
  if (token === null) return eventStreamOf(channels, listed, request.signal, false)
  const expected = process.env[feedTokenEnvName]
  if (!expected) return textResponse(403, `站点进程没有 ${feedTokenEnvName}：只有启动方给了令牌的站认启动方的订阅`)
  if (token !== expected) return textResponse(403, `${feedTokenHeader} 不对`)
  return eventStreamOf(channels, listed, request.signal, true)
}

/**
 * 推送通道的入口（同一路由的 action）：POST JSON，请求头带启动方经环境变量 DOCSITE_FEED_TOKEN 给的令牌。
 * 站点进程没有令牌、令牌不对 403，正文不是 JSON、推给频道 host 的托管方上下文写错了 400；成功 204
 */
export async function feedAction({ request, params }: ActionFunctionArgs): Promise<Response> {
  const channel = channelOf(params)
  if (request.method !== 'POST') return textResponse(405, '只收 POST')
  const token = process.env[feedTokenEnvName]
  if (!token) return textResponse(403, `站点进程没有 ${feedTokenEnvName}：只有启动方给了令牌的站收推送`)
  if (request.headers.get(feedTokenHeader) !== token) return textResponse(403, `${feedTokenHeader} 不对`)
  const body = await request.text()
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch (error) {
    if (error instanceof SyntaxError) return textResponse(400, `正文要是 JSON：${error.message}`)
    throw error
  }
  if (channel === hostChannel) {
    try {
      parseHostContext(data)
    } catch (error) {
      return textResponse(400, error instanceof Error ? error.message : String(error))
    }
  }
  publishSiteFeed(channel, data)
  return new Response(null, { status: 204 })
}
