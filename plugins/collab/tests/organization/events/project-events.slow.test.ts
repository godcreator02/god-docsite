import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import type { PushEvent } from '../../../src/organization/events/messages.js'
import { ProjectEvents, type CollabRepoHandlers, type OtherReposHandlers, type ProjectEventsDeps } from '../../../src/organization/events/project-events.js'
import type { RemoteProject } from '../../../src/project/project.js'
import { git, localOrganization, type LocalOrganization } from '../../fixtures/local-organization.js'

vi.setConfig({ testTimeout: 30_000 })

let organization: LocalOrganization
let bob: RemoteProject

beforeEach(async () => {
  organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' }, firmware: { 'main.c': '\n' } })
  bob = await organization.bob()
})

const at = '2026-10-08T08:00:00.000Z'

/** 两边各步的假件：记下调了哪一步；failing 里的步名照它抛错。keepSite 换掉站点常驻，http 换掉 Gitea 接口 */
function eventsWith(
  options: {
    failing?: Map<string, string>
    openRemote?: () => Promise<RemoteProject>
    cloned?: string[]
    projects?: string[]
    keepSite?: (repo: string) => Promise<void>
    http?: ProjectEventsDeps['gitea']['http']
  } = {},
) {
  const calls: string[] = []
  const changed: string[] = []
  const logged: string[] = []
  const listChanges: Array<[string, 'added' | 'removed']> = []
  const failing = options.failing ?? new Map<string, string>()
  const step = (name: string) => {
    calls.push(name)
    const message = failing.get(name)
    if (message !== undefined) throw new CollabRejected(message)
  }
  const collabRepo: CollabRepoHandlers = {
    startWatching: () => step('collab:watch'),
    fetch: async () => step('collab:fetch'),
    autoSync: async () => step('collab:sync'),
    readLeads: async () => step('collab:leads'),
    checkRules: async () => step('collab:rules'),
    forget: () => step('collab:forget'),
  }
  const otherRepos: OtherReposHandlers = {
    startWatching: () => step('other:watch'),
    cloneMissing: async () => {
      step('other:clone')
      return options.cloned ?? []
    },
    fetch: async (_project, name) => step(`other:fetch ${name}`),
    review: async (_project, name) => step(`other:review ${name}`),
    checkRules: async (_project, name) => step(`other:rules ${name}`),
    retainOnly: (_repo, names) => step(`other:retain ${names.join(',')}`),
    forget: () => step('other:forget'),
  }
  const deps: ProjectEventsDeps = {
    log: { info: (message) => void logged.push(message), warn: (message) => void logged.push(message) },
    projectsSetting: { get: () => options.projects ?? [bob.repo], set: async () => {} },
    gitea: {
      http:
        options.http ??
        (async () => {
          throw new Error('这个测试不该调 Gitea 接口')
        }),
      account: async () => {
        throw new Error('这个测试不该读账号')
      },
      pushUrl: async () => 'https://ntfy.example.org',
    },
    openProject: async () => bob,
    openRemote: options.openRemote ?? (async () => bob),
    sites: { keep: options.keepSite ?? (async () => {}), forget: async () => {} },
    collabRepo,
    otherRepos,
    webhooks: { check: async () => step('organization:webhook'), forget: () => step('organization:forget') },
    onChange: (repo) => void changed.push(repo),
    onListChanged: (repo, change) => void listChanges.push([repo, change]),
    setTimeout: () => {},
    now: () => new Date(at),
  }
  return { events: new ProjectEvents(deps), calls, changed, logged, listChanges }
}

