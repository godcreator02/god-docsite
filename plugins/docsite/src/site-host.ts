import { existsSync } from 'node:fs'
import path from 'node:path'
import type { DevServer, LaunchDevServer } from './dev-server.js'
import { DocsiteRejected, messageOf } from './errors.js'

/** 这么长时间里失败到这么多次就不再自动重启 */
const failureWindowMilliseconds = 5 * 60_000
const failuresBeforeGivingUp = 3

/** 一个站此刻的样子：url 在运行时是实际地址；error 是常驻失败停下、启动前就失败的原因 */
export type SiteStatus = { dir: string; url: string | null; running: boolean; kept: boolean; error: string | null }

export type SiteStarted = { url: string; pid: number; alreadyRunning: boolean }

/** 站点目录的比较键：大小写与斜杠不同的写法算同一个 */
export function siteKeyOf(dir: string): string {
  return path.resolve(dir).toLowerCase()
}

type HostedSite = {
  dir: string
  running: DevServer | null
  /** keep 过：要常驻的 */
  kept: boolean
  /** 人为停的：这次加载期间不自动启动，直到 start */
  stoppedByPerson: boolean
  /** 短时间内失败到上限，不再自动重启 */
  gaveUp: boolean
  failureTimes: number[]
  error: string | null
  /** 每个频道最新的一份：站点没在运行时也记着，启动后补推 */
  feeds: Map<string, unknown>
  /** 推送排队一个一个交，每次交的都是交的那一刻最新的；pushError 是上一次没交上的原因，同样的原因只报一次 */
  pushQueue: Promise<void>
  pushError: string | null
}

export type SiteHostOptions = {
  log: { info: (message: string) => void; warn: (message: string) => void }
  launchDevServer: LaunchDevServer
  /** 本 home 的身份码，启动时交给开发服务 */
  identityCode: () => string
  /** 启动前查一遍站点（人员列表、评论文件）；有问题就返回全部问题，生产里是基础包的 siteProblems */
  siteProblems: (dir: string) => Promise<string[]>
  now: () => number
  /** 意外退出或启动失败后隔多久再启动 */
  restartDelayMilliseconds: number
}

/**
 * 托管着的站点开发服务，按站点目录记。常驻的意外退出就重启，5 分钟内失败 3 次就停下；同一个站的启动、停止、装依赖排队一个一个做。
 * 开发服务是 gwb 的子进程，插件卸载时全部停掉。启动时交给开发服务身份码与推送口令，推来的数据按频道记着、启动后补推
 */
export class SiteHost {
  private readonly sites = new Map<string, HostedSite>()
  private readonly queues = new Map<string, Promise<void>>()
  private readonly restartTimers = new Set<ReturnType<typeof setTimeout>>()
  private readonly statusListeners = new Set<(dir: string) => void>()
  private disposed = false

  constructor(private readonly options: SiteHostOptions) {}

  private siteOf(dir: string): HostedSite {
    const key = siteKeyOf(dir)
    let site = this.sites.get(key)
    if (site === undefined) {
      site = { dir: path.resolve(dir), running: null, kept: false, stoppedByPerson: false, gaveUp: false, failureTimes: [], error: null, feeds: new Map(), pushQueue: Promise.resolve(), pushError: null }
      this.sites.set(key, site)
    }
    return site
  }

  private serially<T>(dir: string, operation: () => Promise<T>): Promise<T> {
    const key = siteKeyOf(dir)
    const result = (this.queues.get(key) ?? Promise.resolve()).then(operation)
    this.queues.set(
      key,
      result.then(
        () => undefined,
        () => undefined,
      ),
    )
    return result
  }

