import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { GwbQqBotApi, TaskGroupDefinition } from '@godcreator/gwb-qq-bot'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CollabRejected } from '../../src/errors.js'
import { QqTaskGroups, taskGroupOf, type QqTaskGroupsDeps } from '../../src/project/qq-task-groups.js'

/** 一个项目文件夹里的协作仓；title 给了就写进 site/content/meta.json 当站名 */
function collabRepoIn(root: string, organization: string, title?: string): string {
  const repo = path.join(root, organization, 'collab')
  mkdirSync(path.join(repo, 'site', 'content'), { recursive: true })
  if (title !== undefined) writeFileSync(path.join(repo, 'site', 'content', 'meta.json'), JSON.stringify({ title }))
  return repo
}

function setTitle(repo: string, title: string): void {
  writeFileSync(path.join(repo, 'site', 'content', 'meta.json'), JSON.stringify({ title }))
}

/** 假的命令名规则：不以 / 开头的、保留命令拒绝，别的都算合规；真规则在 qq-bot，这里只验协作站照它的原话拒绝 */
function fakeCommandNameProblem(command: string): string | null {
  if (!command.startsWith('/')) return `命令 ${command} 要以 / 开头`
  if (command === '/帮助') return '/帮助 是保留命令（/帮助、/状态、/新会话），不能注册'
  return null
}

/** 假的 gwbQqBot：按命令记下此刻注册着的任务组，重名照 qq-bot 抛错；taken 是别的来源占着的命令 */
function qqBotFake(taken: string[] = []) {
  const active = new Map<string, TaskGroupDefinition>()
  const registerTaskGroup = vi.fn((definition: TaskGroupDefinition) => {
    const problem = fakeCommandNameProblem(definition.command)
    if (problem !== null) throw new Error(problem)
    if (taken.includes(definition.command) || active.has(definition.command)) throw new Error(`命令 ${definition.command} 已经被命令登记的任务组（qq-bot.group.add）占用，换一个名字`)
    active.set(definition.command, definition)
    return () => {
      if (active.get(definition.command) === definition) active.delete(definition.command)
    }
  })
  const commandNameProblem = vi.fn(fakeCommandNameProblem)
  const qqBot: GwbQqBotApi = { notify: vi.fn(), registerTaskGroup, registerCommand: vi.fn(), commandNameProblem }
  return { qqBot, active, registerTaskGroup, commandNameProblem, taken }
}

let root: string
let mmc: string
let sst: string

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'collab-qq-groups-'))
  mmc = collabRepoIn(root, 'hybrid-mmc', '混合型 MMC 样机')
  sst = collabRepoIn(root, 'sst-lab')
})

/** 记录存在内存里的一份文档；projects 是可改的项目列表 */
function groupsWith(overrides: Partial<QqTaskGroupsDeps> = {}) {
  const store: { doc: unknown } = { doc: undefined }
  const projects = { list: [mmc, sst] }
  const warn = vi.fn()
  const deps: QqTaskGroupsDeps = {
    projects: () => projects.list,
    read: async () => structuredClone(store.doc),
    write: async (value) => {
      store.doc = structuredClone(value)
    },
    warn,
    ...overrides,
  }
  return { groups: new QqTaskGroups(deps), store, projects, warn }
}

describe('注册的任务组', () => {
  it('命令是起的 QQ 命令，名字是站名，工作区是项目文件夹，交给 ZCode，要求只写项目名、协作仓与先读说明书 collab', () => {
    expect(taskGroupOf(mmc, '/mmc')).toEqual({
      command: '/mmc',
      title: '混合型 MMC 样机',
      workspace: path.join(root, 'hybrid-mmc'),
      agent: 'zcode',
      instructions: `项目：混合型 MMC 样机\n协作仓：${mmc}\n先读 gwb 说明书 collab（经 gwb MCP 调 run skill.read {"name":"collab"}），协作仓和项目里其余仓的改动照它提交。`,
    })
  })

  it('站点还没写站名时用协作仓的目录名', () => {
    expect(taskGroupOf(sst, '/sst').title).toBe('collab')
  })
})

