import path from 'node:path'
import { sitePathInRepo } from '@godcreator/collab'
import { projectDirOfCollabRepo } from '@godcreator/collab/node'
import type { GwbQqBotApi, TaskGroupDefinition } from '@godcreator/gwb-qq-bot'
import { CollabRejected, messageOf } from '../errors.js'
import { projectTitleOf, repoKeyOf, sameRepo } from './project.js'

/** 每个项目在本 home 的「QQ 命令」存在 gwb-data 的这个文档里；每个人的机器人、命令各不相同，不写进协作仓 */
export const qqCommandsDocKey = 'qq-task-group-commands'

type QqCommandsRecord = { version: 1; projects: Array<{ repo: string; command: string }> }

/** 文档是外部输入：形状不对就报错，不猜 */
function qqCommandsRecordOf(raw: unknown): QqCommandsRecord {
  const doc = raw as { version?: unknown; projects?: unknown }
  const valid =
    typeof raw === 'object' &&
    raw !== null &&
    doc.version === 1 &&
    Array.isArray(doc.projects) &&
    doc.projects.every((entry: unknown) => {
      const project = entry as { repo?: unknown; command?: unknown }
      return typeof entry === 'object' && entry !== null && typeof project.repo === 'string' && typeof project.command === 'string'
    })
  if (!valid) throw new Error(`QQ 命令的记录（文档 ${qqCommandsDocKey}）格式不对：${JSON.stringify(raw)}`)
  return raw as QqCommandsRecord
}

/** 任务组要求：只写项目名、协作仓路径和先读说明书 collab；提交规矩以说明书为准，不在这里重复 */
export function taskGroupInstructionsOf(title: string, repo: string): string {
  return [`项目：${title}`, `协作仓：${repo}`, `先读 gwb 说明书 collab（经 gwb MCP 调 run skill.read ${JSON.stringify({ name: 'collab' })}），协作仓和项目里其余仓的改动照它提交。`].join('\n')
}

/** 一个项目注册成的任务组：工作区是项目文件夹（协作仓的上一级），名字是站名；由 gwb-qq-bot 交给 claude-agent 做 */
export function taskGroupOf(repo: string, command: string): TaskGroupDefinition {
  const title = projectTitleOf({ repo, siteDir: path.join(repo, sitePathInRepo) })
  return { command, title, workspace: projectDirOfCollabRepo(repo), instructions: taskGroupInstructionsOf(title, repo) }
}

/** 一个项目的任务组此刻怎样：command 是本 home 给它起的 QQ 命令（没起为 null），error 是没注册上的原因 */
export type QqTaskGroupStatus = { command: string | null; registered: boolean; error: string | null }

export type QqTaskGroupsDeps = {
  /** 项目列表里的协作仓根 */
  projects(): string[]
  read(): Promise<unknown>
  write(value: unknown): Promise<void>
  warn(text: string): void
}

type Registration = { definitionText: string; unregister: () => void }

/**
 * 按项目注册 QQ 任务组：项目列表里起了「QQ 命令」的项目，各经 gwbQqBot 注册一个任务组。
 * 每次 sync 按此刻的列表、QQ 命令与站名算出该有的注册，和已有的比：没了或变了的先撤，再注册缺的；注册抛错的记下原因、下次 sync 再试。
 * 记录读不出、格式不对或写不进去就停下，不把内存里的当成已记下的
 */
export class QqTaskGroups {
  private record: QqCommandsRecord = { version: 1, projects: [] }
  private queue: Promise<unknown>
  private storageError: unknown
  private qqBot: GwbQqBotApi | null = null
  private readonly registrations = new Map<string, Registration>()
  private readonly errors = new Map<string, string>()

  constructor(private readonly deps: QqTaskGroupsDeps) {
    this.queue = deps
      .read()
      .then((raw) => {
        if (raw !== undefined) this.record = qqCommandsRecordOf(raw)
      })
      .catch((error: unknown) => {
        this.storageError = error
      })
  }

  private serial<T>(run: () => Promise<T> | T): Promise<T> {
    const next = this.queue.then(() => {
      if (this.storageError !== undefined) throw this.storageError
      return run()
    })
    this.queue = next.catch(() => {})
    return next
  }

  private async save(record: QqCommandsRecord): Promise<void> {
    try {
      await this.deps.write(record)
    } catch (error) {
      this.storageError = error
      throw error
    }
    this.record = record
  }

  private commandOf(repo: string): string | null {
    return this.record.projects.find((entry) => sameRepo(entry.repo, repo))?.command ?? null
  }

  /** gwbQqBot 出现：按现状注册 */
  attach(qqBot: GwbQqBotApi): Promise<void> {
    this.qqBot = qqBot
    return this.sync()
  }

