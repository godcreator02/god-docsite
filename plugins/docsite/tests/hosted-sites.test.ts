import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { addedByCommand, HostedSites, hostedSitesDocKey, type HostedSite } from '../src/hosted-sites.js'
import type { SiteStatus } from '../src/site-host.js'

const siteDir = path.resolve('/projects/demo/site')

/** 假的 gwb-data 与假的 SiteHost：记下启停，start 可以让它失败 */
function hostedWith(options: { doc?: unknown; startFails?: string } = {}) {
  const docs = new Map<string, unknown>(options.doc === undefined ? [] : [[hostedSitesDocKey, options.doc]])
  const running = new Set<string>()
  const calls: string[] = []
  const status = (dir: string): SiteStatus => ({ dir, state: running.has(path.resolve(dir).toLowerCase()) ? 'running' : 'stopped', url: null, error: null })
  const hosted = new HostedSites(
    {
      readDoc: async (doc) => docs.get(doc),
      writeDoc: async (doc, value) => {
        docs.set(doc, value)
      },
    },
    {
      start: async (dir) => {
        calls.push(`start ${dir}`)
        if (options.startFails !== undefined) throw new Error(options.startFails)
        running.add(path.resolve(dir).toLowerCase())
        return { url: 'http://127.0.0.1:4000', pid: 1, alreadyRunning: false }
      },
      stop: async (dir) => {
        calls.push(`stop ${dir}`)
        running.delete(path.resolve(dir).toLowerCase())
        return { url: 'http://127.0.0.1:4000' }
      },
      statusOf: status,
    },
  )
  return { hosted, doc: () => docs.get(hostedSitesDocKey) as HostedSite[] | undefined, calls }
}

describe('gwb-data 的 hosted-sites 是常驻站点唯一的表', () => {
  it('add 登记（记下谁登记的）再启动；大小写不同的写法算同一个，不重复登记', async () => {
    const { hosted, doc, calls } = hostedWith({ doc: [] })
    expect((await hosted.add(siteDir, addedByCommand)).state).toBe('running')
    await hosted.add(siteDir.toUpperCase(), addedByCommand)
    expect(doc()).toEqual([{ dir: siteDir, by: addedByCommand }])
    expect(calls).toEqual([`start ${siteDir}`, `start ${siteDir.toUpperCase()}`])
  })

  it('还没有这份文档：一个站也没登记', async () => {
    const { hosted } = hostedWith()
    expect(await hosted.list()).toEqual([])
  })

  it('已登记的站换了登记的一方：改过来，不重复登记', async () => {
    const { hosted, doc } = hostedWith({ doc: [{ dir: siteDir, by: addedByCommand }] })
    await hosted.add(siteDir, 'gwb-collab')
    expect(doc()).toEqual([{ dir: siteDir, by: 'gwb-collab' }])
  })

  it('add 启动不了照样报错，登记留着，下次加载再启动', async () => {
    const { hosted, doc } = hostedWith({ doc: [], startFails: '没装依赖' })
    await expect(hosted.add(siteDir, addedByCommand)).rejects.toThrow('没装依赖')
    expect(doc()).toEqual([{ dir: siteDir, by: addedByCommand }])
  })

  it('remove 去掉登记并停掉在运行的站', async () => {
    const { hosted, doc, calls } = hostedWith({ doc: [] })
    await hosted.add(siteDir, addedByCommand)
    expect(await hosted.remove(siteDir)).toEqual({ registered: true })
    expect(doc()).toEqual([])
    expect(calls).toContain(`stop ${siteDir}`)
  })

  it('remove 没登记过的：registered 为 false，没在运行就不停', async () => {
    const { hosted, calls } = hostedWith({ doc: [] })
    expect(await hosted.remove(siteDir)).toEqual({ registered: false })
    expect(calls).toEqual([])
  })

  it('startAll 逐个启动登记着的站，起不来的报一行', async () => {
    const warnings: string[] = []
    const { hosted, calls } = hostedWith({ doc: [{ dir: siteDir, by: addedByCommand }], startFails: '端口被占' })
    hosted.startAll((message) => warnings.push(message))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual([`start ${siteDir}`])
    expect(warnings).toEqual([`${siteDir} 的站点没有启动：端口被占`])
  })

  it('表的形状不对：startAll 报一行、一个也不启动，登记与列表照样报错', async () => {
    const warnings: string[] = []
    const { hosted, calls } = hostedWith({ doc: [siteDir] })
    hosted.startAll((message) => warnings.push(message))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual([])
    expect(warnings[0]).toContain('读不出托管的站点，一个也没有启动')
    await expect(hosted.list()).rejects.toThrow(`gwb-data 的 ${hostedSitesDocKey} 要是 [{ dir, by }]`)
  })
})
