/** 列表里全部项目的 topic 合成一条实时推送订阅：跟着项目列表换连接，收到消息、连上时交给调度要求刷新 */
import { existsSync } from 'node:fs'
import { CollabRejected } from '../../errors.js'
import type { GiteaAccess } from '../../gitea-api/access.js'
import { ownerAndRepoOf } from '../../gitea-api/gitea.js'
import { git } from '../../git/git.js'
import { pushEventOf, pushTopicOf, type PushEvent } from './messages.js'
import { NtfySubscription, type NtfyState, type NtfyTopics } from './ntfy-subscription.js'

/**
 * 实时推送：全部项目共用一条订阅。state 是连上了、正在连、断开了等重连，off 是没在订（列表是空的，或者没能开始，原因在 error）；
 * error 也写有项目没订上的原因
 */
export type PushStatus = { state: NtfyState['state'] | 'off'; url: string | null; topics: string[]; error: string | null }

export type ProjectTopicsSubscriptionDeps = {
  log: { info(message: string): void; warn(message: string): void }
  gitea: Pick<GiteaAccess, 'pushUrl'>
  /** 此刻项目列表里的协作仓根 */
  projects(): string[]
  /** 要求刷新一个项目：认得出的消息按消息做，认不出的与连上时做完整刷新 */
  request(repo: string, work: 'full' | PushEvent): void
}

/** 一个项目订哪个 topic：协作仓 origin 的主人就是组织 */
async function pushTopicOfProject(repo: string): Promise<string> {
  if (!existsSync(repo)) throw new CollabRejected(`${repo} 不存在`)
  return pushTopicOf(ownerAndRepoOf(await git(repo, ['remote', 'get-url', 'origin'])).owner)
}

export class ProjectTopicsSubscription {
  private subscription: NtfySubscription | null = null
  /** 订阅没能开始、或有项目没订上的原因，窗格照原话显示 */
  private pushError: string | null = null
  private topicOfRepo = new Map<string, string>()
  /** 加载时、每次完整刷新之后、移出项目之后各核对一次订阅；一次一次排着做，免得两次同时换连接 */
  private syncing: Promise<void> = Promise.resolve()

  constructor(private readonly deps: ProjectTopicsSubscriptionDeps) {}

  stop(): void {
    this.subscription?.stop()
    this.subscription = null
  }

  status(): PushStatus {
    const subscription = this.subscription
    if (subscription === null) return { state: 'off', url: null, topics: [], error: this.pushError }
    const state = subscription.stateOf()
    return { state: state.state, url: subscription.topics.url, topics: subscription.topics.topics, error: state.error ?? this.pushError }
  }

  sync(): Promise<void> {
    const sync = () => this.syncNow()
    this.syncing = this.syncing.then(sync, sync)
    return this.syncing
  }

  /**
   * 列表里全部项目的 topic 和 gwb-gitea 里的推送地址合成一条订阅：和正在连的一样就不动，不一样就换一条。
   * 读不出组织的项目不订、写进 pushError，别的照常订
   */
  private async syncNow(): Promise<void> {
    try {
      const topics = new Map<string, string>()
      const problems: string[] = []
      for (const repo of this.deps.projects()) {
        try {
          topics.set(repo, await pushTopicOfProject(repo))
        } catch (error) {
          if (!(error instanceof CollabRejected)) throw error
          problems.push(`${repo} 没订上：${error.message}`)
        }
      }
      const wanted = topics.size === 0 ? null : { url: await this.deps.gitea.pushUrl(), topics: [...new Set(topics.values())].sort() }
      this.topicOfRepo = topics
      this.pushError = problems.length === 0 ? null : problems.join('\n')
      const running = this.subscription?.topics
      if (running !== undefined && wanted !== null && running.url === wanted.url && running.topics.join(',') === wanted.topics.join(',')) return
      this.stop()
      if (wanted !== null) this.subscribe(wanted)
    } catch (error) {
      if (!(error instanceof CollabRejected)) throw error
      this.stop()
      this.pushError = error.message
      this.deps.log.warn(`实时推送没能开始：${error.message}`)
    }
  }

  private subscribe(topics: NtfyTopics): void {
    let lastLogged = ''
    const started = new NtfySubscription(topics, {
      fetch: globalThis.fetch,
      onMessage: (message) => {
        const event = pushEventOf(message)
        if (event === null) this.deps.log.warn(`认不出推来的消息（${message.topic}：${JSON.stringify(message.title)} ${JSON.stringify(message.message)}），对这个组织的项目做一次完整刷新`)
        for (const [repo, each] of this.topicOfRepo) if (each === message.topic) this.deps.request(repo, event ?? 'full')
      },
      // 连上就完整刷新全部项目一次：工作台没开、断线期间的事靠它补上；连不上 NAS 时 Gitea 也连不上，这时刷新也取不到东西
      onOpened: () => {
        for (const repo of this.topicOfRepo.keys()) this.deps.request(repo, 'full')
      },
      onState: (state) => {
        const line = state.state === 'connected' ? `实时推送已连上 ${topics.url}/${topics.topics.join(',')}` : state.state === 'waiting' ? `实时推送断开，稍后重连：${state.error}` : ''
        if (line === '' || line === lastLogged) return
        lastLogged = line
        this.deps.log.info(line)
      },
      sleep: (milliseconds, signal) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, milliseconds)
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(signal.reason)
          })
        }),
    })
    this.subscription = started
    void started.start()
  }
}