  /** gwbQqBot 消失或本插件卸载：撤掉全部注册 */
  detach(): void {
    this.qqBot = null
    for (const registration of this.registrations.values()) registration.unregister()
    this.registrations.clear()
    this.errors.clear()
  }

  /** 按此刻的项目列表、QQ 命令与站名重新对一遍注册；没变的不动 */
  sync(): Promise<void> {
    return this.serial(() => this.syncNow())
  }

  private syncNow(): void {
    const qqBot = this.qqBot
    if (qqBot === null) return
    const wanted = new Map<string, { repo: string; definition: TaskGroupDefinition | null; error: string | null }>()
    for (const repo of this.deps.projects()) {
      const command = this.commandOf(repo)
      if (command === null) continue
      try {
        wanted.set(repoKeyOf(repo), { repo, definition: taskGroupOf(repo, command), error: null })
      } catch (error) {
        wanted.set(repoKeyOf(repo), { repo, definition: null, error: `算不出任务组：${messageOf(error)}` })
      }
    }
    for (const [key, registration] of this.registrations) {
      const definition = wanted.get(key)?.definition ?? null
      if (definition !== null && JSON.stringify(definition) === registration.definitionText) continue
      registration.unregister()
      this.registrations.delete(key)
    }
    for (const key of this.errors.keys()) if (!wanted.has(key)) this.errors.delete(key)
    for (const [key, { repo, definition, error }] of wanted) {
      if (this.registrations.has(key)) continue
      if (definition === null) {
        this.recordError(key, repo, error!)
        continue
      }
      try {
        this.registrations.set(key, { definitionText: JSON.stringify(definition), unregister: qqBot.registerTaskGroup(definition) })
        this.errors.delete(key)
      } catch (registerError) {
        this.recordError(key, repo, `注册 QQ 任务组 ${definition.command} 失败：${messageOf(registerError)}`)
      }
    }
  }

  /** 同一个原因只记一行日志：sync 会随项目状态反复调，没变的不再刷屏 */
  private recordError(key: string, repo: string, message: string): void {
    if (this.errors.get(key) !== message) this.deps.warn(`${repo} 的 ${message}`)
    this.errors.set(key, message)
  }

  statusOf(repo: string): QqTaskGroupStatus {
    const command = this.commandOf(repo)
    if (command === null) return { command, registered: false, error: null }
    const key = repoKeyOf(repo)
    if (this.registrations.has(key)) return { command, registered: true, error: null }
    if (this.qqBot === null) return { command, registered: false, error: '没装或没启用 gwb-qq-bot，任务组没有注册' }
    return { command, registered: false, error: this.errors.get(key) ?? null }
  }

  /**
   * 给列表里的项目设「QQ 命令」，command 为 null 是撤掉。设的时候 gwbQqBot 要在：先经它的 commandNameProblem 查命令名规则
   * （和注册用同一条），再查本 home 别的项目有没有用着它，不过就拒绝、什么都不改；记下以后按现状重新注册，回这个项目的任务组此刻怎样
   */
  async setCommand(repo: string, command: string | null): Promise<QqTaskGroupStatus> {
    if (command !== null) {
      if (this.qqBot === null) throw new CollabRejected('没装或没启用 gwb-qq-bot，设不了 QQ 命令')
      const problem = this.qqBot.commandNameProblem(command)
      if (problem !== null) throw new CollabRejected(problem)
    }
    const projects = this.deps.projects()
    if (!projects.some((listed) => sameRepo(listed, repo))) throw new CollabRejected(`${repo} 不在项目列表里：先用 collab.project.add 加进来`)
    return this.serial(async () => {
      if (command !== null) {
        const holder = this.record.projects.find((entry) => entry.command === command && !sameRepo(entry.repo, repo) && projects.some((listed) => sameRepo(listed, entry.repo)))
        if (holder !== undefined) throw new CollabRejected(`QQ 命令 ${command} 已经给了项目 ${holder.repo}，换一个`)
      }
      const others = this.record.projects.filter((entry) => !sameRepo(entry.repo, repo))
      await this.save({ version: 1, projects: command === null ? others : [...others, { repo, command }] })
      this.syncNow()
      return this.statusOf(repo)
    })
  }

  /** 项目移出列表：它的 QQ 命令一起删掉，撤掉它的任务组 */
  forget(repo: string): Promise<void> {
    return this.serial(async () => {
      if (this.commandOf(repo) !== null) await this.save({ version: 1, projects: this.record.projects.filter((entry) => !sameRepo(entry.repo, repo)) })
      this.syncNow()
    })
  }
}
