import path from 'node:path'
import type { SiteFeed } from '@godcreator/collab'
import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../../src/project/project.js'
import { CollabSites, type DocsiteHosting } from '../../src/site-process/collab-sites.js'

const repo = path.resolve('/projects/hybrid-mmc/collab')
const siteDir = path.join(repo, 'site')
const project: Project = { repo, collabDir: path.join(repo, 'collab'), siteDir, person: 'bob' }
const feed: SiteFeed = { notifications: [], projectLeads: ['admin'] }

/** 假的 gwb-docsite：记下每次调用，状态照给定的回 */
function fakeDocsite(state: 'running' | 'stopped' | 'failed' = 'stopped', url: string | null = null, expectedUrl: string | null = 'http://127.0.0.1:4331') {
  const calls: string[] = []
  const pushed: unknown[] = []
  const docsite: DocsiteHosting = {
    start: async (dir) => {
      calls.push(`start ${dir}`)
      return { url: 'http://127.0.0.1:4331', pid: 1, alreadyRunning: false }
    },
    stop: async (dir) => {
      calls.push(`stop ${dir}`)
      return { url: 'http://127.0.0.1:4331' }
    },
    status: (dir) => ({ dir, state, url, expectedUrl, error: state === 'failed' ? 'gwb-docsite 的原因' : null }),
    push: async (dir, channel, data) => {
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

function sitesWith(docsite: DocsiteHosting) {
  const warned: string[] = []
  const sites = new CollabSites({ docsite, feedOf: async () => feed, log: { warn: (message) => void warned.push(message) } })
  return { sites, warned }
}

describe('项目站点交给 gwb-docsite', () => {
  it('确保在运行：启动 site/（幂等），再把通知与项目负责人推到频道 collab', async () => {
    const { docsite, calls, pushed } = fakeDocsite()
    await sitesWith(docsite).sites.keep(repo)
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
    expect(calls).toEqual([`start ${siteDir}`, `push ${siteDir} collab`])
  })

  it('窗格的状态：地址在运行时是实际地址，没运行时是 gwb-docsite 预期的那个，起不来的原因照 gwb-docsite 的报', () => {
    const { docsite } = fakeDocsite('failed')
    expect(sitesWith(docsite).sites.stateOf(repo)).toEqual({ url: 'http://127.0.0.1:4331', running: false, error: 'gwb-docsite 的原因' })
    const running = fakeDocsite('running', 'http://127.0.0.1:4331/')
    expect(sitesWith(running.docsite).sites.stateOf(repo)).toEqual({ url: 'http://127.0.0.1:4331/', running: true, error: null })
  })

  it('collab.site.start：交给 gwb-docsite 启动，回地址与进程号', async () => {
    const { docsite, calls, pushed } = fakeDocsite()
    expect(await sitesWith(docsite).sites.start(project)).toEqual({ url: 'http://127.0.0.1:4331', pid: 1, alreadyRunning: false })
    expect(calls[0]).toBe(`start ${siteDir}`)
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
  })

  it('collab.site.stop：交给 gwb-docsite 停掉', async () => {
    const { docsite, calls } = fakeDocsite()
    await sitesWith(docsite).sites.stop(repo)
    expect(calls).toEqual([`stop ${siteDir}`])
  })

  it('自动同步改了 site/ 之后：确保站点在运行，再推一次数据', async () => {
    const { docsite, calls, pushed } = fakeDocsite()
    await sitesWith(docsite).sites.recheck(project)
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
    expect(calls).toEqual([`start ${siteDir}`, `push ${siteDir} collab`])
  })

  it('装依赖：先停（本来就没运行就不停），做完 work 再启动；work 拿到之前在不在运行', async () => {
    const { docsite, calls } = fakeDocsite('running', 'http://127.0.0.1:4331/')
    expect(await sitesWith(docsite).sites.whileStopped(project, async (wasRunning) => wasRunning)).toEqual({ result: true, relaunched: true })
    expect(calls[0]).toBe(`stop ${siteDir}`)
    expect(calls.some((call) => call === `start ${siteDir}`)).toBe(true)
    const stopped = fakeDocsite('stopped')
    const before: boolean[] = []
    await sitesWith(stopped.docsite).sites.whileStopped(project, async (wasRunning) => void before.push(wasRunning))
    expect(before).toEqual([false])
    expect(stopped.calls).not.toContain(`stop ${siteDir}`)
  })

  it('装依赖时站点已被别处启动（start 回 alreadyRunning）：relaunched 为 false，照样推一次数据', async () => {
    const { docsite, pushed } = fakeDocsite('stopped')
    const startedElsewhere: DocsiteHosting = { ...docsite, start: async () => ({ url: 'http://127.0.0.1:4331', pid: 2, alreadyRunning: true }) }
    expect(await sitesWith(startedElsewhere).sites.whileStopped(project, async () => 'installed')).toEqual({ result: 'installed', relaunched: false })
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
  })

  it('自动同步改了 site/ 之后站点已在运行：不停、不重启，只把最新数据推过去', async () => {
    const { docsite, calls, pushed } = fakeDocsite('running', 'http://127.0.0.1:4331/')
    const running: DocsiteHosting = {
      ...docsite,
      start: async (dir) => {
        calls.push(`start ${dir}`)
        return { url: 'http://127.0.0.1:4331/', pid: 1, alreadyRunning: true }
      },
    }
    await sitesWith(running).sites.recheck(project)
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
    expect(calls).toEqual([`start ${siteDir}`, `push ${siteDir} collab`])
  })

  it('collab.site.init：交给 gwb-docsite 从零建站，功能包写成给的范围；项目在列表里就启动并推数据，不在就不启动', async () => {
    const { docsite, calls } = fakeDocsite()
    const { sites } = sitesWith(docsite)
    expect(await sites.init(repo, { featureRange: '^0.31.0', port: 4400, title: '新项目', listed: false })).toEqual({ created: false, features: ['@godcreator/collab'] })
    expect(calls).toEqual([`init ${siteDir} {"features":{"@godcreator/collab":"^0.31.0"},"port":4400,"title":"新项目"}`])
    await sites.init(repo, { featureRange: '^0.31.0', port: 4400, title: '新项目', listed: true })
    expect(calls.slice(1, 3)).toEqual([`init ${siteDir} {"features":{"@godcreator/collab":"^0.31.0"},"port":4400,"title":"新项目"}`, `start ${siteDir}`])
  })

  it('项目移出列表：停掉在运行的站点，排着的推送不再发；插件卸载：启动过的都停掉', async () => {
    const { docsite, calls } = fakeDocsite('running', 'http://127.0.0.1:4331/')
    const { sites } = sitesWith(docsite)
    await sites.keep(repo)
    await sites.forget(repo)
    expect(calls.some((call) => call === `stop ${siteDir}`)).toBe(true)
    const second = fakeDocsite('running', 'http://127.0.0.1:4331/')
    const secondSites = sitesWith(second.docsite).sites
    await secondSites.keep(repo)
    await secondSites.forgetAll()
    expect(second.calls.some((call) => call === `stop ${siteDir}`)).toBe(true)
  })
})