describe('设 QQ 命令与注册', () => {
  it('设了就注册、存进本 home 的文档；给 null 撤掉注册、删掉记录；没设的项目不注册', async () => {
    const { qqBot, active } = qqBotFake()
    const { groups, store } = groupsWith()
    await groups.attach(qqBot)
    expect(await groups.setCommand(mmc, '/mmc')).toEqual({ command: '/mmc', registered: true, error: null })
    expect([...active.keys()]).toEqual(['/mmc'])
    expect(active.get('/mmc')).toEqual(taskGroupOf(mmc, '/mmc'))
    expect(store.doc).toEqual({ version: 1, projects: [{ repo: mmc, command: '/mmc' }] })
    expect(groups.statusOf(sst)).toEqual({ command: null, registered: false, error: null })
    expect(await groups.setCommand(mmc, null)).toEqual({ command: null, registered: false, error: null })
    expect(active.size).toBe(0)
    expect(store.doc).toEqual({ version: 1, projects: [] })
  })

  it('改 QQ 命令：撤掉旧的、注册新的；两个项目互换命令也行', async () => {
    const { qqBot, active } = qqBotFake()
    const { groups } = groupsWith()
    await groups.attach(qqBot)
    await groups.setCommand(mmc, '/mmc')
    await groups.setCommand(sst, '/sst')
    await groups.setCommand(mmc, '/样机')
    expect([...active.keys()].sort()).toEqual(['/sst', '/样机'].sort())
    await groups.setCommand(sst, null)
    await groups.setCommand(mmc, '/sst')
    expect([...active.keys()]).toEqual(['/sst'])
    expect(active.get('/sst')!.workspace).toBe(path.join(root, 'hybrid-mmc'))
  })

  it('设之前就查：名字经 qq-bot 的 commandNameProblem 查不过、项目不在列表里、本 home 别的项目用着它，都拒绝，什么都不改', async () => {
    const { qqBot, active, commandNameProblem } = qqBotFake()
    const { groups, store, projects } = groupsWith()
    await groups.attach(qqBot)
    await groups.setCommand(mmc, '/mmc')
    const before = structuredClone(store.doc)
    await expect(groups.setCommand(sst, 'sst')).rejects.toThrow(CollabRejected)
    await expect(groups.setCommand(sst, '/帮助')).rejects.toThrow('/帮助 是保留命令（/帮助、/状态、/新会话），不能注册')
    expect(commandNameProblem).toHaveBeenCalledWith('/帮助')
    await expect(groups.setCommand(sst, '/mmc')).rejects.toThrow(`QQ 命令 /mmc 已经给了项目 ${mmc}，换一个`)
    projects.list = [mmc]
    await expect(groups.setCommand(sst, '/sst')).rejects.toThrow(`${sst} 不在项目列表里：先用 collab.project.add 加进来`)
    expect(store.doc).toEqual(before)
    expect([...active.keys()]).toEqual(['/mmc'])
  })
})

describe('项目变了就按现状重新注册', () => {
  it('站名变了：sync 撤掉旧的、按新站名注册；没变的不动', async () => {
    const { qqBot, active, registerTaskGroup } = qqBotFake()
    const { groups } = groupsWith()
    await groups.attach(qqBot)
    await groups.setCommand(mmc, '/mmc')
    await groups.sync()
    expect(registerTaskGroup).toHaveBeenCalledTimes(1)
    setTitle(mmc, 'MMC 二代样机')
    await groups.sync()
    expect(registerTaskGroup).toHaveBeenCalledTimes(2)
    expect(active.get('/mmc')!.title).toBe('MMC 二代样机')
    expect(active.get('/mmc')!.instructions).toContain('项目：MMC 二代样机')
  })

  it('项目移出列表：sync 撤掉它的注册；forget 连记录一起删，再加回来也不注册', async () => {
    const { qqBot, active } = qqBotFake()
    const { groups, store, projects } = groupsWith()
    await groups.attach(qqBot)
    await groups.setCommand(mmc, '/mmc')
    await groups.setCommand(sst, '/sst')
    projects.list = [sst]
    await groups.sync()
    expect([...active.keys()]).toEqual(['/sst'])
    await groups.forget(mmc)
    expect(store.doc).toEqual({ version: 1, projects: [{ repo: sst, command: '/sst' }] })
    projects.list = [mmc, sst]
    await groups.sync()
    expect([...active.keys()]).toEqual(['/sst'])
  })
})

