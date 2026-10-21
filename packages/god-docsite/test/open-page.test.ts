import { afterEach, describe, expect, it } from 'vitest'
import { feedTokenEnvName, feedTokenHeader } from '../src/core/feed'
import { isSitePath, openPageChannel, parseOpenPageRequest } from '../src/core/open-page'
import { feedHub } from '../src/node/feed-hub'
import { feedAction } from '../src/site/feed.server'

afterEach(() => {
  feedHub().latest.delete(openPageChannel)
  delete process.env[feedTokenEnvName]
})

describe('isSitePath：站内地址', () => {
  it('以 / 开头、不以 // 开头、不带空白', () => {
    expect(['/', '/papers/abc', '/docs/a?x=1#h'].every(isSitePath)).toBe(true)
    expect(['papers', '//evil.example/x', 'http://x/', '/a b', 3].some(isSitePath)).toBe(false)
  })
})

describe('parseOpenPageRequest', () => {
  it('收 { path, at }，写错了报错写明哪一项', () => {
    expect(parseOpenPageRequest({ path: '/papers/abc', at: 1 })).toEqual({ path: '/papers/abc', at: 1 })
    expect(() => parseOpenPageRequest('/papers')).toThrow('要是 { path, at }')
    expect(() => parseOpenPageRequest({ path: 'papers', at: 1 })).toThrow('path 要是以 / 开头的站内地址')
    expect(() => parseOpenPageRequest({ path: '/papers' })).toThrow('at 要是毫秒时间戳')
  })
})

describe('推送入口核对频道 open-page 的形状', () => {
  const post = (data: unknown) =>
    feedAction({
      request: new Request(`http://site/__docsite/feed/${openPageChannel}`, { method: 'POST', headers: { [feedTokenHeader]: 'token' }, body: JSON.stringify(data) }),
      params: { channel: openPageChannel },
    } as unknown as Parameters<typeof feedAction>[0])

  it('写对了存下，写错了 400、不存', async () => {
    process.env[feedTokenEnvName] = 'token'
    expect((await post({ path: 'nowhere', at: 1 })).status).toBe(400)
    expect(feedHub().latest.has(openPageChannel)).toBe(false)
    expect((await post({ path: '/papers/abc', at: 1 })).status).toBe(204)
    expect(feedHub().latest.get(openPageChannel)).toEqual({ path: '/papers/abc', at: 1 })
  })
})
