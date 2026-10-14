import { notificationOf, type Notification } from '@godcreator/collab'
import type { GwbQqBotApi } from '@godcreator/gwb-qq-bot'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { presentForMillisecondsBeforeSending, QqPrivateChat, type QqPrivateChatDeps } from '../../src/notifications/qq-private-chat.js'

function qqBotWithNotify(notify: GwbQqBotApi['notify']): GwbQqBotApi {
  return { notify, registerTaskGroup: vi.fn(), registerCommand: vi.fn(), commandNameProblem: vi.fn(() => null) }
}

function qqBotFake(delivered = true) {
  const notify = vi.fn(async (_id: string, _text: string) => ({ delivered, duplicate: false }))
  return { notify, qqBot: qqBotWithNotify(notify) }
}

const repo = 'D:/projects/hybrid-mmc/collab'
const nameOf = (personId: string) => ({ carol: '卡萝', admin: '管理员' })[personId] ?? personId
const pull = notificationOf({ kind: 'pull-to-review', repo: 'firmware', number: 7, title: '修复', poster: 'carol', url: 'https://example.test/7' })
const conflicts = notificationOf({ kind: 'conflicts', files: ['README.md'] })
const unsubmitted = notificationOf({ kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] })
const unpushed = notificationOf({ kind: 'unpushed', repo: 'library', count: 1 })
const issue = notificationOf({ kind: 'issue-to-answer', repo: 'firmware', number: 3, title: '缺封装', poster: 'carol', lastSpeaker: 'carol', url: 'https://example.test/issues/3' })
const checkError = notificationOf({ kind: 'check-error', message: '连不上 Gitea' })

/** 记录存在内存里的一份文档；计时器与此刻都走 vitest 的假时钟 */
function depsWith(qqBot: GwbQqBotApi | null, overrides: Partial<QqPrivateChatDeps> = {}) {
  const store: { doc: unknown } = { doc: undefined }
  const deps: QqPrivateChatDeps = {
    enabled: () => true,
    qqBot: () => qqBot,
    read: async () => structuredClone(store.doc),
    write: async (value) => {
      store.doc = structuredClone(value)
    },
    setTimeout: (run, milliseconds) => {
      setTimeout(run, milliseconds)
    },
    warn: vi.fn(),
    now: () => new Date(),
    ...overrides,
  }
  return { deps, store }
}

