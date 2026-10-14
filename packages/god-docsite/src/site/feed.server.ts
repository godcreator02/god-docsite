import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { feedTokenEnvName, feedTokenHeader, isFeedChannel } from '../core/feed.js'

type FeedListener = (data: unknown) => void
type FeedHub = { latest: Map<string, unknown>; listeners: Map<string, Set<FeedListener>> }

// 挂在 globalThis 上：dev 下站点模块随热更新重新执行时，订阅表若跟着模块走，已连着的浏览器就收不到之后的推送
const feedHubKey = Symbol.for('@godcreator/god-docsite/feed-hub')

function feedHub(): FeedHub {
  const holder = globalThis as { [feedHubKey]?: FeedHub }
  holder[feedHubKey] ??= { latest: new Map(), listeners: new Map() }
  return holder[feedHubKey]
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

function subscribe(channel: string, listener: FeedListener): () => void {
  const listeners = feedHub().listeners
  const ofChannel = listeners.get(channel) ?? new Set()
  listeners.set(channel, ofChannel)
  ofChannel.add(listener)
  return () => ofChannel.delete(listener)
}

function channelOf(params: LoaderFunctionArgs['params']): string {
  const channel = params['channel']
  if (channel === undefined || !isFeedChannel(channel)) throw textResponse(404, `频道名 ${String(channel)} 不对：只用字母、数字、_、-`)
  return channel
}

function textResponse(status: number, text: string) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

/** 一个频道的事件流：先发现在的值（推过才有），之后每推一次发一次，浏览器断开时退订 */
function eventStreamOf(channel: string, signal: AbortSignal): Response {
  const encoder = new TextEncoder()
  let unsubscribe = () => {}
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      controller.enqueue(encoder.encode(': connected\n\n'))
      const hub = feedHub()
      if (hub.latest.has(channel)) send(hub.latest.get(channel))
      unsubscribe = subscribe(channel, send)
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
 * 否则回这个频道现在的值的 JSON（还没推过是 null）
 */
export function feedLoader({ request, params }: LoaderFunctionArgs): Response {
  const channel = channelOf(params)
  if (request.headers.get('accept')?.includes('text/event-stream')) return eventStreamOf(channel, request.signal)
  return Response.json(siteFeedValue(channel) ?? null, { headers: { 'Cache-Control': 'no-cache' } })
}

/**
 * 推送通道的入口（同一路由的 action）：POST JSON，请求头带启动方经环境变量 DOCSITE_FEED_TOKEN 给的令牌。
 * 站点进程没有令牌、令牌不对 403，正文不是 JSON 400；成功 204
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
  publishSiteFeed(channel, data)
  return new Response(null, { status: 204 })
}
