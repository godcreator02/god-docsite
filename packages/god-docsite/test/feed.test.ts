import { afterEach, describe, expect, it } from 'vitest'
import { feedStreamUrlOf, feedTokenEnvName, feedTokenHeader, feedUrlOf, isFeedChannel } from '../src/core/feed.js'
import { feedAction, feedLoader, publishSiteFeed, siteFeedHasLauncher, siteFeedValue } from '../src/site/feed.server.js'

const originalToken = process.env[feedTokenEnvName]
afterEach(() => {
  if (originalToken === undefined) delete process.env[feedTokenEnvName]
  else process.env[feedTokenEnvName] = originalToken
})

function loaderArgs(request: Request, channel: string) {
  return { request, params: { channel }, context: {}, unstable_pattern: '' } as unknown as Parameters<typeof feedLoader>[0]
}

function push(channel: string, body: string, token: string | undefined) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== undefined) headers[feedTokenHeader] = token
  return feedAction(loaderArgs(new Request(`http://site${feedUrlOf(channel)}`, { method: 'POST', headers, body }), channel))
}

/** 读事件流里的 data 行，读够 count 条就断开 */
async function eventsOf(response: Response, count: number, abort: AbortController): Promise<unknown[]> {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  const events: unknown[] = []
  let buffered = ''
  while (events.length < count) {
    const { value, done } = await reader.read()
    if (done) break
    buffered += value
    const blocks = buffered.split('\n\n')
    buffered = blocks.pop()!
    for (const block of blocks) if (block.startsWith('data: ')) events.push(JSON.parse(block.slice('data: '.length)))
  }
  abort.abort()
  return events
}

describe('推送通道', () => {
  it('频道名只认字母、数字、下划线、连字符', () => {
    expect(isFeedChannel('notices')).toBe(true)
    expect(isFeedChannel('project-owner')).toBe(true)
    expect(isFeedChannel('a b')).toBe(false)
    expect(isFeedChannel('')).toBe(false)
    expect(isFeedChannel('通知')).toBe(false)
    expect(() => feedUrlOf('a/b')).toThrow(/频道名/)
  })

  it('站点进程没有令牌、令牌不对都 403，正文不是 JSON 400，推成功 204 并只留最新一份', async () => {
    delete process.env[feedTokenEnvName]
    expect((await push('t-token', '{}', 'x')).status).toBe(403)
    process.env[feedTokenEnvName] = 'secret'
    expect((await push('t-token', '{}', 'wrong')).status).toBe(403)
    expect((await push('t-token', '{}', undefined)).status).toBe(403)
    expect((await push('t-token', '{', 'secret')).status).toBe(400)
    expect((await push('t-token', '{"n":1}', 'secret')).status).toBe(204)
    expect((await push('t-token', '{"n":2}', 'secret')).status).toBe(204)
    expect(siteFeedValue('t-token')).toEqual({ n: 2 })
  })

  it('不要事件流时回现在的值，没推过是 null', async () => {
    expect(await feedLoader(loaderArgs(new Request('http://site/x'), 't-never')).json()).toBeNull()
    publishSiteFeed('t-json', { owner: '小周' })
    expect(await feedLoader(loaderArgs(new Request('http://site/x'), 't-json')).json()).toEqual({ owner: '小周' })
  })

  it('新订阅者先收到现在的值，之后每推一次收一次', async () => {
    publishSiteFeed('t-stream', { n: 1 })
    const abort = new AbortController()
    const response = feedLoader(loaderArgs(new Request('http://site/x', { headers: { accept: 'text/event-stream' }, signal: abort.signal }), 't-stream'))
    expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/)
    const received = eventsOf(response, 2, abort)
    await new Promise((resolve) => setTimeout(resolve, 10))
    publishSiteFeed('t-stream', { n: 2 })
    expect(await received).toEqual([{ n: 1 }, { n: 2 }])
  })

  it('逗号隔开的几个频道合在一条事件流里，每条事件带上频道名；只写一个频道时事件就是值本身', async () => {
    expect(feedStreamUrlOf(['t-list-a', 't-list-b'])).toBe('/__docsite/feed/t-list-a,t-list-b')
    expect(feedStreamUrlOf(['t-list-a'])).toBe(feedUrlOf('t-list-a'))
    expect(() => feedStreamUrlOf([])).toThrow(/至少/)
    publishSiteFeed('t-list-a', { n: 1 })
    const abort = new AbortController()
    const request = new Request('http://site/x', { headers: { accept: 'text/event-stream' }, signal: abort.signal })
    const received = eventsOf(feedLoader(loaderArgs(request, 't-list-a,t-list-b')), 3, abort)
    await new Promise((resolve) => setTimeout(resolve, 10))
    publishSiteFeed('t-list-b', { n: 2 })
    publishSiteFeed('t-list-a', { n: 3 })
    expect(await received).toEqual([
      { channel: 't-list-a', data: { n: 1 } },
      { channel: 't-list-b', data: { n: 2 } },
      { channel: 't-list-a', data: { n: 3 } },
    ])
    expect(() => feedLoader(loaderArgs(new Request('http://site/x', { headers: { accept: 'text/event-stream' } }), 't-list-a,a b'))).toThrow(Response)
    expect(() => feedLoader(loaderArgs(new Request('http://site/x'), 't-list-a,t-list-b'))).toThrow(Response)
  })

  it('带着令牌订阅的算启动方在听，断开就不算；浏览器的订阅不算；令牌不对 403', async () => {
    process.env[feedTokenEnvName] = 'secret'
    const subscribe = (headers: Record<string, string>, abort: AbortController) =>
      feedLoader(loaderArgs(new Request('http://site/x', { headers: { accept: 'text/event-stream', ...headers }, signal: abort.signal }), 't-launcher'))
    expect(siteFeedHasLauncher('t-launcher')).toBe(false)
    const browser = new AbortController()
    subscribe({}, browser)
    expect(siteFeedHasLauncher('t-launcher')).toBe(false)
    expect(subscribe({ [feedTokenHeader]: 'wrong' }, new AbortController()).status).toBe(403)
    const launcher = new AbortController()
    const received = eventsOf(subscribe({ [feedTokenHeader]: 'secret' }, launcher), 1, launcher)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(siteFeedHasLauncher('t-launcher')).toBe(true)
    publishSiteFeed('t-launcher', { request: 1 })
    expect(await received).toEqual([{ request: 1 }])
    expect(siteFeedHasLauncher('t-launcher')).toBe(false)
    browser.abort()
  })

  it('频道名不对 404', () => {
    expect(() => feedLoader(loaderArgs(new Request('http://site/x'), 'a b'))).toThrow(Response)
  })
})
