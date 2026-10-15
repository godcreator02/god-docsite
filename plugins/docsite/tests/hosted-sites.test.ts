import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HostedSites } from '../src/hosted-sites.js'
import type { SiteStatus } from '../src/site-host.js'

const siteDir = path.resolve('/projects/demo/site')

/** 假的设置 sites 与假的 SiteHost：记下启停，start 可以让它失败 */
function hostedWith(initial: string[], options: { startFails?: string } = {}) {
  let dirs = [...initial]
  const running = new Set<string>()
  const calls: string[] = []
  const status = (dir: string): SiteStatus => ({ dir, state: running.has(path.resolve(dir).toLowerCase()) ? 'running' : 'stopped', url: null, error: null })
  const hosted = new HostedSites(
    {
      get: () => dirs,
      set: async (next) => {
        dirs = next
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
  return { hosted, dirs: () => dirs, calls }
}

describe('设置 sites 是常驻站点唯一的表', () => {
  it('add 登记再启动；大小写不同的写法算同一个，不重复登记', async () => {
    const { hosted, dirs, calls } = hostedWith([])
    expect((await hosted.add(siteDir)).state).toBe('running')
    await hosted.add(siteDir.toUpperCase())
    expect(dirs()).toEqual([siteDir])
    expect(calls).toEqual([`start ${siteDir}`, `start ${siteDir.toUpperCase()}`])
  })

  it('add 启动不了照样报错，登记留着，下次加载再启动', async () => {
    const { hosted, dirs } = hostedWith([], { startFails: '没装依赖' })
    await expect(hosted.add(siteDir)).rejects.toThrow('没装依赖')
    expect(dirs()).toEqual([siteDir])
  })

  it('remove 去掉登记并停掉在运行的站', async () => {
    const { hosted, dirs, calls } = hostedWith([])
    await hosted.add(siteDir)
    expect(await hosted.remove(siteDir)).toEqual({ registered: true })
    expect(dirs()).toEqual([])
    expect(calls).toContain(`stop ${siteDir}`)
  })

  it('remove 没登记过的：registered 为 false，没在运行就不停', async () => {
    const { hosted, calls } = hostedWith([])
    expect(await hosted.remove(siteDir)).toEqual({ registered: false })
    expect(calls).toEqual([])
  })

  it('startAll 逐个启动登记着的站，起不来的报一行', async () => {
    const warnings: string[] = []
    const { hosted, calls } = hostedWith([siteDir], { startFails: '端口被占' })
    hosted.startAll((message) => warnings.push(message))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual([`start ${siteDir}`])
    expect(warnings).toEqual([`${siteDir} 的站点没有启动：端口被占`])
  })
})
