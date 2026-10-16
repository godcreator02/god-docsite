import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SitePorts, sitePortsDocKey } from '../src/site-ports.js'

const siteDir = path.resolve('/projects/demo/site')

const retries = 3

function portsWith(initial: unknown, free: (port: number) => boolean = () => true) {
  const docs = new Map<string, unknown>(initial === undefined ? [] : [[sitePortsDocKey, initial]])
  const probes: number[] = []
  const ports = new SitePorts(
    {
      readDoc: async (doc) => docs.get(doc),
      writeDoc: async (doc, value) => void docs.set(doc, value),
    },
    async (port) => {
      probes.push(port)
      return free(port)
    },
    { retries, sleep: async () => undefined },
  )
  return { ports, docs, probes }
}

describe('每个站上次用的端口', () => {
  it('没记过回 null；记下以后按站点目录取回，大小写不同算同一个站', async () => {
    const { ports } = portsWith(undefined)
    expect(await ports.preferredPortOf(siteDir)).toBeNull()
    await ports.remember(siteDir, 23456)
    expect(await ports.preferredPortOf(siteDir.toUpperCase())).toBe(23456)
  })

  it('上次的端口一直被占着：再查满次数后回 null', async () => {
    const { ports, probes } = portsWith(undefined, () => false)
    await ports.remember(siteDir, 23456)
    expect(await ports.preferredPortOf(siteDir)).toBeNull()
    expect(probes).toEqual(Array(retries + 1).fill(23456))
  })

  it('上次的端口在等的时候空出来了（插件重新加载，旧实例的开发服务还没停完）：沿用它', async () => {
    let probeCount = 0
    const { ports } = portsWith(undefined, () => ++probeCount > 2)
    await ports.remember(siteDir, 23456)
    expect(await ports.preferredPortOf(siteDir)).toBe(23456)
    expect(probeCount).toBe(3)
  })

  it('没记过不查端口', async () => {
    const { ports, probes } = portsWith(undefined)
    expect(await ports.preferredPortOf(siteDir)).toBeNull()
    expect(probes).toEqual([])
  })

  it('几个站同时记，一个都不丢', async () => {
    const { ports, docs } = portsWith(undefined)
    await Promise.all([ports.remember(path.resolve('/a/site'), 11111), ports.remember(path.resolve('/b/site'), 22222)])
    expect(Object.values(docs.get(sitePortsDocKey) as Record<string, number>).sort()).toEqual([11111, 22222])
  })

  it('存的不是 { 站点目录: 端口 } 就报错', async () => {
    const { ports } = portsWith({ x: 'abc' })
    await expect(ports.preferredPortOf(siteDir)).rejects.toThrow(sitePortsDocKey)
  })
})
