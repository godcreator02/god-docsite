import fs from 'node:fs'
import path from 'node:path'
import { hostedSitesDoc, parseHostedSitesDoc, siteKeyOf, startPortOf } from './hosted-sites.js'
import type { RunningServer, SiteRunner } from './site-process.js'

/** 托管着的一个站此刻的样子，list 与各命令的回执都是它 */
export interface HostedSiteState {
  dir: string
  /** 从 start 脚本读出的端口；package.json 读不出时是 null */
  port: number | null
  status: 'running' | 'building' | 'starting' | 'stopped' | 'expired' | 'failed'
  pid: number | null
  url: string | null
  /** 到这个时刻自动停掉（ISO 时间）；只在 running 时有 */
  expiresAt: string | null
  /** 最近一次失败的原因（构建失败、启动失败、意外退出），带输出的最后几行；在运行时是 null */
  error: string | null
}

/** 登记表怎么读写：生产里是工作台数据插件的一份文档 */
export interface HostedSitesStore {
  read(): Promise<unknown>
  write(value: unknown): Promise<void>
}

/** 到期用的时钟；测试换成手动拨的 */
export interface HostClock {
  now(): number
  /** 过 ms 毫秒调 run；交回取消函数 */
  schedule(ms: number, run: () => void): () => void
}

export const realClock: HostClock = {
  now: () => Date.now(),
  schedule: (ms, run) => {
    const timer = setTimeout(run, ms)
    return () => clearTimeout(timer)
  },
}

/** 每次启动开着这么久，到点自动停；restart 重新计时 */
export const HOSTED_SITE_LIFETIME_MS = 12 * 60 * 60_000

export class SiteHostRejected extends Error {}

interface Site {
  dir: string
  port: number | null
  status: HostedSiteState['status']
  server: RunningServer | null
  expiresAt: number | null
  cancelExpiry: (() => void) | null
  error: string | null
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * 工作台托管的文档站：登记过的站在插件加载时启动，跟哪个会话都无关，每次启动开 12 小时、到点自动停；
 * 重新构建由 restart 做（停掉 → pnpm build → 启动），同时重新计时。同一个站的动作排队一个一个做。
 * 意外退出只记下原因，不自动重启：next start 不会自己退出，退出了多半是端口或构建出了问题，重启也起不来
 */
export class SiteHost {
  private readonly sites = new Map<string, Site>()
  private readonly queues = new Map<string, Promise<unknown>>()
  private disposed = false

  constructor(
    private readonly runner: SiteRunner,
    private readonly store: HostedSitesStore,
    private readonly log: { info: (message: string) => void; warn: (message: string) => void },
    private readonly clock: HostClock = realClock,
  ) {}

  private serially<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const result = (this.queues.get(key) ?? Promise.resolve()).then(operation)
    this.queues.set(key, result.catch(() => undefined))
    return result
  }

  private stateOf(site: Site): HostedSiteState {
    const running = site.status === 'running' && site.server !== null
    return {
      dir: site.dir,
      port: site.port,
      status: site.status,
      pid: running ? site.server!.pid : null,
      url: running && site.port !== null ? `http://127.0.0.1:${String(site.port)}` : null,
      expiresAt: running && site.expiresAt !== null ? new Date(site.expiresAt).toISOString() : null,
      error: site.error,
    }
  }

  private registered(dir: string): Site {
    const site = this.sites.get(siteKeyOf(dir))
    if (site === undefined) throw new SiteHostRejected(`${dir} 没有托管；先用 docfirst.site.add 登记`)
    return site
  }

  private async persist(): Promise<void> {
    await this.store.write(hostedSitesDoc([...this.sites.values()].map((site) => site.dir)))
  }

  /**
   * 插件加载时调：读进登记表就返回，各站在自己的队列里启动，list 不用等它们起来；
   * 一个起不来不影响别的，原因记在它的 error 里
   */
  async startAll(): Promise<void> {
    for (const dir of parseHostedSitesDoc(await this.store.read())) {
      this.sites.set(siteKeyOf(dir), { dir, port: null, status: 'starting', server: null, expiresAt: null, cancelExpiry: null, error: null })
    }
    for (const [key, site] of this.sites) void this.serially(key, () => this.startRecording(site, { buildIfMissing: false }))
  }

  list(): HostedSiteState[] {
    return [...this.sites.values()].map((site) => this.stateOf(site))
  }

  /** 登记并启动；已经登记过就只回它此刻的样子。没构建过的先 build */
  async add(dir: string): Promise<HostedSiteState & { added: boolean }> {
    const key = siteKeyOf(dir)
    return this.serially(key, async () => {
      const existing = this.sites.get(key)
      if (existing !== undefined) return { ...this.stateOf(existing), added: false }
      const site: Site = { dir: path.resolve(dir), port: this.readPort(dir), status: 'stopped', server: null, expiresAt: null, cancelExpiry: null, error: null }
      this.sites.set(key, site)
      await this.persist()
      await this.startRecording(site, { buildIfMissing: true })
      return { ...this.stateOf(site), added: true }
    })
  }

