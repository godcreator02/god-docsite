import { existsSync } from 'node:fs'
import path from 'node:path'
import type { DevServer, LaunchDevServer } from './dev-server.js'
import { DocsiteRejected, messageOf } from './errors.js'
import { checkDevScript, checkPlatformInstalled, checkSiteIdentity } from './site-contract.js'

/** 站点的三种状态：running 进程在；stopped 没有进程；failed 进程退出了或没能启动（error 记原因） */
export type SiteState = 'running' | 'stopped' | 'failed'

/** 一个站此刻的样子：url 只在 running 时有，是开发服务报出的实际地址；error 只在 failed 时有 */
export type SiteStatus = { dir: string; state: SiteState; url: string | null; error: string | null }

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
  /** 这一次运行从什么时候开始：运行够久才退出的不算连续崩溃 */
  runningSince: number
  /** 连着崩溃了几次：运行够久、或人手动 start / stop 后清零 */
  consecutiveCrashes: number
  /** 等着自动重启的计时器 */
  restartTimer: ReturnType<typeof setTimeout> | null
  /** 上一次运行的地址：取消等着的重启时 stop 回它 */
  lastUrl: string | null
}

/** 崩溃后自动重启的规矩：第 k 次连续崩溃后等 delaysMs[k-1] 再启动，次数用完就停在 failed；一次运行超过 stableAfterMs 才退出的重新计数 */
export type CrashRestartPolicy = { delaysMs: readonly number[]; stableAfterMs: number }

export const defaultCrashRestartPolicy: CrashRestartPolicy = { delaysMs: [2_000, 10_000, 60_000], stableAfterMs: 5 * 60_000 }

/** 每个站上次用的端口：下次启动先试它，被占了才让站点重新随机挑；书签与开着的页面在重启后还能用 */
export type SitePortMemory = {
  /** 上次的端口空着就回它（被占了先等一会儿再判断），没记过或一直被占着回 null */
  preferredPortOf(dir: string): Promise<number | null>
  remember(dir: string, port: number): Promise<void>
}

export type SiteHostOptions = {
  log: { info: (message: string) => void; warn: (message: string) => void }
  launchDevServer: LaunchDevServer
  /** 本 home 的身份码，启动时交给开发服务 */
  identityCode: () => string
  ports: SitePortMemory
  /** 不给就用 defaultCrashRestartPolicy */
  crashRestart?: CrashRestartPolicy
}

/** 启动前的核对：是站点目录、有身份文件、装着平台包、dev 脚本没写死端口；不过就抛出原因 */
function checkSiteBeforeLaunch(dir: string): void {
  if (!existsSync(path.join(dir, 'package.json'))) throw new DocsiteRejected(`${dir} 下没有 package.json，不是站点目录`)
  checkSiteIdentity(dir)
  checkPlatformInstalled(dir)
  checkDevScript(dir)
}

/**
 * 托管着的站点开发服务，按站点目录记。start / stop 幂等：已在运行就回现状，重复的 start 复用正在启动的那一次。
 * 进程自己退出了（不是 stop 停的）标 failed、记下原因，照 CrashRestartPolicy 过一会儿自动重启，连续崩溃次数用完就不再重启；
 * 人手动 start / stop 取消等着的重启、重新计数。开发服务是 gwb 的子进程，插件卸载时全部停掉
 */
export class SiteHost {
  private readonly sites = new Map<string, HostedSite>()
  private readonly statusListeners = new Set<(dir: string) => void>()
  private readonly crashRestart: CrashRestartPolicy
  private disposed = false

  constructor(private readonly options: SiteHostOptions) {
    this.crashRestart = options.crashRestart ?? defaultCrashRestartPolicy
  }

  private siteOf(dir: string): HostedSite {
    const key = siteKeyOf(dir)
    let site = this.sites.get(key)
    if (site === undefined) {
      site = { dir: path.resolve(dir), running: null, error: null, starting: null, runningSince: 0, consecutiveCrashes: 0, restartTimer: null, lastUrl: null }
      this.sites.set(key, site)
    }
    return site
  }

  private cancelRestart(site: HostedSite): boolean {
    if (site.restartTimer === null) return false
    clearTimeout(site.restartTimer)
    site.restartTimer = null
    return true
  }

