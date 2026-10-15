import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SitePorts, sitePortsDocKey } from '../src/site-ports.js'

const siteDir = path.resolve('/projects/demo/site')

function portsWith(initial: unknown, free: (port: number) => boolean = () => true) {
  const docs = new Map<string, unknown>(initial === undefined ? [] : [[sitePortsDocKey, initial]])
  const ports = new SitePorts(
    {
      readDoc: async (doc) => docs.get(doc),
      writeDoc: async (doc, value) => void docs.set(doc, value),
    },
    async (port) => free(port),
  )
  return { ports, docs }
}

describe('每个站上次用的端口', () => {
  it('没记过回 null；记下以后按站点目录取回，大小写不同算同一个站', async () => {
    const { ports } = portsWith(undefined)
    expect(await ports.preferredPortOf(siteDir)).toBeNull()
    await ports.remember(siteDir, 23456)
    expect(await ports.preferredPortOf(siteDir.toUpperCase())).toBe(23456)
  })

  it('上次的端口被占了回 null', async () => {
    const { ports } = portsWith(undefined, () => false)
    await ports.remember(siteDir, 23456)
    expect(await ports.preferredPortOf(siteDir)).toBeNull()
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
