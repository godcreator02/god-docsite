import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyOtherRepoEvent, applyRepoEvent, refreshOtherRepos, type OtherReposHandlers, type OtherReposSteps } from '../../src/other-repos/events.js'
import type { RemoteProject } from '../../src/project/project.js'
import { localOrganization } from '../fixtures/local-organization.js'

vi.setConfig({ testTimeout: 30_000 })

let bob: RemoteProject

beforeEach(async () => {
  const organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' }, firmware: { 'main.c': '\n' } })
  bob = await organization.bob()
})

/** 各步记下步名与调了哪个处理函数；failing 里的步名照调用方那样吞下出错、回 null */
function stepsWith(options: { failing?: Set<string>; cloned?: string[] } = {}) {
  const calls: string[] = []
  const logged: string[] = []
  const handlers: OtherReposHandlers = {
    startWatching: () => void calls.push('startWatching'),
    cloneMissing: async () => {
      calls.push('cloneMissing')
      return options.cloned ?? []
    },
    fetch: async (_project, name) => void calls.push(`fetch ${name}`),
    review: async (_project, name) => void calls.push(`review ${name}`),
    checkRules: async (_project, name) => void calls.push(`checkRules ${name}`),
    retainOnly: (_repo, names) => void calls.push(`retainOnly ${names.join(',')}`),
    forget: () => void calls.push('forget'),
  }
  const steps: OtherReposSteps = {
    handlers,
    runStep: async (name, work) => {
      calls.push(name)
      if (options.failing?.has(name)) return null
      return work()
    },
    log: { info: (message) => void logged.push(message) },
  }
  return { steps, calls, logged }
}

describe('完整刷新时别的仓这边', () => {
  it('先补克隆、再列目录，每个仓取回、读、核对，最后只留还在的', async () => {
    const { steps, calls, logged } = stepsWith({ cloned: ['hil'] })
    await refreshOtherRepos(bob, steps)
    expect(calls.slice(0, 3)).toEqual(['other-repos:clone', 'cloneMissing', 'other-repos:list'])
    expect(calls.at(-1)).toBe('retainOnly datasheets,firmware')
    for (const name of ['datasheets', 'firmware']) {
      const ofThisRepo = calls.filter((each) => each.endsWith(name) && !each.startsWith('retainOnly'))
      expect(ofThisRepo).toEqual([`other-repos:fetch:${name}`, `fetch ${name}`, `other-repos:review:${name}`, `review ${name}`, `other-repos:rules:${name}`, `checkRules ${name}`])
    }
    expect(logged).toEqual([`${bob.repo}：克隆了组织里新加的仓 hil`])
  })

  it('列不出目录：别的都不做，也不 retainOnly', async () => {
    const { steps, calls } = stepsWith({ failing: new Set(['other-repos:list']) })
    await refreshOtherRepos(bob, steps)
    expect(calls).toEqual(['other-repos:clone', 'cloneMissing', 'other-repos:list'])
  })
})

describe('收到别的仓与组织里建删仓的消息', () => {
  it('有新提交只取回；合并请求、issue、评论重读；负责人换了重读再核对；仓名大小写不论', async () => {
    const push = stepsWith()
    await applyOtherRepoEvent(bob, { kind: 'push', repo: 'Firmware' }, push.steps)
    expect(push.calls).toEqual(['other-repos:list', 'other-repos:fetch:firmware', 'fetch firmware'])
    const comment = stepsWith()
    await applyOtherRepoEvent(bob, { kind: 'comment', repo: 'datasheets' }, comment.steps)
    expect(comment.calls).toEqual(['other-repos:list', 'other-repos:review:datasheets', 'review datasheets'])
    const leads = stepsWith()
    await applyOtherRepoEvent(bob, { kind: 'leads', repo: 'firmware' }, leads.steps)
    expect(leads.calls).toEqual(['other-repos:list', 'other-repos:review:firmware', 'review firmware', 'other-repos:rules:firmware', 'checkRules firmware'])
  })

  it('项目文件夹里没有这个仓只记一行；列不出目录时连这一行也不记', async () => {
    const missing = stepsWith()
    await applyOtherRepoEvent(bob, { kind: 'push', repo: 'unknown' }, missing.steps)
    expect(missing.calls).toEqual(['other-repos:list'])
    expect(missing.logged).toEqual([`${bob.repo}：收到 unknown 的消息，项目文件夹里没有这个仓，不处理`])
    const unlisted = stepsWith({ failing: new Set(['other-repos:list']) })
    await applyOtherRepoEvent(bob, { kind: 'push', repo: 'firmware' }, unlisted.steps)
    expect(unlisted.logged).toEqual([])
  })

  it('组织里建了仓：补克隆，克隆下来的接着取回、读、核对；别的动作只记一行', async () => {
    const created = stepsWith({ cloned: ['hil'] })
    await applyRepoEvent(bob, { repo: 'hil', action: 'created' }, created.steps)
    expect(created.calls).toEqual(['other-repos:clone', 'cloneMissing', 'other-repos:fetch:hil', 'fetch hil', 'other-repos:review:hil', 'review hil', 'other-repos:rules:hil', 'checkRules hil'])
    const deleted = stepsWith()
    await applyRepoEvent(bob, { repo: 'old-notes', action: 'deleted' }, deleted.steps)
    expect(deleted.calls).toEqual([])
    expect(deleted.logged).toEqual([`${bob.repo}：组织里的仓 old-notes deleted，本机的目录不动`])
  })
})