describe('完整刷新', () => {
  it('两边各刷新一次：协作仓取回、读负责人、核对规矩、自动同步；别的仓补克隆后逐个取回、读、核对，只留还在的；再核对组织 webhook', async () => {
    const { events, calls, changed } = eventsWith()
    expect(events.refreshedOnce(bob.repo)).toBe(false)
    expect(await events.refresh(bob.repo)).toEqual({ at, error: null })
    expect(calls).toEqual(expect.arrayContaining(['collab:watch', 'collab:fetch', 'collab:leads', 'collab:rules', 'collab:sync']))
    for (const name of ['datasheets', 'firmware']) expect(calls).toEqual(expect.arrayContaining(['other:watch', `other:fetch ${name}`, `other:review ${name}`, `other:rules ${name}`]))
    expect(calls).toContain('other:retain datasheets,firmware')
    expect(calls).toContain('organization:webhook')
    expect(calls.indexOf('collab:sync')).toBeGreaterThan(calls.indexOf('collab:fetch'))
    expect(events.errorsOf(bob.repo)).toEqual([])
    expect(events.refreshedOnce(bob.repo)).toBe(true)
    expect(changed).toEqual([bob.repo])
    events.stop()
  })

  it('一步出错不影响别的步：出错的原话一步一条记下、报变化；那一步下次做成了就清掉', async () => {
    const failing = new Map([
      ['collab:fetch', 'git fetch origin 失败：fatal'],
      ['other:review firmware', '读 hybrid-mmc/firmware 的协作者失败：Gitea 回 500，boom'],
    ])
    const { events, calls, changed } = eventsWith({ failing })
    expect(await events.refresh(bob.repo)).toEqual({ at, error: 'git fetch origin 失败：fatal\n读 hybrid-mmc/firmware 的协作者失败：Gitea 回 500，boom' })
    expect(calls).toContain('collab:sync')
    expect(calls).toContain('organization:webhook')
    expect(events.errorsOf(bob.repo)).toEqual(['git fetch origin 失败：fatal', '读 hybrid-mmc/firmware 的协作者失败：Gitea 回 500，boom'])
    changed.length = 0
    failing.delete('collab:fetch')
    await events.applyEvents(bob.repo, [{ kind: 'push', repo: 'collab', ref: 'refs/heads/main' }])
    expect(events.errorsOf(bob.repo)).toEqual(['读 hybrid-mmc/firmware 的协作者失败：Gitea 回 500，boom'])
    expect(changed).toEqual([bob.repo])
    failing.clear()
    await events.refresh(bob.repo)
    expect(events.errorsOf(bob.repo)).toEqual([])
    events.stop()
  })

  it('项目打不开（令牌失效等）：记下原话，别的步都不做', async () => {
    const { events, calls } = eventsWith({ openRemote: async () => Promise.reject(new CollabRejected('Gitea 不认这个令牌（401）')) })
    expect(await events.refresh(bob.repo)).toEqual({ at, error: 'Gitea 不认这个令牌（401）' })
    expect(calls).toEqual([])
    expect(events.errorsOf(bob.repo)).toEqual(['Gitea 不认这个令牌（401）'])
    events.stop()
  })

  it('同一个项目正在做别的：回 busy', async () => {
    let release = () => {}
    const blocked = new Promise<void>((resolve) => (release = resolve))
    const { events } = eventsWith({ openRemote: async () => blocked.then(() => bob) })
    const first = events.refresh(bob.repo)
    expect(await events.applyEvents(bob.repo, [])).toBe('busy')
    release()
    await first
    events.stop()
  })
})

describe('按消息把事件分给两边', () => {
  const run = async (pushEvents: PushEvent[], cloned: string[] = []) => {
    const { events, calls, logged } = eventsWith({ cloned })
    expect(await events.applyEvents(bob.repo, pushEvents)).toEqual({ at, error: null })
    events.stop()
    return { calls, logged }
  }

  it('协作仓有新提交：取回、自动同步；负责人换了：重读负责人、核对规矩；协作仓的合并请求、issue 与评论不处理', async () => {
    expect((await run([{ kind: 'push', repo: 'collab', ref: 'refs/heads/main' }])).calls).toEqual(['collab:fetch', 'collab:sync'])
    expect((await run([{ kind: 'leads', repo: 'Collab' }])).calls).toEqual(['collab:leads', 'collab:rules'])
    expect((await run([{ kind: 'pr', repo: 'collab', action: 'opened', number: 9 }, { kind: 'comment', repo: 'collab', action: 'created', number: 2 }])).calls).toEqual([])
  })

  it('别的仓有新提交只取回它；合并请求、issue、评论有动静重读它；负责人换了重读、再核对规矩', async () => {
    expect((await run([{ kind: 'push', repo: 'firmware', ref: 'refs/heads/fix' }])).calls).toEqual(['other:fetch firmware'])
    expect((await run([{ kind: 'pr', repo: 'datasheets', action: 'opened', number: 3 }, { kind: 'issue', repo: 'firmware', action: 'opened', number: 7 }])).calls).toEqual([
      'other:review datasheets',
      'other:review firmware',
    ])
    expect((await run([{ kind: 'leads', repo: 'firmware' }])).calls).toEqual(['other:review firmware', 'other:rules firmware'])
  })

  it('别的仓的合并请求被审阅、合并请求上有新评论：都重读那个仓，「要你改」「评论了」不等下一次刷新', async () => {
    expect((await run([{ kind: 'pr', repo: 'datasheets', action: 'reviewed', number: 4 }])).calls).toEqual(['other:review datasheets'])
    expect((await run([{ kind: 'comment', repo: 'firmware', action: 'created', number: 4 }])).calls).toEqual(['other:review firmware'])
  })

  it('组织里建了仓：补克隆，克隆下来的接着取回、读、核对；删了仓、项目文件夹里没有的仓只记一行', async () => {
    expect((await run([{ kind: 'repo', repo: 'hil', action: 'created' }], ['hil'])).calls).toEqual(['other:clone', 'other:fetch hil', 'other:review hil', 'other:rules hil'])
    const deleted = await run([{ kind: 'repo', repo: 'old-notes', action: 'deleted' }, { kind: 'push', repo: 'unknown', ref: 'refs/heads/main' }])
    expect(deleted.calls).toEqual([])
    expect(deleted.logged).toEqual([`${bob.repo}：组织里的仓 old-notes deleted，本机的目录不动`, `${bob.repo}：收到 unknown 的消息，项目文件夹里没有这个仓，不处理`])
  })
})

