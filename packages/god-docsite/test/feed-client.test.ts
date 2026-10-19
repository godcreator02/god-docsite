import { describe, expect, it } from 'vitest'
import { createSiteFeedClient, type FeedClientEnvironment } from '../src/site/feed-client.js'

type FakeStream = { channels: readonly string[]; push(channel: string, data: unknown): void; open: boolean }

/** 假的浏览器：记下开过的事件流，能切换页面可见与否 */
function fakeBrowser(visible = true) {
  let pageVisible = visible
  const visibilityListeners: (() => void)[] = []
  const streams: FakeStream[] = []
  const environment: FeedClientEnvironment = {
    openStream(channels, onValue) {
      const stream: FakeStream = { channels, push: (channel, data) => stream.open && onValue(channel, data), open: true }
      streams.push(stream)
      return () => {
        stream.open = false
      }
    },
    isVisible: () => pageVisible,
    onVisibilityChange: (listener) => visibilityListeners.push(listener),
  }
  const setVisible = (next: boolean) => {
    pageVisible = next
    for (const listener of visibilityListeners) listener()
  }
  const openStreams = () => streams.filter((stream) => stream.open)
  return { environment, streams, openStreams, setVisible }
}

const settled = () => new Promise<void>((resolve) => queueMicrotask(resolve))

describe('推送客户端', () => {
  it('一页里订的几个频道合在一条事件流里，推来的值交给各自的订阅', async () => {
    const browser = fakeBrowser()
    const client = createSiteFeedClient(browser.environment)
    const collab: unknown[] = []
    const submit: unknown[] = []
    client.subscribe('collab', (data) => collab.push(data))
    client.subscribe('collab-submit', (data) => submit.push(data))
    await settled()
    expect(browser.streams.map((stream) => stream.channels)).toEqual([['collab', 'collab-submit']])
    browser.openStreams()[0]!.push('collab', { n: 1 })
    browser.openStreams()[0]!.push('collab-submit', { state: 'idle' })
    expect(collab).toEqual([{ n: 1 }])
    expect(submit).toEqual([{ state: 'idle' }])
  })

  it('页面隐藏时断开，重新显示时再连；隐藏时打开的页先不连', async () => {
    const browser = fakeBrowser(false)
    const client = createSiteFeedClient(browser.environment)
    client.subscribe('collab', () => {})
    await settled()
    expect(browser.openStreams()).toHaveLength(0)
    browser.setVisible(true)
    await settled()
    expect(browser.openStreams().map((stream) => stream.channels)).toEqual([['collab']])
    browser.setVisible(false)
    expect(browser.openStreams()).toHaveLength(0)
    browser.setVisible(true)
    await settled()
    expect(browser.openStreams()).toHaveLength(1)
    expect(browser.streams).toHaveLength(2)
  })

  it('后订的同一频道马上拿到已收到的值；后来新要的频道重连一次，事件流里带上它', async () => {
    const browser = fakeBrowser()
    const client = createSiteFeedClient(browser.environment)
    client.subscribe('collab', () => {})
    await settled()
    browser.openStreams()[0]!.push('collab', { n: 1 })
    const late: unknown[] = []
    client.subscribe('collab', (data) => late.push(data))
    expect(late).toEqual([{ n: 1 }])
    await settled()
    expect(browser.streams).toHaveLength(1)
    client.subscribe('notes', () => {})
    await settled()
    expect(browser.openStreams().map((stream) => stream.channels)).toEqual([['collab', 'notes']])
  })

  it('退订后不再回调；频道名不对直接报错', async () => {
    const browser = fakeBrowser()
    const client = createSiteFeedClient(browser.environment)
    const received: unknown[] = []
    const unsubscribe = client.subscribe('collab', (data) => received.push(data))
    await settled()
    unsubscribe()
    browser.openStreams()[0]!.push('collab', { n: 1 })
    expect(received).toEqual([])
    expect(() => client.subscribe('a,b', () => {})).toThrow(/频道名/)
  })
})