  onStatus(listener: (dir: string) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private changed(site: HostedSite) {
    for (const listener of this.statusListeners) listener(site.dir)
  }

  statusOf(dir: string): SiteStatus {
    const site = this.sites.get(siteKeyOf(dir))
    return { dir: site?.dir ?? path.resolve(dir), url: site?.running?.url ?? null, running: site?.running != null, kept: site?.kept ?? false, error: site?.error ?? null }
  }

  list(): SiteStatus[] {
    return [...this.sites.values()].map((site) => this.statusOf(site.dir))
  }

  /** 常驻：人为停的、连续失败停下的不启动，已经在运行的不动；启动前就失败的记下原因、不重试 */
  keep(dir: string): Promise<void> {
    return this.serially(dir, async () => {
      const site = this.siteOf(dir)
      site.kept = true
      await this.startKept(site)
    })
  }

  private async startKept(site: HostedSite): Promise<void> {
    if (this.disposed || site.running !== null || site.stoppedByPerson || site.gaveUp) return
    try {
      await this.checkBeforeLaunch(site.dir)
    } catch (error) {
      site.error = messageOf(error)
      this.options.log.warn(`${site.dir} 的站点没有启动：${site.error}`)
      this.changed(site)
      return
    }
    try {
      await this.launch(site)
    } catch (error) {
      this.recordFailure(site, messageOf(error))
    }
  }

  /** 启动前就知道起不来的：不是站点目录、没装依赖、站点检查不过。重试也不会好，不计入失败次数 */
  private async checkBeforeLaunch(dir: string): Promise<void> {
    if (!existsSync(path.join(dir, 'package.json'))) throw new DocsiteRejected(`${dir} 下没有 package.json，不是站点目录`)
    if (!existsSync(path.join(dir, 'node_modules'))) throw new DocsiteRejected(`${dir} 还没有装依赖：在站点目录里运行 pnpm install`)
    const problems = await this.options.siteProblems(dir)
    if (problems.length > 0) throw new DocsiteRejected(`站点检查不过，照原话改好再启动：\n${problems.join('\n')}`)
  }

  private async launch(site: HostedSite): Promise<void> {
    const server = await this.options.launchDevServer(site.dir, this.options.identityCode())
    if (this.disposed || this.sites.get(siteKeyOf(site.dir)) !== site) {
      await server.stop()
      return
    }
    site.running = server
    site.error = null
    for (const channel of site.feeds.keys()) this.pushLatest(site, channel)
    server.onExit((reason) => {
      if (site.running !== server) return
      site.running = null
      this.options.log.warn(`${site.dir} 的开发服务意外退出：${reason}`)
      this.recordFailure(site, reason)
    })
    this.options.log.info(`${site.dir} 的开发服务已启动：${server.url}`)
    this.changed(site)
  }

  /** 失败记一次：没到上限就过一会儿再启动，到了上限就停下、记下最后一次的原因 */
  private recordFailure(site: HostedSite, reason: string): void {
    const now = this.options.now()
    site.failureTimes = [...site.failureTimes.filter((time) => now - time < failureWindowMilliseconds), now]
    site.error = reason
    if (site.failureTimes.length >= failuresBeforeGivingUp) {
      site.gaveUp = true
      site.error = `开发服务 ${failureWindowMilliseconds / 60_000} 分钟内失败了 ${failuresBeforeGivingUp} 次，不再自动重启（用 docsite.site.start 再启动）。最后一次的原因：${reason}`
      this.options.log.warn(`${site.dir} 的站点不再自动重启：${reason}`)
      this.changed(site)
      return
    }
    this.changed(site)
    const timer = setTimeout(() => {
      this.restartTimers.delete(timer)
      void this.serially(site.dir, async () => {
        if (this.sites.get(siteKeyOf(site.dir)) === site) await this.startKept(site)
      })
    }, this.options.restartDelayMilliseconds)
    this.restartTimers.add(timer)
  }

  /** 推一份数据：记成这个频道最新的一份，站点在运行就交过去 */
  push(dir: string, channel: string, data: unknown): void {
    const site = this.siteOf(dir)
    site.feeds.set(channel, data)
    this.pushLatest(site, channel)
  }

  /** 排队交，轮到时才读最新的一份，接连变化时后交的一定是新的；交不上报出来，同样的原因不重复报 */
  private pushLatest(site: HostedSite, channel: string): void {
    site.pushQueue = site.pushQueue.then(async () => {
      const server = site.running
      if (server === null) return
      try {
        await server.push(channel, site.feeds.get(channel))
        site.pushError = null
      } catch (error) {
        const message = messageOf(error)
        if (message !== site.pushError) this.options.log.warn(`${site.dir} 的推送 ${channel} 没能交给站点：${message}`)
        site.pushError = message
      }
    })
  }

  /** 人为启动：人为停止与连续失败的记录一并清掉，没在运行就启动；启动不了抛 DocsiteRejected */
  start(dir: string): Promise<SiteStarted> {
    return this.serially(dir, async () => {
      const site = this.siteOf(dir)
      site.stoppedByPerson = false
      site.gaveUp = false
      site.failureTimes = []
      const alreadyRunning = site.running !== null
      if (!alreadyRunning) {
        try {
          await this.checkBeforeLaunch(site.dir)
          await this.launch(site)
        } catch (error) {
          site.error = messageOf(error)
          this.changed(site)
          throw error
        }
      }
      if (site.running === null) throw new DocsiteRejected('插件正在卸载，没有启动站点')
      return { url: site.running.url, pid: site.running.pid, alreadyRunning }
    })
  }

  /** 人为停止：这次加载期间不自动启动，直到 start */
  stop(dir: string): Promise<{ url: string }> {
    return this.serially(dir, async () => {
      const site = this.sites.get(siteKeyOf(dir))
      const server = site?.running ?? null
      if (site === undefined || server === null) throw new DocsiteRejected(`${dir} 的站点没在运行`)
      site.running = null
      site.stoppedByPerson = true
      await server.stop()
      this.options.log.info(`${site.dir} 的开发服务已停止`)
      this.changed(site)
      return { url: server.url }
    })
  }

  /**
   * 先停（不算意外退出）、做完 work 再按常驻的规矩启动——停之前在运行、或是常驻的，且不是人为停的。
   * work 失败时站点保持停着，错误原样抛出。装依赖、换站点文件时用
   */
  whileStopped<T>(dir: string, work: () => Promise<T>): Promise<{ result: T; relaunched: boolean }> {
    return this.serially(dir, async () => {
      const site = this.siteOf(dir)
      const server = site.running
      if (server !== null) {
        site.running = null
        await server.stop()
        this.changed(site)
      }
      const result = await work()
      if (this.disposed || site.stoppedByPerson || (server === null && !site.kept)) return { result, relaunched: false }
      site.gaveUp = false
      site.failureTimes = []
      site.error = null
      await this.startKept(site)
      return { result, relaunched: site.running !== null }
    })
  }

  /** 不再托管：停掉、忘掉它的记录与推送 */
  forget(dir: string): Promise<void> {
    return this.serially(dir, async () => {
      const key = siteKeyOf(dir)
      const site = this.sites.get(key)
      this.sites.delete(key)
      if (site === undefined) return
      if (site.running !== null) await site.running.stop()
      this.changed(site)
    })
  }

  /** 插件卸载：全部停掉，排着的重启不再做 */
  async stopAll(): Promise<void> {
    this.disposed = true
    for (const timer of this.restartTimers) clearTimeout(timer)
    this.restartTimers.clear()
    await Promise.all(
      [...this.sites.values()].map((site) =>
        this.serially(site.dir, async () => {
          const server = site.running
          if (server === null) return
          site.running = null
          await server.stop()
        }),
      ),
    )
  }
}