describe('项目列表与订阅', () => {
  it('移出列表：两边与组织 webhook 都忘掉它，出错与刷新过的记录也清掉', async () => {
    const { events, calls } = eventsWith({ failing: new Map([['collab:fetch', '取回失败']]) })
    await events.refresh(bob.repo)
    await events.remove(bob.repo)
    expect(calls.slice(-3)).toEqual(['collab:forget', 'other:forget', 'organization:forget'])
    expect(events.errorsOf(bob.repo)).toEqual([])
    expect(events.refreshedOnce(bob.repo)).toBe(false)
    events.stop()
  })

  it('移出列表报给 onListChanged（QQ 任务组靠它撤掉注册）；不在列表里的拒绝、不报', async () => {
    const { events, listChanges } = eventsWith()
    await events.remove(bob.repo)
    expect(listChanges).toEqual([[bob.repo, 'removed']])
    const { events: empty, listChanges: none } = eventsWith({ projects: [] })
    await expect(empty.remove(bob.repo)).rejects.toThrow(/不在项目列表里/)
    expect(none).toEqual([])
    events.stop()
    empty.stop()
  })

  it('start 后列表里的项目就开始盯两边、订上它的组织，不用先手动刷新', async () => {
    git(bob.repo, 'remote', 'set-url', 'origin', 'https://git.example.org/hybrid-mmc/collab.git')
    // 订阅连 ntfy 会真的发请求：换成一直挂起的假 fetch，订阅建好就算连的过程停在这里
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { events, calls } = eventsWith()
    try {
      events.start()
      await vi.waitFor(() => expect(events.pushStatus().topics).toContain('collab-hybrid-mmc'), { timeout: 5_000 })
      expect(events.pushStatus().url).toBe('https://ntfy.example.org')
      expect(calls).toEqual(['collab:watch', 'other:watch'])
    } finally {
      events.stop()
      vi.unstubAllGlobals()
    }
  })

  it('start 时站点起不来：失败记成这个项目的一步出错、报变化，不留没处理的拒绝', async () => {
    git(bob.repo, 'remote', 'set-url', 'origin', 'https://git.example.org/hybrid-mmc/collab.git')
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { events, changed } = eventsWith({ keepSite: async () => Promise.reject(new CollabRejected('site/ 下没有 package.json，不是站点目录')) })
    try {
      events.start()
      await vi.waitFor(() => expect(events.errorsOf(bob.repo)).toEqual(['site/ 下没有 package.json，不是站点目录']), { timeout: 5_000 })
      expect(changed).toContain(bob.repo)
    } finally {
      events.stop()
      vi.unstubAllGlobals()
    }
  })

  it('加进列表时站点起不来：照样加进去、安排刷新，失败记成一步出错、报变化', async () => {
    git(bob.repo, 'remote', 'set-url', 'origin', 'https://git.example.org/hybrid-mmc/collab.git')
    const { events, changed, listChanges } = eventsWith({
      projects: [],
      http: async () => ({ status: 200, body: { username: 'hybrid-mmc' } }),
      keepSite: async () => Promise.reject(new CollabRejected('site/ 下没有 package.json，不是站点目录')),
    })
    expect(await events.add(bob.repo)).toEqual({ repo: bob.repo })
    expect(listChanges).toEqual([[bob.repo, 'added']])
    await vi.waitFor(() => expect(events.errorsOf(bob.repo)).toEqual(['site/ 下没有 package.json，不是站点目录']), { timeout: 5_000 })
    expect(changed).toContain(bob.repo)
    events.stop()
  })

  it('origin 的地址读不出组织：那个项目不订，原因写在实时推送的状态里', async () => {
    git(bob.repo, 'remote', 'set-url', 'origin', path.join(path.dirname(bob.repo), 'no-such-shape'))
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { events } = eventsWith()
    try {
      events.start()
      await vi.waitFor(() => expect(events.pushStatus().error).toMatch(/没订上：origin 的地址 .* 不是 https:\/\/<主机>\/<owner>\/<仓名> 的样子/), { timeout: 5_000 })
      expect(events.pushStatus().state).toBe('off')
    } finally {
      events.stop()
      vi.unstubAllGlobals()
    }
  })
})
