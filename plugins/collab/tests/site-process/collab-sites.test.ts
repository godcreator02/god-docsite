import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { renderMergeWorkflow, type SiteFeed } from '@godcreator/collab'
import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../../src/project/project.js'
import { CollabSites, type DocsiteHosting } from '../../src/site-process/collab-sites.js'

const repo = path.resolve('/projects/hybrid-mmc/collab')
const siteDir = path.join(repo, 'site')
const project: Project = { repo, collabDir: path.join(repo, 'collab'), siteDir, person: 'bob' }
const feed: SiteFeed = { notifications: [], aiPrompt: null, projectLeads: ['admin'] }
/** collab.site.init 交给 sites.init 的那份工作流：打包时带进来的模板写成本插件的版本 */
const mergeWorkflow = renderMergeWorkflow(__COLLAB_MERGE_WORKFLOW_TEMPLATE__, __COLLAB_VERSION__)
/** collab.site.init 交给 sites.init 的项目首页：打包时带进来的 templates/home.tsx */
const homePage = __COLLAB_HOME_TEMPLATE__
/** 平台模板建站时写的首页 */
const platformHomePage = 'export default function Home() {}\n'

/**
 * 假的 gwb-docsite：记下每次调用；add、start 转成运行，remove、stop 转成停止，转换时通知 onStatus 的监听者。
 * 初始状态照给定的；failed 时 error 是固定的原因
 */
function fakeDocsite(initial: 'running' | 'stopped' | 'failed' = 'stopped', url: string | null = null) {
  const calls: string[] = []
  const pushed: unknown[] = []
  const listeners = new Set<(dir: string) => void>()
  let state = initial
  const become = (dir: string, next: typeof state) => {
    state = next
    for (const listener of listeners) listener(dir)
  }
  const docsite: DocsiteHosting = {
    add: async (dir) => {
      calls.push(`add ${dir}`)
      if (state !== 'running') become(dir, 'running')
      return docsite.status(dir)
    },
    remove: async (dir) => {
      calls.push(`remove ${dir}`)
      if (state === 'running') become(dir, 'stopped')
      return { registered: true }
    },
    start: async (dir) => {
      calls.push(`start ${dir}`)
      become(dir, 'running')
      return { url: 'http://127.0.0.1:4331', pid: 1, alreadyRunning: false }
    },
    stop: async (dir) => {
      calls.push(`stop ${dir}`)
      become(dir, 'stopped')
      return { url: 'http://127.0.0.1:4331' }
    },
    status: (dir) => ({ dir, state, url, error: state === 'failed' ? 'gwb-docsite 的原因' : null }),
    onStatus: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    push: async (dir, channel, data) => {
      calls.push(`push ${dir} ${channel}`)
      pushed.push(data)
    },
    init: async (dir, options) => {
      calls.push(`init ${dir} ${JSON.stringify(options)}`)
      mkdirSync(path.join(dir, 'app', 'routes'), { recursive: true })
      writeFileSync(path.join(dir, 'app', 'routes', 'home.tsx'), platformHomePage)
      writeFileSync(path.join(dir, 'package.json'), '{}')
      return { dir, platformDependencies: { '@godcreator/god-docsite': '^0.1.0' } }
    },
    addFeature: async (dir, options) => {
      calls.push(`addFeature ${dir} ${options.packageName}@${options.specifier}`)
      return { feature: 'collab', specifier: options.specifier!, addedFiles: ['routes.ts'], keptFiles: [], features: ['collab'] }
    },
  }
  return { docsite, calls, pushed }
}

function sitesWith(docsite: DocsiteHosting, listed: string[] = [repo]) {
  const warned: string[] = []
  const sites = new CollabSites({ docsite, feedOf: async () => feed, listedProjects: () => listed, log: { warn: (message) => void warned.push(message) } })
  return { sites, warned }
}

/** 建一个带 site/package.json 的临时协作仓，跑完删掉 */
async function withBuiltSite(run: (builtRepo: string, builtSiteDir: string) => Promise<void>): Promise<void> {
  const builtRepo = mkdtempSync(path.join(tmpdir(), 'collab-site-host-'))
  const builtSiteDir = path.join(builtRepo, 'site')
  mkdirSync(builtSiteDir)
  writeFileSync(path.join(builtSiteDir, 'package.json'), '{}')
  try {
    await run(builtRepo, builtSiteDir)
  } finally {
    rmSync(builtRepo, { recursive: true, force: true })
  }
}

