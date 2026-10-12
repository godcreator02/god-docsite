import path from 'node:path'
import type { SiteFeed } from '@godcreator/collab-model/notification-model'
import { describe, expect, it, vi } from 'vitest'
import { CollabRejected } from '../../src/errors.js'
import type { Project } from '../../src/project/project.js'
import { CollabSites, type DocsiteHosting } from '../../src/site-process/collab-sites.js'

const repo = path.resolve('/projects/hybrid-mmc/collab')
const siteDir = path.join(repo, 'site')
const project: Project = { repo, collabDir: path.join(repo, 'collab'), siteDir, person: 'bob' }
const feed: SiteFeed = { notifications: [], projectLeads: ['admin'] }

/** 假的 gwb-docsite：记下每次调用，状态照给定的回 */
function fakeDocsite(status: { url: string | null; running: boolean; error: string | null } = { url: null, running: false, error: null }, expectedUrl: string | null = 'http://127.0.0.1:4331') {
  const calls: string[] = []
  const pushed: unknown[] = []
  const docsite: DocsiteHosting = {
    keep: async (dir) => void calls.push(`keep ${dir}`),
    forget: async (dir) => void calls.push(`forget ${dir}`),
    open: async (dir) => {
      calls.push(`open ${dir}`)
      return { url: 'http://127.0.0.1:4331', pid: 1, alreadyRunning: false }
    },
    stop: async (dir) => {
      calls.push(`stop ${dir}`)
      return { url: 'http://127.0.0.1:4331' }
    },
    status: (dir) => ({ dir, kept: true, expectedUrl, ...status }),
    whileStopped: async (dir, work) => {
      calls.push(`whileStopped ${dir}`)
      return { result: await work(), relaunched: true }
    },
    push: (dir, channel, data) => {
      calls.push(`push ${dir} ${channel}`)
      pushed.push(data)
    },
    init: async (dir, options) => {
      calls.push(`init ${dir} ${JSON.stringify(options)}`)
      return { created: false, features: Object.keys(options.features ?? {}) }
    },
  }
  return { docsite, calls, pushed }
}

function sitesWith(docsite: DocsiteHosting, check: () => Promise<void> = async () => {}) {
  const warned: string[] = []
  const sites = new CollabSites({ docsite, checkSite: check, feedOf: async () => feed, log: { warn: (message) => void warned.push(message) } })
  return { sites, warned }
}

const failing = (message: string) => async () => {
  throw new CollabRejected(message)
}

describe('项目站点交给 gwb-docsite 托管', () => {
  it('常驻：查过就托管 site/，再把通知与项目负责人推到频道 collab', async () => {
    const { docsite, calls, pushed } = fakeDocsite()
    await sitesWith(docsite).sites.keep(repo)
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
    expect(calls).toEqual([`keep ${siteDir}`, `push ${siteDir} collab`])
  })

  it('检查不过：不托管，原因记下给窗格，地址是 gwb-docsite 预期的那个；gwb-docsite 自己报的原因排在后面', async () => {
    const { docsite, calls } = fakeDocsite({ url: null, running: false, error: 'gwb-docsite 的原因' })
    const { sites, warned } = sitesWith(docsite, failing('站点协议号对不上'))
    await sites.keep(repo)
    expect(calls).toEqual([])
    expect(sites.stateOf(repo)).toEqual({ url: 'http://127.0.0.1:4331', running: false, error: '站点协议号对不上' })
    expect(warned).toEqual([`${repo} 的站点没有交给 gwb-docsite 托管：站点协议号对不上`])
  })

  it('collab.site.start：检查不过就拒绝，原话照出；通过了交给 gwb-docsite 打开', async () => {
    const { docsite, calls } = fakeDocsite()
    await expect(sitesWith(docsite, failing('站点检查不过')).sites.start(project)).rejects.toThrow('站点检查不过')
    expect(calls).toEqual([])
    expect(await sitesWith(docsite).sites.start(project)).toEqual({ url: 'http://127.0.0.1:4331', pid: 1, alreadyRunning: false })
    expect(calls[0]).toBe(`open ${siteDir}`)
  })

  it('自动同步改了 site/ 之后再查：不过就不再托管，通过了再托管', async () => {
    const { docsite, calls } = fakeDocsite()
    let passes = false
    const { sites } = sitesWith(docsite, async () => {
      if (!passes) throw new CollabRejected('日志页的文件名不对')
    })
    await sites.recheck(project)
    expect(calls).toEqual([`forget ${siteDir}`])
    passes = true
    await sites.recheck(project)
    expect(calls.slice(1, 2)).toEqual([`keep ${siteDir}`])
    expect(sites.stateOf(repo).error).toBeNull()
  })

  it('装依赖：交给 gwb-docsite 先停再启动，work 拿到之前在不在运行；装完协议号不对了就不再托管', async () => {
    const { docsite, calls } = fakeDocsite({ url: 'http://127.0.0.1:4331/', running: true, error: null })
    const { sites } = sitesWith(docsite, failing('站点协议号对不上'))
    expect(sites.stateOf(repo)).toEqual({ url: 'http://127.0.0.1:4331/', running: true, error: null })
    expect(await sites.whileStopped(project, async (wasRunning) => wasRunning)).toEqual({ result: true, relaunched: false })
    expect(calls).toEqual([`whileStopped ${siteDir}`, `forget ${siteDir}`])
  })

  it('collab.site.init：交给 gwb-docsite 初始化，功能包写成给的范围；项目在列表里就再查一遍、托管，不在就不托管', async () => {
    const { docsite, calls } = fakeDocsite()
    const { sites } = sitesWith(docsite)
    expect(await sites.init(repo, { featureRange: '^0.30.2', port: 4400, title: '新项目', listed: false })).toEqual({ created: false, features: ['@godcreator/collab-site'] })
    expect(calls).toEqual([`init ${siteDir} {"features":{"@godcreator/collab-site":"^0.30.2"},"port":4400,"title":"新项目"}`])
    await sites.init(repo, { featureRange: '^0.30.2', listed: true })
    expect(calls.slice(1, 3)).toEqual([`init ${siteDir} {"features":{"@godcreator/collab-site":"^0.30.2"}}`, `keep ${siteDir}`])
  })

  it('插件卸载：交给过 gwb-docsite 的项目都撤掉', async () => {
    const { docsite, calls } = fakeDocsite()
    const { sites } = sitesWith(docsite)
    await sites.keep(repo)
    await sites.forgetAll()
    expect(calls.filter((call) => call.startsWith('forget'))).toEqual([`forget ${siteDir}`])
  })
})
