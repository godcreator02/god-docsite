import { existsSync } from 'node:fs'
import path from 'node:path'
import { expectedSiteUrlOf, type DevServer, type LaunchDevServer } from './dev-server.js'
import { DocsiteRejected, messageOf } from './errors.js'
import { checkPlatformInstalled } from './site-contract.js'

/** 站点的三种状态：running 进程在；stopped 没有进程；failed 进程退出了或没能启动（error 记原因） */
export type SiteState = 'running' | 'stopped' | 'failed'

/**
 * 一个站此刻的样子：url 在 running 时是实际地址；expectedUrl 是按 package.json 的 scripts.dev 里的 --port
 * 预期的地址（没写端口为 null），没运行时给人看站点在哪；error 只在 failed 时有
 */
export type SiteStatus = { dir: string; state: SiteState; url: string | null; expectedUrl: string | null; error: string | null }

export type SiteStarted = { url: string; pid: number; alreadyRunning: boolean }

/** 站点目录的比较键：大小写与斜杠不同的写法算同一个 */
export function siteKeyOf(dir: string): string {
  return path.resolve(dir).toLowerCase()
}

type HostedSite = {
  dir: string
  running: DevServer | null
  /** 上一次没能运行的原因：进程退出记退出码与最后几行输出，启动失败记拒绝的原因 */
  error: string | null
  /** 正在启动的这一次：并发的 start 复用它，不重复 spawn */
  starting: Promise<SiteStarted> | null
}

export type SiteHostOptions = {
  log: { info: (message: string) => void; warn: (message: string) => void }
  launchDevServer: LaunchDevServer
  /** 本 home 的身份码，启动时交给开发服务 */
  identityCode: () => string
}

/**
 * 托管着的站点开发服务，按站点目录记。start / stop 幂等：已在运行就回现状，重复的 start 复用正在启动的那一次；
 * 进程退出了只标 failed、记下原因，不自动重启。开发服务是 gwb 的子进程，插件卸载时全部停掉
 */
export class SiteHost {
  private readonly sites = new Map<string, HostedSite>()
  private readonly statusListeners = new Set<(dir: string) => void>()
  private disposed = false

  constructor(private readonly options: SiteHostOptions) {}

  private siteOf(dir: string): HostedSite {
    const key = siteKeyOf(dir)
    let site = this.sites.get(key)
    if (site === undefined) {
      site = { dir: path.resolve(dir), running: null, error: null, starting: null }
      this.sites.set(key, site)
    }
    return site
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
    const running = site?.running ?? null
    const state: SiteState = running !== null ? 'running' : site?.error != null ? 'failed' : 'stopped'
    return { dir: site?.dir ?? path.resolve(dir), state, url: running?.url ?? null, expectedUrl: expectedSiteUrlOf(dir), error: site?.error ?? null }
  }

  list(): SiteStatus[] {
    return [...this.sites.values()].map((site) => this.statusOf(site.dir))
  }

  /** 启动站点的开发服务：先核对站点建在平台包上、目录有效，起不来就把原因记成 failed。已在运行或正在启动就复用，不重复 spawn */
  start(dir: string): Promise<SiteStarted> {
    const site = this.siteOf(dir)
    if (site.running !== null) return Promise.resolve({ url: site.running.url, pid: site.running.pid, alreadyRunning: true })
    if (site.starting !== null) return site.starting
    const starting = this.launch(site).finally(() => {
      if (site.starting === starting) site.starting = null
    })
    site.starting = starting
    return starting
  }

  private async launch(site: HostedSite): Promise<SiteStarted> {
    if (this.disposed) throw new DocsiteRejected('插件正在卸载，没有启动站点')
    if (!existsSync(path.join(site.dir, 'package.json'))) throw new DocsiteRejected(`${site.dir} 下没有 package.json，不是站点目录`)
    checkPlatformInstalled(site.dir)
    site.error = null
    let server: DevServer
    try {
      server = await this.options.launchDevServer(site.dir, this.options.identityCode())
    } catch (error) {
      site.error = messageOf(error)
      this.changed(site)
      throw error
    }
    if (this.disposed || this.sites.get(siteKeyOf(site.dir)) !== site) {
      await server.stop()
      throw new DocsiteRejected('插件正在卸载，没有启动站点')
    }
    site.running = server
    site.error = null
    server.onExit((reason) => {
      // stop 先把 running 拿掉了：人为停止不算失败
      if (site.running !== server) return
      site.running = null
      site.error = reason
      this.options.log.warn(`${site.dir} 的开发服务退出了：${reason}`)
      this.changed(site)
    })
    this.options.log.info(`${site.dir} 的开发服务已启动：${server.url}`)
    this.changed(site)
    return { url: server.url, pid: server.pid, alreadyRunning: false }
  }

  /** 停掉站点的开发服务；没在运行就报错。正在启动的先等它落到三态再判断 */
  async stop(dir: string): Promise<{ url: string }> {
    const site = this.siteOf(dir)
    if (site.starting !== null) await site.starting.catch(() => undefined)
    const server = site.running
    if (server === null) throw new DocsiteRejected(`${dir} 的站点没在运行`)
    site.running = null
    site.error = null
    await server.stop()
    this.options.log.info(`${site.dir} 的开发服务已停止`)
    this.changed(site)
    return { url: server.url }
  }

  /** 往站点的推送通道推一份数据；站点没在运行就报错 */
  async push(dir: string, channel: string, data: unknown): Promise<void> {
    const server = this.sites.get(siteKeyOf(dir))?.running ?? null
    if (server === null) throw new DocsiteRejected(`${dir} 的站点没在运行：先 docsite.site.start`)
    await server.push(channel, data)
  }

  /** 插件卸载：全部停掉 */
  async stopAll(): Promise<void> {
    this.disposed = true
    await Promise.all(
      [...this.sites.values()].map(async (site) => {
        const server = site.running
        if (server === null) return
        site.running = null
        await server.stop()
      }),
    )
  }
}