describe('项目站点交给 gwb-docsite', () => {
  it('交给 gwb-docsite 常驻：登记 site/，站点转成运行时把通知、提示词与项目负责人推到频道 collab', async () => {
    await withBuiltSite(async (builtRepo, builtSiteDir) => {
      const { docsite, calls, pushed } = fakeDocsite()
      const { sites } = sitesWith(docsite, [builtRepo])
      const unwatch = sites.watchStatus()
      await sites.host(builtRepo)
      await vi.waitFor(() => expect(pushed).toEqual([feed, feed]))
      expect(calls).toEqual([`add ${builtSiteDir}`, `push ${builtSiteDir} collab`, `push ${builtSiteDir} collab`])
      unwatch()
    })
  })

  it('site/ 还没建：报错、不登记', async () => {
    const { docsite, calls } = fakeDocsite()
    await expect(sitesWith(docsite).sites.host(repo)).rejects.toThrow('collab.site.init')
    expect(calls).toEqual([])
  })

  it('站点没在运行时通知变了：不推，等它启动时 onStatus 补推', async () => {
    const { docsite, calls, pushed } = fakeDocsite()
    const { sites, warned } = sitesWith(docsite)
    const unwatch = sites.watchStatus()
    sites.feedChanged(repo)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pushed).toEqual([])
    await docsite.start(siteDir)
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
    expect(calls).toEqual([`start ${siteDir}`, `push ${siteDir} collab`])
    expect(warned).toEqual([])
    unwatch()
  })

  it('不在项目列表里的站转成运行：不推', async () => {
    const { docsite, pushed } = fakeDocsite()
    const unwatch = sitesWith(docsite, []).sites.watchStatus()
    await docsite.start(siteDir)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pushed).toEqual([])
    unwatch()
  })

  it('窗格的状态：地址只在运行时有，起不来的原因照 gwb-docsite 的报', () => {
    const { docsite } = fakeDocsite('failed')
    expect(sitesWith(docsite).sites.stateOf(repo)).toEqual({ dir: siteDir, url: null, running: false, error: 'gwb-docsite 的原因' })
    const running = fakeDocsite('running', 'http://127.0.0.1:4331/')
    expect(sitesWith(running.docsite).sites.stateOf(repo)).toEqual({ dir: siteDir, url: 'http://127.0.0.1:4331/', running: true, error: null })
  })

  it('自动同步改了 site/ 之后：确保站点登记着、在运行，再推一次数据', async () => {
    await withBuiltSite(async (builtRepo, builtSiteDir) => {
      const { docsite, calls, pushed } = fakeDocsite('running', 'http://127.0.0.1:4331/')
      const builtProject: Project = { repo: builtRepo, collabDir: path.join(builtRepo, 'collab'), siteDir: builtSiteDir, person: 'bob' }
      await sitesWith(docsite, [builtRepo]).sites.recheck(builtProject)
      await vi.waitFor(() => expect(pushed).toEqual([feed]))
      expect(calls).toEqual([`add ${builtSiteDir}`, `push ${builtSiteDir} collab`])
    })
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

  it('装依赖时站点已被别处启动（start 回 alreadyRunning）：relaunched 为 false', async () => {
    const { docsite } = fakeDocsite('stopped')
    const startedElsewhere: DocsiteHosting = { ...docsite, start: async () => ({ url: 'http://127.0.0.1:4331', pid: 2, alreadyRunning: true }) }
    expect(await sitesWith(startedElsewhere).sites.whileStopped(project, async () => 'installed')).toEqual({ result: 'installed', relaunched: false })
  })

  it('装完依赖重新启动：推送由 onStatus 做，只推一次', async () => {
    const { docsite, pushed } = fakeDocsite('running', 'http://127.0.0.1:4331/')
    const { sites } = sitesWith(docsite)
    const unwatch = sites.watchStatus()
    await sites.whileStopped(project, async () => 'installed')
    await vi.waitFor(() => expect(pushed).toEqual([feed]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pushed).toEqual([feed])
    unwatch()
  })

  it('collab.site.init：交给 gwb-docsite 建基础站、再加协作功能（写成给的范围）；项目在列表里就交给它常驻，不在就不登记', async () => {
    const newRepo = mkdtempSync(path.join(tmpdir(), 'collab-site-init-'))
    const newSiteDir = path.join(newRepo, 'site')
    try {
      const { docsite, calls } = fakeDocsite()
      const { sites } = sitesWith(docsite)
      expect(await sites.init(newRepo, { featureRange: '^0.31.0', mergeWorkflow, title: '新项目', homePage, listed: false })).toEqual({
        dir: newSiteDir,
        platformDependencies: { '@godcreator/god-docsite': '^0.1.0' },
        feature: { feature: 'collab', specifier: '^0.31.0', addedFiles: ['routes.ts'], keptFiles: [], features: ['collab'] },
        mergeWorkflow: { path: '.gitea/workflows/collab-auto-merge.yaml', written: true },
        homePage: 'site/app/routes/home.tsx',
      })
      expect(calls).toEqual([`init ${newSiteDir} {"title":"新项目"}`, `addFeature ${newSiteDir} @godcreator/collab@^0.31.0`])
      await sites.init(newRepo, { featureRange: '^0.31.0', mergeWorkflow, title: '新项目', homePage, listed: true })
      expect(calls.slice(2, 5)).toEqual([`init ${newSiteDir} {"title":"新项目"}`, `addFeature ${newSiteDir} @godcreator/collab@^0.31.0`, `add ${newSiteDir}`])
    } finally {
      rmSync(newRepo, { recursive: true, force: true })
    }
  })

  it('collab.site.init：仓里没有自动合并工作流就写进 .gitea/workflows/，已有的不覆盖', async () => {
    const newRepo = mkdtempSync(path.join(tmpdir(), 'collab-site-init-'))
    const workflowFile = path.join(newRepo, '.gitea', 'workflows', 'collab-auto-merge.yaml')
    try {
      const { docsite } = fakeDocsite()
      const { sites } = sitesWith(docsite)
      const first = await sites.init(newRepo, { featureRange: '^0.31.0', mergeWorkflow, title: '新项目', homePage, listed: false })
      expect(first.mergeWorkflow).toEqual({ path: '.gitea/workflows/collab-auto-merge.yaml', written: true })
      expect(readFileSync(workflowFile, 'utf8')).toBe(mergeWorkflow)
      writeFileSync(workflowFile, "env:\n  MERGE_CHECK_RANGE: '^0.29.0'\n")
      const second = await sites.init(newRepo, { featureRange: '^0.31.0', mergeWorkflow, title: '新项目', homePage, listed: false })
      expect(second.mergeWorkflow).toEqual({ path: '.gitea/workflows/collab-auto-merge.yaml', written: false })
      expect(readFileSync(workflowFile, 'utf8')).toBe("env:\n  MERGE_CHECK_RANGE: '^0.29.0'\n")
    } finally {
      rmSync(newRepo, { recursive: true, force: true })
    }
  })

  it('collab.site.init：加完协作功能后，平台模板的首页换成协作功能的项目首页', async () => {
    const newRepo = mkdtempSync(path.join(tmpdir(), 'collab-site-init-'))
    const homeFile = path.join(newRepo, 'site', 'app', 'routes', 'home.tsx')
    try {
      const { docsite } = fakeDocsite()
      const homeWhenAdding: string[] = []
      const checking: DocsiteHosting = {
        ...docsite,
        addFeature: async (dir, options) => {
          homeWhenAdding.push(readFileSync(homeFile, 'utf8'))
          return docsite.addFeature(dir, options)
        },
      }
      await sitesWith(checking).sites.init(newRepo, { featureRange: '^0.31.0', mergeWorkflow, title: '新项目', homePage, listed: false })
      expect(homeWhenAdding).toEqual([platformHomePage])
      expect(readFileSync(homeFile, 'utf8')).toBe(homePage)
      expect(homePage).toContain('ProjectHome')
    } finally {
      rmSync(newRepo, { recursive: true, force: true })
    }
  })

  it('打包时带进来的工作流模板写成本插件那一版的范围', () => {
    expect(mergeWorkflow).toContain("MERGE_CHECK_RANGE: '^0.0.0-test'")
    expect(mergeWorkflow).not.toContain('{{version}}')
  })

  it('collab.site.init：加协作功能（gwb-docsite 会起服务）之前，仓根的 collab/ 与站点的 journal/ 已经建好', async () => {
    const newRepo = mkdtempSync(path.join(tmpdir(), 'collab-site-init-'))
    try {
      const { docsite } = fakeDocsite()
      const existedWhenAdding: boolean[] = []
      const checking: DocsiteHosting = {
        ...docsite,
        addFeature: async (dir, options) => {
          existedWhenAdding.push(existsSync(path.join(newRepo, 'collab')), existsSync(path.join(dir, 'journal')))
          return docsite.addFeature(dir, options)
        },
      }
      await sitesWith(checking).sites.init(newRepo, { featureRange: '^0.31.0', mergeWorkflow, title: '新项目', homePage, listed: false })
      expect(existedWhenAdding).toEqual([true, true])
    } finally {
      rmSync(newRepo, { recursive: true, force: true })
    }
  })

  it('项目移出列表：撤销 gwb-docsite 的登记（它停掉在运行的站点）', async () => {
    const { docsite, calls } = fakeDocsite('running', 'http://127.0.0.1:4331/')
    await sitesWith(docsite).sites.unhost(repo)
    expect(calls).toEqual([`remove ${siteDir}`])
    expect(docsite.status(siteDir).state).toBe('stopped')
  })
})