describe('gwbQqBot 在不在', () => {
  it('不在时设不了 QQ 命令（不跳过校验），什么都不记；撤掉照样能撤', async () => {
    const { qqBot } = qqBotFake()
    const { groups, store } = groupsWith()
    await expect(groups.setCommand(mmc, '/mmc')).rejects.toThrow('没装或没启用 gwb-qq-bot，设不了 QQ 命令')
    expect(store.doc).toBeUndefined()
    await groups.attach(qqBot)
    await groups.setCommand(mmc, '/mmc')
    groups.detach()
    expect(await groups.setCommand(mmc, null)).toEqual({ command: null, registered: false, error: null })
    expect(store.doc).toEqual({ version: 1, projects: [] })
  })

  it('消失时全部撤掉，状态写明没装；再出现时按记下的 QQ 命令重新注册', async () => {
    const first = qqBotFake()
    const { groups } = groupsWith()
    await groups.attach(first.qqBot)
    await groups.setCommand(mmc, '/mmc')
    await groups.setCommand(sst, '/sst')
    expect(groups.statusOf(mmc)).toEqual({ command: '/mmc', registered: true, error: null })
    groups.detach()
    expect(first.active.size).toBe(0)
    expect(groups.statusOf(mmc)).toEqual({ command: '/mmc', registered: false, error: '没装或没启用 gwb-qq-bot，任务组没有注册' })
    const second = qqBotFake()
    await groups.attach(second.qqBot)
    expect([...second.active.keys()].sort()).toEqual(['/mmc', '/sst'])
  })

  it('注册时 qq-bot 抛错（被别的来源先占了）：原话记在状态里、只记一行警告，不吞掉；腾出来以后下次 sync 注册上', async () => {
    const fake = qqBotFake(['/mmc'])
    const { groups, warn } = groupsWith()
    await groups.attach(fake.qqBot)
    const status = await groups.setCommand(mmc, '/mmc')
    expect(status.registered).toBe(false)
    expect(status.error).toBe('注册 QQ 任务组 /mmc 失败：命令 /mmc 已经被命令登记的任务组（qq-bot.group.add）占用，换一个名字')
    await groups.sync()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain(mmc)
    fake.taken.length = 0
    await groups.sync()
    expect(groups.statusOf(mmc)).toEqual({ command: '/mmc', registered: true, error: null })
  })
})

describe('记录', () => {
  it('重新加载以后照记录注册', async () => {
    const { qqBot } = qqBotFake()
    const first = groupsWith()
    await first.groups.attach(qqBot)
    await first.groups.setCommand(mmc, '/mmc')
    first.groups.detach()
    const reloaded = qqBotFake()
    const second = groupsWith({ read: async () => structuredClone(first.store.doc) })
    await second.groups.attach(reloaded.qqBot)
    expect([...reloaded.active.keys()]).toEqual(['/mmc'])
  })

  it('读不出、格式不对、写不进去：停下报错，不注册', async () => {
    const { qqBot, active } = qqBotFake()
    const malformed = groupsWith({ read: async () => ({ version: 2, groups: [] }) })
    await expect(malformed.groups.attach(qqBot)).rejects.toThrow(/QQ 命令的记录（文档 qq-task-group-commands）格式不对/)
    await expect(malformed.groups.setCommand(mmc, '/mmc')).rejects.toThrow(/格式不对/)
    const unwritable = groupsWith({ write: async () => { throw new Error('disk full') } })
    await unwritable.groups.attach(qqBot)
    await expect(unwritable.groups.setCommand(mmc, '/mmc')).rejects.toThrow('disk full')
    await expect(unwritable.groups.sync()).rejects.toThrow('disk full')
    expect(active.size).toBe(0)
  })
})