const wait = (milliseconds: number) => vi.advanceTimersByTimeAsync(milliseconds)

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(Date.UTC(2026, 9, 8, 8, 0, 0)) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('QQ 私聊只发新出现、而且连续存在满 1 分钟的通知', () => {
  it('几秒内出现又消失的不发，也不记', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps, store } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, 'collab', [unpushed], nameOf)
    await wait(2_000)
    await chat.observe(repo, 'collab', [], nameOf)
    await wait(presentForMillisecondsBeforeSending * 2)
    expect(notify).not.toHaveBeenCalled()
    expect(store.doc).toEqual({ version: 1, projects: [{ repo, sent: [] }] })
  })

  it('连续存在满 1 分钟的到点就发，期间没有新的刷新也发；之后同样的再交来、重新加载以后都不重发', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps, store } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, '混合型 MMC', [pull], nameOf)
    await wait(presentForMillisecondsBeforeSending - 1)
    expect(notify).not.toHaveBeenCalled()
    await wait(1)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0]![1]).toBe('协作站 混合型 MMC\nfirmware #7「修复」等你审阅（卡萝 开的）')
    expect(store.doc).toEqual({ version: 1, projects: [{ repo, sent: [pull.id] }] })
    await chat.observe(repo, '混合型 MMC', [pull], nameOf)
    await wait(presentForMillisecondsBeforeSending * 2)
    await new QqPrivateChat(deps).observe(repo, '混合型 MMC', [pull], nameOf)
    await wait(presentForMillisecondsBeforeSending * 2)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('等待中消失过的从头算：第一次出现后 1 分钟时不发，再出现后满 1 分钟才发', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, 'collab', [pull], nameOf)
    await wait(30_000)
    await chat.observe(repo, 'collab', [], nameOf)
    await wait(10_000)
    await chat.observe(repo, 'collab', [pull], nameOf)
    await wait(30_000)
    expect(notify).not.toHaveBeenCalled()
    await wait(30_000)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('同时出现的合成一条；后出现的各自等满再发；发过的消失后再出现就是新的一件事、换一个 id 再发', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps, store } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, 'collab', [conflicts, pull], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(notify.mock.calls[0]![1]).toBe('协作站 collab\n提交审核合 main 出了冲突，1 个文件还没改好\nfirmware #7「修复」等你审阅（卡萝 开的）')
    await chat.observe(repo, 'collab', [conflicts], nameOf)
    expect(store.doc).toEqual({ version: 1, projects: [{ repo, sent: [conflicts.id] }] })
    await chat.observe(repo, 'collab', [conflicts, pull, issue], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[1]![1]).toBe('协作站 collab\nfirmware #7「修复」等你审阅（卡萝 开的）\nfirmware 的 issue #3「缺封装」等负责人回（卡萝 提的）')
    expect(new Set(notify.mock.calls.map((call) => call[0])).size).toBe(2)
  })

  it('这批里有检查出错时，读不到而消失的不从记录里去掉，恢复后不重发；只出错几秒的不发', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps, store } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, 'collab', [pull, issue], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    await chat.observe(repo, 'collab', [checkError], nameOf)
    await wait(5_000)
    await chat.observe(repo, 'collab', [pull, issue], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(store.doc).toEqual({ version: 1, projects: [{ repo, sent: [issue.id, pull.id].sort() }] })
  })

  it('检查一直出错满 1 分钟才发出错那条，只发一次', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps, store } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, 'collab', [checkError], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    await chat.observe(repo, 'collab', [checkError], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0]![1]).toBe('协作站 collab\ngwb 检查项目出错')
    expect(store.doc).toEqual({ version: 1, projects: [{ repo, sent: [checkError.id] }] })
  })

  it('重启时还没等满的不留：重新加载后从头等满 1 分钟再发', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps } = depsWith(qqBot)
    const unloaded = new QqPrivateChat({ ...deps, setTimeout: () => {} })
    await unloaded.observe(repo, 'collab', [pull], nameOf)
    await wait(30_000)
    const reloaded = new QqPrivateChat(deps)
    await reloaded.observe(repo, 'collab', [pull], nameOf)
    await wait(30_000)
    expect(notify).not.toHaveBeenCalled()
    await wait(30_000)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('还没提交审核的文件不发，也不记', async () => {
    const { notify, qqBot } = qqBotFake()
    const { deps, store } = depsWith(qqBot)
    const chat = new QqPrivateChat(deps)
    await chat.observe(repo, 'collab', [unsubmitted], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).not.toHaveBeenCalled()
    expect(store.doc).toEqual({ version: 1, projects: [{ repo, sent: [] }] })
  })

  it('开关关着不发也不记，等待中关掉的到点也不发；没装 qq-bot、没送达、发送报错都只记日志', async () => {
    const { notify, qqBot } = qqBotFake()
    const off = depsWith(qqBot, { enabled: () => false })
    await new QqPrivateChat(off.deps).observe(repo, 'collab', [pull], nameOf)
    let enabled = true
    const turnedOff = depsWith(qqBot, { enabled: () => enabled })
    await new QqPrivateChat(turnedOff.deps).observe(repo, 'collab', [pull], nameOf)
    enabled = false
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).not.toHaveBeenCalled()
    expect(off.store.doc).toBeUndefined()
    expect(turnedOff.store.doc).toEqual({ version: 1, projects: [{ repo, sent: [] }] })
    const warn = vi.fn()
    const notifications: Notification[] = [pull]
    await new QqPrivateChat(depsWith(null, { warn }).deps).observe(repo, 'collab', notifications, nameOf)
    await new QqPrivateChat(depsWith(qqBotFake(false).qqBot, { warn }).deps).observe(repo, 'collab', notifications, nameOf)
    const throwing = qqBotWithNotify(vi.fn(async () => { throw new Error('owner-openid 没配') }))
    await new QqPrivateChat(depsWith(throwing, { warn }).deps).observe(repo, 'collab', notifications, nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('记录读不出来、格式不对、写不进去：停下不发，不把内存里的当成已记下的', async () => {
    const { notify, qqBot } = qqBotFake()
    const unreadable = depsWith(qqBot, { read: async () => { throw new Error('disk unavailable') } })
    await expect(new QqPrivateChat(unreadable.deps).observe(repo, 'collab', [pull], nameOf)).rejects.toThrow('disk unavailable')
    const malformed = depsWith(qqBot, { read: async () => ({ version: 2, observations: [] }) })
    await expect(new QqPrivateChat(malformed.deps).observe(repo, 'collab', [pull], nameOf)).rejects.toThrow(/QQ 私聊通知的记录（文档 qq-sent-notifications）格式不对/)
    const unwritable = new QqPrivateChat(depsWith(qqBot, { write: async () => { throw new Error('disk full') } }).deps)
    await expect(unwritable.observe(repo, 'collab', [pull], nameOf)).rejects.toThrow('disk full')
    await expect(unwritable.observe(repo, 'collab', [pull], nameOf)).rejects.toThrow('disk full')
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).not.toHaveBeenCalled()
  })

  it('到点记下已发时写不进去：不发，写一行警告', async () => {
    const { notify, qqBot } = qqBotFake()
    let writes = 0
    const warn = vi.fn()
    const { deps } = depsWith(qqBot, {
      warn,
      write: async () => {
        writes += 1
        if (writes > 1) throw new Error('disk full')
      },
    })
    await new QqPrivateChat(deps).observe(repo, 'collab', [pull], nameOf)
    await wait(presentForMillisecondsBeforeSending)
    expect(notify).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(`${repo} 等满时长的 QQ 通知没有发出：disk full`)
  })
})
