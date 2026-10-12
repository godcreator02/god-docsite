import path from 'node:path'
import { CollabRejected } from './errors.js'
import type { CommandBus, GiteaAccess } from './gitea-api/access.js'
import { remoteProjectOf } from './project/account.js'
import type { GwbDocsiteApi } from '@godcreator/gwb-docsite'
import { openProject, type Project, type RemoteProject } from './project/project.js'
import type { QqTaskGroups } from './project/qq-task-groups.js'
import type { SubmitFailures } from './collab-repo/submit/submit-failures.js'
import type { ProjectNotifications } from './notifications/project-notifications.js'
import type { ProjectEvents } from './organization/events/project-events.js'
import type { CollabSites } from './site-process/collab-sites.js'

/**
 * 登记命令时各领域共用的东西：命令总线、Gitea、gwb-docsite（本 home 的身份码、把身份码加进人员列表）、提交审核的失败记录、通知、
 * 站点、项目列表与组织事件、按项目注册的 QQ 任务组
 */
export type PluginServices = {
  commands: CommandBus
  gitea: GiteaAccess
  docsite: Pick<GwbDocsiteApi, 'identityCode' | 'join'>
  submitFailures: SubmitFailures
  notifications: ProjectNotifications
  sites: CollabSites
  events: ProjectEvents
  qqTaskGroups: QqTaskGroups
}

export const repoUsage = '{ repo }：repo 是项目仓根的绝对路径（仓根下有 collab/ 与 site/people.json）'

export const remoteAuthUsage =
  '要联网：git 用 gwb-gitea 设置里的令牌认证、不经 Windows 凭据管理器，origin 要在 gwb-gitea 配的 Gitea 上，令牌的 Gitea 账号要和本 home 的身份（身份码在 site/people.json 里认出的那个人）一致，不然拒绝'

export const remoteRepoUsage = `${repoUsage}；${remoteAuthUsage}`

type CommandDefinition = { name: string; effect: 'read' | 'write' | 'external'; description: string; usage: string }

/** 登记一条命令：拒绝执行时回 { ok: false, error }，消息原样给人和 AI；别的异常交给命令总线转成失败回执 */
export function registerCommand<T>(commands: CommandBus, definition: CommandDefinition, run: (args: unknown) => Promise<T>): void {
  commands.register(definition, async (args: unknown) => {
    try {
      return { ok: true, data: await run(args) }
    } catch (error) {
      if (error instanceof CollabRejected) return { ok: false, error: error.message }
      throw error
    }
  })
}

/** 命令参数是外部输入：要是一个对象，只收这条命令声明的键，认不出的键直接拒绝 */
export function argsOf(args: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new CollabRejected(`参数要是 { ${allowedKeys.join(', ')} }：repo 是项目仓根的绝对路径`)
  }
  const unknownKey = Object.keys(args).find((key) => !allowedKeys.includes(key))
  if (unknownKey !== undefined) throw new CollabRejected(`认不出的参数 ${unknownKey}；只接受 ${allowedKeys.join('、')}`)
  return args as Record<string, unknown>
}

/** repo 是项目仓根的绝对路径 */
export function repoOf(args: Record<string, unknown>): string {
  const { repo } = args
  if (typeof repo !== 'string' || !path.isAbsolute(repo)) throw new CollabRejected(`repo 要是项目仓根的绝对路径，收到 ${JSON.stringify(repo)}`)
  return path.resolve(repo)
}

/** 只收 { repo } 的命令用它 */
export function repoOfArgs(args: unknown): string {
  return repoOf(argsOf(args, ['repo']))
}

/** 按本 home 的身份码打开项目 */
export function openProjectAt({ docsite }: Pick<PluginServices, 'docsite'>, repo: string): Promise<Project> {
  return openProject(repo, docsite.identityCode())
}

/** 要联网的命令用它：核对 origin 在配的 Gitea 上、令牌的账号就是身份 */
export async function remoteProjectAt(services: Pick<PluginServices, 'docsite' | 'gitea'>, repo: string): Promise<RemoteProject> {
  return remoteProjectOf(await openProjectAt(services, repo), await services.gitea.account())
}

/** 参数 { repo, name, … }：repo 是协作仓根，name 是项目文件夹里的仓名 */
export function repoAndNameOf(args: unknown, keys: string[]) {
  const fields = argsOf(args, ['repo', 'name', ...keys])
  const name = fields['name']
  if (typeof name !== 'string') throw new CollabRejected(`name 要是项目文件夹里的仓名，收到 ${JSON.stringify(name)}`)
  return { repo: repoOf(fields), name, fields }
}
