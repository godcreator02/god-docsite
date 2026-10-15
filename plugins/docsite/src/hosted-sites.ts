import path from 'node:path'
import { messageOf } from './errors.js'
import { siteKeyOf, type SiteStarted, type SiteStatus } from './site-host.js'

export type SitesSetting = { get(): string[]; set(dirs: string[]): Promise<void> }

type Host = {
  start(dir: string): Promise<SiteStarted>
  stop(dir: string): Promise<{ url: string }>
  statusOf(dir: string): SiteStatus
}

/**
 * 常驻的站点只有一张表：设置 sites。docsite.site.add 与别的插件（gwb-collab 的项目站点）都登记在这里，
 * 工作台每次启动、插件加载时逐个启动；进程的启停交给 SiteHost
 */
export class HostedSites {
  constructor(
    private readonly setting: SitesSetting,
    private readonly host: Host,
  ) {}

  isRegistered(dir: string): boolean {
    return this.setting.get().some((each) => siteKeyOf(each) === siteKeyOf(dir))
  }

  /** 登记（已登记的不重复写）再启动；启动不了抛错，登记照留，下次加载再启动 */
  async add(dir: string): Promise<SiteStatus> {
    if (!this.isRegistered(dir)) await this.setting.set([...this.setting.get(), path.resolve(dir)])
    await this.host.start(dir)
    return this.host.statusOf(dir)
  }

  /** 去掉登记，在运行就停掉；registered 为 false 是本来就没登记 */
  async remove(dir: string): Promise<{ registered: boolean }> {
    const registered = this.isRegistered(dir)
    if (registered) await this.setting.set(this.setting.get().filter((each) => siteKeyOf(each) !== siteKeyOf(dir)))
    if (this.host.statusOf(dir).state === 'running') await this.host.stop(dir)
    return { registered }
  }

  /** 插件加载：登记着的逐个启动，不等；起不来的原因记在 SiteHost 的状态里，这里再报一行 */
  startAll(warn: (message: string) => void): void {
    for (const dir of this.setting.get()) {
      this.host.start(dir).catch((error: unknown) => warn(`${dir} 的站点没有启动：${messageOf(error)}`))
    }
  }
}
