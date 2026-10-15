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

/** 每个站上次用的端口，存在 gwb-data 里；几个站同时启动时排队写，后写的不覆盖先写的 */
export class SitePorts implements SitePortMemory {
  private writes: Promise<void> = Promise.resolve()

  constructor(
    private readonly store: SitePortsStore,
    private readonly isPortFree: (port: number) => Promise<boolean>,
  ) {}

  async preferredPortOf(dir: string): Promise<number | null> {
    const port = portsOf(await this.store.readDoc(sitePortsDocKey))[siteKeyOf(dir)]
    return port !== undefined && (await this.isPortFree(port)) ? port : null
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