  /** 停掉并从登记表里去掉 */
  async remove(dir: string): Promise<{ dir: string; removed: true }> {
    const site = this.registered(dir)
    const key = siteKeyOf(dir)
    return this.serially(key, async () => {
      await this.stopServer(site)
      this.sites.delete(key)
      await this.persist()
      return { dir: site.dir, removed: true as const }
    })
  }

  /** 停掉 → build（默认做）→ 启动。构建或启动失败时站保持停着，原因写进回执的 error */
  async restart(dir: string, options: { build: boolean }): Promise<HostedSiteState & { built: boolean }> {
    const site = this.registered(dir)
    return this.serially(siteKeyOf(dir), async () => {
      await this.stopServer(site)
      site.error = null
      if (options.build) {
        try {
          site.status = 'building'
          await this.runner.build(site.dir)
        } catch (error) {
          site.status = 'failed'
          site.error = messageOf(error)
          return { ...this.stateOf(site), built: false }
        }
      }
      await this.startRecording(site, { buildIfMissing: false })
      return { ...this.stateOf(site), built: options.build }
    })
  }

  /** 插件卸载：全部停掉，等进程树退出，免得重新加载时端口还被占着 */
  async stopAll(): Promise<void> {
    this.disposed = true
    await Promise.all([...this.sites.entries()].map(([key, site]) => this.serially(key, () => this.stopServer(site))))
  }

  private readPort(dir: string): number {
    const manifestFile = path.join(dir, 'package.json')
    let manifest: unknown
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    } catch (error) {
      throw new SiteHostRejected(`读不出 ${manifestFile}：${messageOf(error)}`)
    }
    try {
      return startPortOf(manifest, dir)
    } catch (error) {
      throw new SiteHostRejected(messageOf(error))
    }
  }

  private async stopServer(site: Site, status: 'stopped' | 'expired' = 'stopped'): Promise<void> {
    const server = site.server
    site.server = null
    site.status = status
    this.clearExpiry(site)
    if (server !== null) await server.stop()
  }

  private clearExpiry(site: Site): void {
    site.cancelExpiry?.()
    site.cancelExpiry = null
    site.expiresAt = null
  }

  /** 到点停掉，状态记成 expired；这期间被 restart 换掉的那一次不算 */
  private scheduleExpiry(site: Site, server: RunningServer): void {
    site.expiresAt = this.clock.now() + HOSTED_SITE_LIFETIME_MS
    site.cancelExpiry = this.clock.schedule(HOSTED_SITE_LIFETIME_MS, () => {
      void this.serially(siteKeyOf(site.dir), async () => {
        if (site.server !== server) return
        await this.stopServer(site, 'expired')
        this.log.info(`托管的站 ${site.dir} 开满 ${String(HOSTED_SITE_LIFETIME_MS / 3_600_000)} 小时，已停掉`)
      })
    })
  }

  /** 启动一个站，失败只记进 site.error、不抛：startAll 里一个站起不来不能挡住别的 */
  private async startRecording(site: Site, options: { buildIfMissing: boolean }): Promise<void> {
    if (this.disposed) return
    try {
      site.port = this.readPort(site.dir)
      if (await this.runner.portInUse(site.port)) {
        throw new Error(`端口 ${String(site.port)} 已经被别的进程占着（多半是会话自己开的 next start）：停掉它，再 docfirst.site.restart`)
      }
      if (!fs.existsSync(path.join(site.dir, '.next', 'BUILD_ID'))) {
        if (!options.buildIfMissing) throw new Error('还没有构建：调 docfirst.site.restart（会先 pnpm build）')
        site.status = 'building'
        await this.runner.build(site.dir)
      }
      site.status = 'starting'
      const server = await this.runner.start(site.dir, site.port)
      if (this.disposed) {
        await server.stop()
        return
      }
      site.server = server
      site.status = 'running'
      site.error = null
      this.scheduleExpiry(site, server)
      server.onUnexpectedExit((reason) => {
        if (site.server !== server) return
        site.server = null
        site.status = 'failed'
        site.error = reason
        this.clearExpiry(site)
        this.log.warn(`托管的站 ${site.dir} 意外退出：${reason}`)
      })
      this.log.info(`托管的站 ${site.dir} 已启动：http://127.0.0.1:${String(site.port)}`)
    } catch (error) {
      site.status = 'failed'
      site.error = messageOf(error)
      this.log.warn(`托管的站 ${site.dir} 没有启动：${site.error}`)
    }
  }
}
