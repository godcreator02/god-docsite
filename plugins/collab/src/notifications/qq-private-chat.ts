import { createHash } from 'node:crypto'
import { notificationSentenceOf, type Notification } from '@godcreator/collab'
import type { GwbQqBotApi } from '@godcreator/gwb-qq-bot'
import type { NotificationChannel } from './project-notifications.js'
import { repoKeyOf } from '../project/project.js'
import { messageOf } from '../errors.js'

/** 记录存在 gwb-data 的这个文档里：各项目已经经 QQ 发过的通知 id */
export const sentNotificationsDocKey = 'qq-sent-notifications'

/** 一条通知连续存在这么久才私聊：先提交、一两秒后才推送时中间那条「还没推送」这类中间状态不发 */
export const presentForMillisecondsBeforeSending = 60_000

type SentRecord = { version: 1; projects: Array<{ repo: string; sent: string[] }> }

/** 文档是外部输入：形状不对就报错，不猜 */
function sentRecordOf(raw: unknown): SentRecord {
  const doc = raw as { version?: unknown; projects?: unknown }
  const valid =
    typeof raw === 'object' &&
    raw !== null &&
    doc.version === 1 &&
    Array.isArray(doc.projects) &&
    doc.projects.every((entry: unknown) => {
      const project = entry as { repo?: unknown; sent?: unknown }
      return typeof entry === 'object' && entry !== null && typeof project.repo === 'string' && Array.isArray(project.sent) && project.sent.every((id) => typeof id === 'string')
    })
  if (!valid) throw new Error(`QQ 私聊通知的记录（文档 ${sentNotificationsDocKey}）格式不对：${JSON.stringify(raw)}`)
  return raw as SentRecord
}

/** QQ 一条私聊最长 600 字 */
const qqTextLimit = 600

/** 自己保存出来的改动，不播报 */
const silentKinds: ReadonlySet<Notification['kind']> = new Set(['unsubmitted'])

export type QqPrivateChatDeps = {
  enabled(): boolean
  /** 没装 gwb-qq-bot 时为 null */
  qqBot(): GwbQqBotApi | null
  read(): Promise<unknown>
  write(value: unknown): Promise<void>
  /** 插件卸载时要连带清掉的计时器 */
  setTimeout(run: () => void, milliseconds: number): void
  warn(text: string): void
  now(): Date
}

/** 一个项目最近一次交来的：到点发的时候按它判断还在不在、写短句 */
type LatestObservation = { repo: string; projectTitle: string; nameOf: (personId: string) => string; reported: Notification[] }

/** 一条还没发、正在等满时长的通知。消失后再出现是另一个对象，之前那个计时器认不出它，等待从头算 */
type WaitingNotification = { id: string }

/**
 * 交来一批之后的已发 id。消失了的去掉（再出现就是新的一件事）；这批里有 check-error 时一个都不去：
 * 某一步读 Gitea 失败，读不到的合并请求、issue 看起来像消失了，等连上再出现不能当成新的重发
 */
function sentIdsAfterObserving(sent: ReadonlySet<string>, reported: Notification[]): string[] {
  const checkFailed = reported.some((notification) => notification.kind === 'check-error')
  const reportedIds = new Set(reported.map((notification) => notification.id))
  return [...sent].filter((id) => checkFailed || reportedIds.has(id)).sort()
}

/**
 * 接口 B 的 QQ 私聊实现：经服务 gwbQqBot 私聊主人，按通知 id 只发新出现、而且连续存在满 presentForMillisecondsBeforeSending 的。
 * 每个项目记下已经发过的 id，去掉哪些见 sentIdsAfterObserving；unsubmitted 不发。等待中的只在内存里，重启后从头等。
 * 发不出去不重发，通知在网站提示栏里不会丢。读或写记录失败就停下，不把内存里的当成已记下的
 */
export class QqPrivateChat implements NotificationChannel {
  private record: SentRecord = { version: 1, projects: [] }
  private queue: Promise<unknown>
  private storageError: unknown
  /** 键是 repoKeyOf(repo) */
  private readonly latest = new Map<string, LatestObservation>()
  /** 键是 repoKeyOf(repo)，里面按通知 id；只放最近一次交来的里面还在的 */
  private readonly waiting = new Map<string, Map<string, WaitingNotification>>()

