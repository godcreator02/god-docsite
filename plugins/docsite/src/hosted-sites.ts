import path from 'node:path'
import { messageOf } from './errors.js'
import { siteKeyOf, type SiteStarted, type SiteStatus } from './site-host.js'

/** gwb-data 里登记常驻站点的那份文档：[{ dir, by }] */
export const hostedSitesDocKey = 'hosted-sites'

/** docsite.site.add 登记的站记成这个；别的插件经服务登记时报自己的名字（gwb-collab 的项目站点是 gwb-collab） */
export const addedByCommand = 'docsite.site.add'

/** 一个常驻的站：站点目录与谁登记的 */
export type HostedSite = { dir: string; by: string }

export type HostedSitesStore = {
  /** 没有这份文档回 undefined */
  readDoc(doc: string): Promise<unknown>
  writeDoc(doc: string, value: unknown): Promise<void>
}

type Host = {
  start(dir: string): Promise<SiteStarted>
  stop(dir: string): Promise<{ url: string }>
  statusOf(dir: string): SiteStatus
}

function hostedSitesOf(doc: unknown): HostedSite[] {
  const isSite = (value: unknown): value is HostedSite =>
    typeof value === 'object' && value !== null && typeof (value as HostedSite).dir === 'string' && typeof (value as HostedSite).by === 'string' && Object.keys(value).length === 2
  if (!Array.isArray(doc) || !doc.every(isSite)) throw new Error(`gwb-data 的 ${hostedSitesDocKey} 要是 [{ dir, by }]，读到 ${JSON.stringify(doc)}`)
  return doc
}

/**
 * 常驻的站点只有一张表：gwb-data 的 hosted-sites。docsite.site.add 与别的插件（gwb-collab 的项目站点）都登记在这里，
 * 工作台每次启动、插件加载时逐个启动；进程的启停交给 SiteHost。
 * 表在加载时读进内存，之后改动排队写回，几处同时登记时后写的不覆盖先写的
 */
export class HostedSites {
  private sites: HostedSite[] = []
  private readonly loaded: Promise<void>
  private writes: Promise<void> = Promise.resolve()

  constructor(
    private readonly store: HostedSitesStore,
    private readonly host: Host,
  ) {
    this.loaded = this.load()
  }

  /** 读表；还没有这份文档就是一个站也没登记 */
  private async load(): Promise<void> {
    const doc = await this.store.readDoc(hostedSitesDocKey)
    this.sites = doc === undefined ? [] : hostedSitesOf(doc)
  }

  private save(): Promise<void> {
    const snapshot = [...this.sites]
    const written = this.writes.then(() => this.store.writeDoc(hostedSitesDocKey, snapshot))
    this.writes = written.catch(() => undefined)
    return written
  }

  async list(): Promise<HostedSite[]> {
    await this.loaded
    return [...this.sites]
  }

  async isRegistered(dir: string): Promise<boolean> {
    await this.loaded
    return this.sites.some((each) => siteKeyOf(each.dir) === siteKeyOf(dir))
  }

  /** 登记（已登记的不重复写，登记的一方变了就改过来）再启动；启动不了抛错，登记照留，下次加载再启动 */
  async add(dir: string, by: string): Promise<SiteStatus> {
    await this.loaded
    const existing = this.sites.find((each) => siteKeyOf(each.dir) === siteKeyOf(dir))
    if (existing === undefined) {
      this.sites = [...this.sites, { dir: path.resolve(dir), by }]
      await this.save()
    } else if (existing.by !== by) {
      this.sites = this.sites.map((each) => (each === existing ? { ...each, by } : each))
      await this.save()
    }
    await this.host.start(dir)
    return this.host.statusOf(dir)
  }

  /** 去掉登记，在运行就停掉；registered 为 false 是本来就没登记 */
  async remove(dir: string): Promise<{ registered: boolean }> {
    const registered = await this.isRegistered(dir)
    if (registered) {
      this.sites = this.sites.filter((each) => siteKeyOf(each.dir) !== siteKeyOf(dir))
      await this.save()
    }
    if (this.host.statusOf(dir).state === 'running') await this.host.stop(dir)
    return { registered }
  }

  /** 插件加载：登记着的逐个启动，不等；表读不出、起不来的原因都报一行，起不来的原因也记在 SiteHost 的状态里 */
  startAll(warn: (message: string) => void): void {
    this.loaded.then(
      () => {
        for (const { dir } of this.sites) {
          this.host.start(dir).catch((error: unknown) => warn(`${dir} 的站点没有启动：${messageOf(error)}`))
        }
      },
      (error: unknown) => warn(`读不出托管的站点，一个也没有启动：${messageOf(error)}`),
    )
  }
}
