import { describe, expect, it } from 'vitest'
import { NtfySubscription, type NtfyState } from '../../../src/organization/events/ntfy-subscription.js'

/** 一条长连接：按给定的块依次吐出，吐完就结束（相当于服务器关了连接） */
function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
  )
}

describe('长连接订阅', () => {
  it('一条连接订几个 topic，逐行读 ntfy 的 JSON 流：每次连上（第一次和重连上）都报一次；消息带着它的 topic、标题与正文交出去，保活不交', async () => {
    const urls: string[] = []
    const events: string[] = []
    const states: NtfyState['state'][] = []
    const connections = [
      streamOf([
        '{"event":"open","topic":"collab-chb-dab-sst,collab-hybrid-mmc"}\n{"event":"keep',
        'alive","topic":"collab-chb-dab-sst,collab-hybrid-mmc"}\n{"event":"message","topic":"collab-hybrid-mmc","title":"hybrid-mmc/collab","message":"push refs/heads/main"}\n',
      ]),
      streamOf(['{"event":"open"}\n']),
    ]
    let subscription: NtfySubscription
    const done = new Promise<void>((resolve) => {
      subscription = new NtfySubscription(
        { url: 'https://ntfy.example.org', topics: ['collab-chb-dab-sst', 'collab-hybrid-mmc'] },
        {
          fetch: async (url) => {
            urls.push(String(url))
            const next = connections.shift()
            if (next === undefined) {
              subscription.stop()
              resolve()
              throw new Error('测试结束')
            }
            return next
          },
          onMessage: (message) => events.push(`message ${message.topic} ${message.title} ${message.message}`),
          onOpened: () => events.push('opened'),
          onState: (state) => states.push(state.state),
          sleep: async () => {},
        },
      )
    })
    const running = subscription!.start()
    await done
    await running
    expect(urls).toEqual(Array(3).fill('https://ntfy.example.org/collab-chb-dab-sst,collab-hybrid-mmc/json'))
    expect(events).toEqual(['opened', 'message collab-hybrid-mmc hybrid-mmc/collab push refs/heads/main', 'opened'])
    expect(states).toEqual(['connecting', 'connected', 'waiting', 'connecting', 'connected', 'waiting', 'connecting'])
    expect(subscription!.stateOf().error).toBe('ntfy 关闭了连接')
  })

  it('ntfy 回错误码：记下原因、隔一会儿重连，间隔一次比一次长', async () => {
    const waits: number[] = []
    let subscription: NtfySubscription
    subscription = new NtfySubscription(
      { url: 'https://ntfy.example.org', topics: ['collab-x'] },
      {
        fetch: async () => new Response('forbidden', { status: 403 }),
        onMessage: () => {},
        onOpened: () => {},
        onState: () => {},
        sleep: async (milliseconds) => {
          waits.push(milliseconds)
          if (waits.length === 3) subscription.stop()
        },
      },
    )
    await subscription.start()
    expect(waits).toEqual([1000, 2000, 4000])
    expect(subscription.stateOf()).toMatchObject({ state: 'waiting', error: 'ntfy 回 HTTP 403' })
  })
})