  constructor(private readonly deps: QqPrivateChatDeps) {
    this.queue = deps
      .read()
      .then((raw) => {
        if (raw !== undefined) this.record = sentRecordOf(raw)
      })
      .catch((error: unknown) => {
        this.storageError = error
      })
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => {
      if (this.storageError !== undefined) throw this.storageError
      return run()
    })
    this.queue = next.catch(() => {})
    return next
  }

  private async save(): Promise<void> {
    try {
      await this.deps.write(this.record)
    } catch (error) {
      this.storageError = error
      throw error
    }
  }

  private sentIdsOf(key: string): Set<string> {
    return new Set(this.record.projects.find((project) => repoKeyOf(project.repo) === key)?.sent ?? [])
  }

  /** 这个项目还没有记录时也写一条空的，之后一样就不写 */
  private async recordSent(repo: string, sent: string[]): Promise<void> {
    const key = repoKeyOf(repo)
    const entry = this.record.projects.find((project) => repoKeyOf(project.repo) === key)
    if (entry !== undefined && sent.join('\n') === [...entry.sent].sort().join('\n')) return
    this.record = { version: 1, projects: [...this.record.projects.filter((project) => repoKeyOf(project.repo) !== key), { repo, sent }] }
    await this.save()
  }

  observe(repo: string, projectTitle: string, notifications: Notification[], nameOf: (personId: string) => string): Promise<void> {
    return this.serial(async () => {
      if (!this.deps.enabled()) return
      const key = repoKeyOf(repo)
      const reported = notifications.filter((notification) => !silentKinds.has(notification.kind))
      this.latest.set(key, { repo, projectTitle, nameOf, reported })
      const sent = this.sentIdsOf(key)
      await this.recordSent(repo, sentIdsAfterObserving(sent, reported))
      this.startWaiting(key, reported.filter((notification) => !sent.has(notification.id)).map((notification) => notification.id))
    })
  }

  /** 还在等的留着原来的计时，新出现的一起开一个计时器，不在了的扔掉 */
  private startWaiting(key: string, unsentIds: string[]): void {
    const before = this.waiting.get(key) ?? new Map<string, WaitingNotification>()
    const after = new Map(unsentIds.map((id) => [id, before.get(id) ?? { id }]))
    this.waiting.set(key, after)
    const started = [...after.values()].filter((entry) => before.get(entry.id) !== entry)
    if (started.length === 0) return
    this.deps.setTimeout(() => {
      this.sendIfStillWaiting(key, started).catch((error: unknown) => this.deps.warn(`${this.latest.get(key)!.repo} 等满时长的 QQ 通知没有发出：${messageOf(error)}`))
    }, presentForMillisecondsBeforeSending)
  }

  /** 到点时这一批里还在等的（期间没有消失过）才发；同时到点的合成一条 */
  private sendIfStillWaiting(key: string, started: WaitingNotification[]): Promise<void> {
    return this.serial(async () => {
      const waiting = this.waiting.get(key)!
      const dueIds = new Set(started.filter((entry) => waiting.get(entry.id) === entry).map((entry) => entry.id))
      if (dueIds.size === 0) return
      for (const id of dueIds) waiting.delete(id)
      if (!this.deps.enabled()) return
      const { repo, projectTitle, nameOf, reported } = this.latest.get(key)!
      const fresh = reported.filter((notification) => dueIds.has(notification.id))
      await this.recordSent(repo, [...new Set([...this.sentIdsOf(key), ...dueIds])].sort())
      await this.notify(repo, fresh, [`协作站 ${projectTitle}`, ...fresh.map((notification) => notificationSentenceOf(notification, nameOf))].join('\n').slice(0, qqTextLimit))
    })
  }

  /** qq-bot 同一个 id 只发一次、内容不同直接报错：id 由项目、这批通知与此刻算出，同一件事消失后再出现也能再发 */
  private async notify(repo: string, fresh: Notification[], text: string): Promise<void> {
    const id = `collab-${createHash('sha256')
      .update([repo, ...fresh.map((notification) => notification.id), this.deps.now().toISOString()].join('\n'))
      .digest('hex')
      .slice(0, 32)}`
    const qqBot = this.deps.qqBot()
    if (qqBot === null) {
      this.deps.warn(`没装 gwb-qq-bot，QQ 通知 ${id} 没有发出，通知仍在协作站提示栏里`)
      return
    }
    try {
      if (!(await qqBot.notify(id, text)).delivered) this.deps.warn(`QQ 通知 ${id} 未送达，通知仍在协作站提示栏里`)
    } catch (error) {
      this.deps.warn(`QQ 通知 ${id} 发送失败（${error instanceof Error ? error.message : String(error)}），通知仍在协作站提示栏里`)
    }
  }

  async close(): Promise<void> {
    await this.queue
  }
}
