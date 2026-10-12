/** 组织事件：项目列表的加入、移出与加载时启动，把要求合成一批再调度，完整刷新与按消息处理时按仓把事情分给两边，组织 webhook 的核对 */
import { applyCollabRepoEvent, refreshCollabRepo, type CollabRepoHandlers, type CollabRepoSteps } from '../../collab-repo/events.js'
import type { GiteaAccess } from '../../gitea-api/access.js'
import { applyOtherRepoEvent, applyRepoEvent, refreshOtherRepos, type OtherReposHandlers, type OtherReposSteps } from '../../other-repos/events.js'
import { ProjectList, type ProjectsSetting } from '../../project/list.js'
import { repoKeyOf, sameRepo, sameRepoName, type Project, type RemoteProject } from '../../project/project.js'
import { distinctEvents, type PushEvent } from './messages.js'
import { ProjectStepRunner, type RefreshRecord } from './project-step-runner.js'
import { ProjectTopicsSubscription, type PushStatus } from './project-topics-subscription.js'
import { EventScheduler } from './scheduler.js'

export type { CollabRepoHandlers } from '../../collab-repo/events.js'
export type { OtherReposHandlers } from '../../other-repos/events.js'
export type { RefreshRecord } from './project-step-runner.js'
export type { PushStatus } from './project-topics-subscription.js'

export type ProjectEventsDeps = {
  log: { info(message: string): void; warn(message: string): void }
  projectsSetting: ProjectsSetting
  gitea: GiteaAccess
  /** 按本 home 的身份码打开项目 */
  openProject(repo: string): Promise<Project>
  /** 打开要联网的项目：核对 origin 与令牌的账号 */
  openRemote(repo: string): Promise<RemoteProject>
  sites: { keep(repo: string): Promise<void>; forget(repo: string): Promise<void> }
  collabRepo: CollabRepoHandlers
  otherRepos: OtherReposHandlers
  webhooks: { check(repo: string, organization: string): Promise<void>; forget(repo: string): void }
  /** 某个项目各步的出错变了，或第一次完整刷新做完了 */
  onChange(repo: string): void
  /** 一个项目刚加进或移出项目列表 */
  onListChanged(repo: string, change: 'added' | 'removed'): void
  setTimeout(run: () => void, milliseconds: number): void
  now(): Date
}

/**
 * 刚连上推送与 collab.check 时对项目做完整刷新，收到消息按仓分给协作仓那一套或别的仓那一套，两边各自决定做哪几步；
 * 认不出的消息对那个组织的项目做一次完整刷新。加进列表就开始监视、启动站点、刷新一次。
 * 订阅在 ProjectTopicsSubscription，各步出错的记录与同一项目同时只做一件在 ProjectStepRunner
 */
export class ProjectEvents {
  private readonly list: ProjectList
  private readonly scheduler: EventScheduler
  private readonly subscription: ProjectTopicsSubscription
  private readonly steps: ProjectStepRunner
  private readonly refreshed = new Set<string>()

  constructor(private readonly deps: ProjectEventsDeps) {
    this.list = new ProjectList(deps.projectsSetting, deps.gitea.http, deps.openProject)
    this.scheduler = new EventScheduler({
      refresh: (repo) => this.whileListed(repo, () => this.refresh(repo)),
      apply: (repo, events) => this.whileListed(repo, () => this.applyEvents(repo, events)),
      now: () => deps.now().getTime(),
      setTimeout: deps.setTimeout,
    })
    this.subscription = new ProjectTopicsSubscription({
      log: deps.log,
      gitea: deps.gitea,
      projects: () => this.current(),
      request: (repo, work) => this.scheduler.request(repo, work),
    })
    this.steps = new ProjectStepRunner(deps)
  }

  current(): string[] {
    return this.list.current()
  }

  listed(): { projects: string[]; error: string | null } {
    return this.list.listed()
  }

  /** 各步此刻的出错，一步一条；都没出错为空 */
  errorsOf(repo: string): string[] {
    return this.steps.errorsOf(repo)
  }

  /** 这次加载后做完过一次完整刷新：两边读 Gitea 的结果才算齐 */
  refreshedOnce(repo: string): boolean {
    return this.refreshed.has(repoKeyOf(repo))
  }

  /** 插件加载时：列表里每个项目开始监视两边的仓、让站点常驻，开始订阅（连上就完整刷新全部项目一次） */
  start(): void {
    void this.subscription.sync()
    const { projects, error } = this.listed()
    if (error !== null) this.deps.log.warn(`项目没能开始：${error}`)
    for (const repo of projects) {
      void this.steps.notifyWhenStepErrorsChange(repo, async () => this.startWatching(repo))
      void this.deps.sites.keep(repo)
    }
  }

  stop(): void {
    this.subscription.stop()
  }

