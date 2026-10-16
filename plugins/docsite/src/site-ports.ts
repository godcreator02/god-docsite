import { siteKeyOf, type SitePortMemory } from './site-host.js'

/** gwb-data 里记端口的那份文档：{ 站点目录的比较键: 端口 } */
export const sitePortsDocKey = 'site-ports'

export type SitePortsStore = {
  /** 没有或坏了回 undefined */
  readDoc(doc: string): Promise<unknown>
  writeDoc(doc: string, value: unknown): Promise<void>
}

function portsOf(doc: unknown): Record<string, number> {
  if (doc === undefined) return {}
  const isPortTable = typeof doc === 'object' && doc !== null && !Array.isArray(doc) && Object.values(doc).every((port) => Number.isInteger(port) && (port as number) > 0 && (port as number) < 65_536)
  if (!isPortTable) throw new Error(`gwb-data 的 ${sitePortsDocKey} 要是 { 站点目录: 端口 }，读到 ${JSON.stringify(doc)}`)
  return doc as Record<string, number>
}

/** 上次的端口被占时，再查几次、每次之间等多久；测试里换成不等的 */
export type PortReleaseWait = { retries: number; sleep: () => Promise<void> }

/**
 * 插件重新加载时内核不等旧实例停完开发服务（taskkill 整棵进程树要一两秒）就加载新实例，新实例紧接着来查端口；
 * 所以被占了先每 0.5 秒再查一次、最多 10 秒，旧进程放开端口就沿用
 */
const portReleaseWait: PortReleaseWait = { retries: 20, sleep: () => new Promise((resolve) => setTimeout(resolve, 500)) }

/** 每个站上次用的端口，存在 gwb-data 里；几个站同时启动时排队写，后写的不覆盖先写的 */
export class SitePorts implements SitePortMemory {
  private writes: Promise<void> = Promise.resolve()

  constructor(
    private readonly store: SitePortsStore,
    private readonly isPortFree: (port: number) => Promise<boolean>,
    private readonly releaseWait: PortReleaseWait = portReleaseWait,
  ) {}

  async preferredPortOf(dir: string): Promise<number | null> {
    const port = portsOf(await this.store.readDoc(sitePortsDocKey))[siteKeyOf(dir)]
    if (port === undefined) return null
    return (await this.becomesFree(port)) ? port : null
  }

  private async becomesFree(port: number): Promise<boolean> {
    if (await this.isPortFree(port)) return true
    for (let retry = 0; retry < this.releaseWait.retries; retry += 1) {
      await this.releaseWait.sleep()
      if (await this.isPortFree(port)) return true
    }
    return false
  }

  remember(dir: string, port: number): Promise<void> {
    const written = this.writes.then(async () => {
      const ports = portsOf(await this.store.readDoc(sitePortsDocKey))
      if (ports[siteKeyOf(dir)] === port) return
      await this.store.writeDoc(sitePortsDocKey, { ...ports, [siteKeyOf(dir)]: port })
    })
    this.writes = written.catch(() => undefined)
    return written
  }
}