  /** 进程自己退出了、或自动重启那一次没起来：还有次数就排一次重启，原因后面写上几秒后第几次重启；次数用完写明不再重启 */
  private afterCrash(site: HostedSite, reason: string) {
    site.consecutiveCrashes += 1
    const delayMs = this.crashRestart.delaysMs[site.consecutiveCrashes - 1]
    if (delayMs === undefined || this.disposed) {
      site.error = `${reason}\n（连续崩溃 ${site.consecutiveCrashes} 次，不再自动重启：查明原因后用 docsite.site.start 启动）`
      this.options.log.warn(`${site.dir} 的开发服务连续崩溃 ${site.consecutiveCrashes} 次，不再自动重启`)
    } else {
      site.error = `${reason}\n（${Math.round(delayMs / 1000)} 秒后自动重启，第 ${site.consecutiveCrashes} 次）`
      site.restartTimer = setTimeout(() => {
        site.restartTimer = null
        this.launchOnce(site).catch((error: unknown) => this.options.log.warn(`${site.dir} 自动重启没起来：${messageOf(error)}`))
      }, delayMs)
    }
    this.changed(site)
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
    return { dir: site?.dir ?? path.resolve(dir), state, url: running?.url ?? null, error: site?.error ?? null }
  }

  list(): SiteStatus[] {
    return [...this.sites.values()].map((site) => this.statusOf(site.dir))
  }

  /**
   * 启动站点的开发服务：先核对站点建在平台包上、目录有效、dev 脚本没写死端口，起不来就把原因记成 failed。已在运行或正在启动就复用，不重复 spawn。
   * 人手动启动：取消等着的自动重启、连续崩溃重新计数
   */
  start(dir: string): Promise<SiteStarted> {
    const site = this.siteOf(dir)
    this.cancelRestart(site)
    site.consecutiveCrashes = 0
    return this.launchOnce(site)
  }

  private launchOnce(site: HostedSite): Promise<SiteStarted> {
    if (site.running !== null) return Promise.resolve({ url: site.running.url, pid: site.running.pid, alreadyRunning: true })
    if (site.starting !== null) return site.starting
    const isAutomaticRestart = site.consecutiveCrashes > 0
    const starting = this.launch(site)
      .catch((error: unknown) => {
        if (isAutomaticRestart && !this.disposed) this.afterCrash(site, messageOf(error))
        throw error
      })
      .finally(() => {
        if (site.starting === starting) site.starting = null
      })
    site.starting = starting
    return starting
  }

  private async launch(site: HostedSite): Promise<SiteStarted> {
    if (this.disposed) throw new DocsiteRejected('插件正在卸载，没有启动站点')
    try {
      checkSiteBeforeLaunch(site.dir)
    } catch (error) {
      site.error = messageOf(error)
      this.changed(site)
      throw error
    }
    site.error = null
    let server: DevServer
    try {
      server = await this.options.launchDevServer(site.dir, this.options.identityCode(), await this.options.ports.preferredPortOf(site.dir))
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
    site.runningSince = Date.now()
    site.lastUrl = server.url
    server.onExit((reason) => {
      // stop 先把 running 拿掉了：人为停止不算失败
      if (site.running !== server) return
      site.running = null
      this.options.log.warn(`${site.dir} 的开发服务退出了：${reason}`)
      if (Date.now() - site.runningSince >= this.crashRestart.stableAfterMs) site.consecutiveCrashes = 0
      this.afterCrash(site, reason)
    })
    this.options.log.info(`${site.dir} 的开发服务已启动：${server.url}`)
    // 记端口只为下次沿用：记不下来照样运行，下次重新随机挑
    await this.options.ports.remember(site.dir, Number(new URL(server.url).port)).catch((error: unknown) => this.options.log.warn(`${site.dir} 这次的端口没记下来，下次启动会重新挑：${messageOf(error)}`))
    this.changed(site)
    return { url: server.url, pid: server.pid, alreadyRunning: false }
  }

  /** 停掉站点的开发服务，等着的自动重启一并取消；没在运行、也没有等着的重启就报错。正在启动的先等它落到三态再判断 */
  async stop(dir: string): Promise<{ url: string }> {
    const site = this.siteOf(dir)
    const restartCancelled = this.cancelRestart(site)
    site.consecutiveCrashes = 0
    if (site.starting !== null) await site.starting.catch(() => undefined)
    const server = site.running
    if (server === null && restartCancelled && site.lastUrl !== null) {
      site.error = null
      this.options.log.info(`${site.dir} 等着的自动重启已取消`)
      this.changed(site)
      return { url: site.lastUrl }
    }
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

  /** 工作台退出：同步停掉全部，返回时整棵进程树都已停掉 */
  stopAllNow(): void {
    this.disposed = true
    for (const site of this.sites.values()) {
      this.cancelRestart(site)
      const server = site.running
      if (server === null) continue
      site.running = null
      server.stopNow()
    }
  }

  /** 插件卸载：全部停掉 */
  async stopAll(): Promise<void> {
    this.disposed = true
    await Promise.all(
      [...this.sites.values()].map(async (site) => {
        this.cancelRestart(site)
        const server = site.running
        if (server === null) return
        site.running = null
        await server.stop()
      }),
    )
  }
}
