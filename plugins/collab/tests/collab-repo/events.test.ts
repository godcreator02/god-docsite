import { describe, expect, it } from 'vitest'
import { applyCollabRepoEvent, refreshCollabRepo, type CollabRepoHandlers, type CollabRepoSteps } from '../../src/collab-repo/events.js'
import type { RemoteProject } from '../../src/project/project.js'

const project = { repo: 'D:/projects/hybrid-mmc/collab' } as RemoteProject

/** 各步记下步名与调了哪个处理函数；failing 里的步名照它抛错，runStep 照调用方那样吞下出错、回 null */
function stepsWith(failing: Set<string> = new Set()) {
  const calls: string[] = []
  const handlers: CollabRepoHandlers = {
    startWatching: () => void calls.push('startWatching'),
    fetch: async () => void calls.push('fetch'),
    autoSync: async () => void calls.push('autoSync'),
    readLeads: async () => void calls.push('readLeads'),
    checkRules: async () => void calls.push('checkRules'),
    forget: () => void calls.push('forget'),
  }
  const steps: CollabRepoSteps = {
    handlers,
    runStep: async (name, work) => {
      calls.push(name)
      if (failing.has(name)) return null
      return work()
    },
  }
  return { steps, calls }
}

describe('完整刷新时协作仓这边', () => {
  it('依次取回、读负责人、核对规矩、自动同步，步名一步一个', async () => {
    const { steps, calls } = stepsWith()
    await refreshCollabRepo(project, steps)
    expect(calls).toEqual(['collab-repo:fetch', 'fetch', 'collab-repo:leads', 'readLeads', 'collab-repo:rules', 'checkRules', 'collab-repo:sync', 'autoSync'])
  })

  it('取回失败也照样自动同步', async () => {
    const { steps, calls } = stepsWith(new Set(['collab-repo:fetch']))
    await refreshCollabRepo(project, steps)
    expect(calls).toEqual(['collab-repo:fetch', 'collab-repo:leads', 'readLeads', 'collab-repo:rules', 'checkRules', 'collab-repo:sync', 'autoSync'])
  })
})

describe('收到协作仓的消息', () => {
  it('有新提交：取回、自动同步；负责人换了：重读负责人、核对规矩', async () => {
    const push = stepsWith()
    await applyCollabRepoEvent(project, { kind: 'push' }, push.steps)
    expect(push.calls).toEqual(['collab-repo:fetch', 'fetch', 'collab-repo:sync', 'autoSync'])
    const leads = stepsWith()
    await applyCollabRepoEvent(project, { kind: 'leads' }, leads.steps)
    expect(leads.calls).toEqual(['collab-repo:leads', 'readLeads', 'collab-repo:rules', 'checkRules'])
  })

  it('合并请求、issue、评论不处理', async () => {
    const { steps, calls } = stepsWith()
    for (const kind of ['pr', 'issue', 'comment'] as const) await applyCollabRepoEvent(project, { kind }, steps)
    expect(calls).toEqual([])
  })
})