  /** collab.check 与插件自己的完整刷新：两边各刷新一次，再核对组织 webhook 与订阅；同一个项目正在做别的就回 busy */
  async refresh(repo: string): Promise<RefreshRecord | 'busy'> {
    const record = await this.steps.exclusively(repo, true, async (errors) => {
      const project = await this.steps.step(repo, 'open', errors, () => this.deps.openRemote(repo))
      if (project === null) return
      this.startWatching(repo, errors)
      await refreshCollabRepo(project, this.collabRepoSteps(project, errors))
      await refreshOtherRepos(project, this.otherReposSteps(project, errors))
      await this.steps.step(repo, 'organization:webhook', errors, () => this.deps.webhooks.check(repo, project.gitea.owner))
    })
    if (record === 'busy') return record
    if (record.error !== null) this.deps.log.warn(`刷新 ${repo} 出错：${record.error}`)
    if (!this.refreshedOnce(repo)) {
      this.refreshed.add(repoKeyOf(repo))
      this.deps.onChange(repo)
    }
    await this.subscription.sync()
    return record
  }

  async refreshAll(): Promise<Array<{ repo: string; check: RefreshRecord | 'busy' }>> {
    const records: Array<{ repo: string; check: RefreshRecord | 'busy' }> = []
    for (const repo of this.current()) records.push({ repo, check: await this.refresh(repo) })
    return records
  }

  /** 按一批消息只做那几处：消息说的是协作仓就交给协作仓那一套，别的仓交给别的仓那一套，组织里建了仓就补克隆 */
  async applyEvents(repo: string, events: PushEvent[]): Promise<RefreshRecord | 'busy'> {
    const record = await this.steps.exclusively(repo, false, async (errors) => {
      const project = await this.steps.step(repo, 'open', errors, () => this.deps.openRemote(repo))
      if (project === null) return
      for (const event of distinctEvents(events)) {
        if (event.kind === 'repo') await applyRepoEvent(project, event, this.otherReposSteps(project, errors))
        else if (sameRepoName(event.repo, project.gitea.repo)) await applyCollabRepoEvent(project, event, this.collabRepoSteps(project, errors))
        else await applyOtherRepoEvent(project, event, this.otherReposSteps(project, errors))
      }
    })
    if (record !== 'busy' && record.error !== null) this.deps.log.warn(`按推送处理 ${repo} 出错：${record.error}`)
    return record
  }

  /** 协作仓那一套这一次的各步：出错记在这个项目上、加进这一次的 errors */
  private collabRepoSteps(project: RemoteProject, errors: string[]): CollabRepoSteps {
    return { handlers: this.deps.collabRepo, runStep: (name, work) => this.steps.step(project.repo, name, errors, work) }
  }

  /** 别的仓那一套这一次的各步：出错记在这个项目上、加进这一次的 errors */
  private otherReposSteps(project: RemoteProject, errors: string[]): OtherReposSteps {
    return { handlers: this.deps.otherRepos, runStep: (name, work) => this.steps.step(project.repo, name, errors, work), log: this.deps.log }
  }

  /** 两边开始监视本机的仓；已经在监视的不动，开始不了的记成出错，下一次完整刷新再试 */
  private startWatching(repo: string, errors: string[] = []): void {
    this.steps.stepSync(repo, 'collab-repo:watch', errors, () => this.deps.collabRepo.startWatching(repo))
    this.steps.stepSync(repo, 'other-repos:watch', errors, () => this.deps.otherRepos.startWatching(repo))
  }

  /** 调度器轮到时项目可能已经移出列表：移出的不做，免得给它重新记下状态 */
  private async whileListed<T>(repo: string, work: () => Promise<T>): Promise<T | 'removed'> {
    if (!this.current().some((each) => sameRepo(each, repo))) return 'removed'
    return work()
  }

  /** 加进项目列表（核对见 ProjectList.add），之后开始监视两边的仓、启动站点、刷新一次，刷新完把它的组织加进订阅 */
  async add(repo: string): Promise<{ repo: string }> {
    await this.list.add(repo)
    this.deps.onListChanged(repo, 'added')
    await this.steps.notifyWhenStepErrorsChange(repo, async () => this.startWatching(repo))
    void this.deps.sites.keep(repo)
    this.scheduler.request(repo, 'full')
    return { repo }
  }

  /** 移出列表：两边都忘掉它，停掉站点，再核对一次订阅 */
  async remove(repo: string): Promise<{ repo: string }> {
    await this.list.remove(repo)
    this.deps.onListChanged(repo, 'removed')
    const key = repoKeyOf(repo)
    this.deps.collabRepo.forget(repo)
    this.deps.otherRepos.forget(repo)
    this.deps.webhooks.forget(repo)
    this.steps.forget(repo)
    this.refreshed.delete(key)
    await this.deps.sites.forget(repo)
    await this.subscription.sync()
    return { repo }
  }

  pushStatus(): PushStatus {
    return this.subscription.status()
  }
}
