import { messageOf } from '../../errors.js'

/** 订阅哪个 ntfy 的哪几个 topic */
export type NtfyTopics = { url: string; topics: string[] }

/** ntfy 推来的一条：发在哪个 topic 上，标题、正文没写时为 null */
export type NtfyMessage = { topic: string; title: string | null; message: string | null }

/** 订阅此刻的状态：连上了；正在连；断开了、隔一会儿重连（error 是断开的原因） */
export type NtfyState = { state: 'connected' | 'connecting' | 'waiting'; error: string | null }

/** 断线后第一次重连等多久，之后每次翻倍，最长 maxRetryMilliseconds */
const firstRetryMilliseconds = 1_000
const maxRetryMilliseconds = 60_000
/** ntfy 每 45 秒发一次保活；这么久什么都没收到，连接多半已经失效（比如电脑睡眠过），主动断开重连 */
const silenceLimitMilliseconds = 120_000

export type NtfySubscriptionDeps = {
  fetch: typeof fetch
  onMessage(message: NtfyMessage): void
  /** 连上了（第一次连上，或断开后又连上）：连上之前发的消息都没收到 */
  onOpened(): void
  onState(state: NtfyState): void
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>
}

/** 对几个 topic 保持一条长连接，按 ntfy 的 JSON 流逐行读；断了就隔一会儿重连，stop 之后不再连 */
export class NtfySubscription {
  private readonly abort = new AbortController()
  private current: NtfyState

  constructor(
    readonly topics: NtfyTopics,
    private readonly deps: NtfySubscriptionDeps,
  ) {
    this.current = { state: 'connecting', error: null }
  }

  stateOf(): NtfyState {
    return this.current
  }

  start(): Promise<void> {
    return this.run()
  }

  stop(): void {
    this.abort.abort()
  }

  private setState(state: NtfyState['state'], error: string | null): void {
    this.current = { state, error }
    this.deps.onState(this.current)
  }

  private async run(): Promise<void> {
    let retry = firstRetryMilliseconds
    while (!this.abort.signal.aborted) {
      this.setState('connecting', this.current.error)
      try {
        await this.readStream(() => {
          retry = firstRetryMilliseconds
          this.setState('connected', null)
          this.deps.onOpened()
        })
        throw new Error('ntfy 关闭了连接')
      } catch (error) {
        if (this.abort.signal.aborted) return
        this.setState('waiting', messageOf(error))
        await this.deps.sleep(retry, this.abort.signal).catch(() => {})
        retry = Math.min(retry * 2, maxRetryMilliseconds)
      }
    }
  }

  /** 读一条长连接直到它结束；中途 silenceLimitMilliseconds 什么都没收到就断开 */
  private async readStream(onOpen: () => void): Promise<void> {
    const connection = new AbortController()
    const stopConnection = () => connection.abort()
    this.abort.signal.addEventListener('abort', stopConnection)
    let silence: ReturnType<typeof setTimeout> | undefined
    const resetSilence = () => {
      clearTimeout(silence)
      silence = setTimeout(() => connection.abort(new Error(`${silenceLimitMilliseconds / 1000} 秒没收到 ntfy 的任何数据`)), silenceLimitMilliseconds)
    }
    try {
      resetSilence()
      const response = await this.deps.fetch(`${this.topics.url}/${this.topics.topics.join(',')}/json`, { signal: connection.signal })
      if (!response.ok || response.body === null) throw new Error(`ntfy 回 HTTP ${response.status}`)
      const decoder = new TextDecoder()
      let pending = ''
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        resetSilence()
        pending += decoder.decode(chunk, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop()!
        for (const line of lines) this.handleLine(line, onOpen)
      }
    } catch (error) {
      if (connection.signal.aborted && connection.signal.reason instanceof Error) throw connection.signal.reason
      throw error
    } finally {
      clearTimeout(silence)
      this.abort.signal.removeEventListener('abort', stopConnection)
    }
  }

  private handleLine(line: string, onOpen: () => void): void {
    if (line.trim() === '') return
    const { event, topic, title, message } = JSON.parse(line) as { event?: unknown; topic?: unknown; title?: unknown; message?: unknown }
    if (event === 'open') onOpen()
    else if (event === 'message') {
      if (typeof topic !== 'string') throw new Error(`ntfy 的消息里没有 topic：${line}`)
      this.deps.onMessage({ topic, title: typeof title === 'string' ? title : null, message: typeof message === 'string' ? message : null })
    }
  }
}
