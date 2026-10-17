import { fetchOrigin } from '../../git/git.js'
import { repoKeyOf, type RemoteProject } from '../../project/project.js'
import type { InstallDependencies, SiteControl } from '../../site-process/dependencies.js'
import { collabRepoLocalStateOf, type CollabRepoLocalState } from './local-state.js'
import { autoSyncCollab, type AutoSyncResult } from './sync.js'
import { watchCollabRepo, type CollabRepoWatcher } from './watch.js'

export { collabRepoLocalStateOf, type CollabRepoLocalState } from './local-state.js'

/** collab/、site/、sources/ 都没有还没提交审核的文件，也没有冲突；仓里别处的改动不算 */
function hasNoUnsubmittedFilesOrConflicts({ unsubmitted, conflicts }: CollabRepoLocalState): boolean {
  return unsubmitted.records.length === 0 && unsubmitted.siteFiles.length === 0 && unsubmitted.sourceFiles.length === 0 && conflicts.length === 0
}

/** 一个项目最近一次自动同步：什么时候、结果 */
export type SyncRecord = { at: string } & AutoSyncResult

export type CollabRepoSyncDeps = {
  sites: SiteControl
  install: InstallDependencies
  /** 本机状态或自动同步的结果变了 */
  onChange(repo: string): void
  /** 自动同步后协作仓没有东西可提交了：collab/、site/、sources/ 没有改动、没有冲突，本地 main 不领先 origin/main */
  onNothingToSubmit(repo: string): void
  log: { warn(message: string): void }
  now(): Date
  /** 协作仓的文件接连变化时，停下这么久没有新变化才重算 */
  settleMilliseconds: number
}

type Watched = { latest: CollabRepoLocalState | null; watcher: CollabRepoWatcher }

/**
 * 协作仓那一边的本机状态与自动同步，按项目仓根记：盯着协作仓算本机状态（还没提交审核的文件、冲突、当前分支），
 * 取回 origin、能快进就快进，记下最近一次自动同步的结果
 */
export class CollabRepoSync {
  private readonly watched = new Map<string, Watched>()
  private readonly lastSyncs = new Map<string, SyncRecord>()

  constructor(private readonly deps: CollabRepoSyncDeps) {}

  /** 开始盯一个项目的协作仓；已经在盯就不动。开始不了（目录不存在、读不了）直接抛 */
  startWatching(repo: string): void {
    const key = repoKeyOf(repo)
    if (this.watched.has(key)) return
    const watched: Watched = { latest: null, watcher: { close: () => {} } }
    watched.watcher = watchCollabRepo(repo, {
      onChange: (state) => {
        watched.latest = state
        this.deps.onChange(repo)
      },
      onError: (message) => this.deps.log.warn(`${repo}：${message}`),
      settleMilliseconds: this.deps.settleMilliseconds,
    })
    this.watched.set(key, watched)
  }

  /** 此刻的本机状态：盯着的最新一份；还没算出第一份（刚加载、刚加进列表、没能开始盯）就现算一次 */
  async localStateOf(repo: string): Promise<CollabRepoLocalState> {
    return this.watched.get(repoKeyOf(repo))?.latest ?? collabRepoLocalStateOf(repo)
  }

  /** 用令牌取回协作仓的 origin */
  async fetch(project: RemoteProject): Promise<void> {
    await fetchOrigin(project.repo, project.remote.env)
  }

  /** 能快进就快进（见 autoSyncCollab），记下结果；接着看协作仓还有没有东西可提交，没有就调 onNothingToSubmit。不取回 */
  async autoSync(project: RemoteProject): Promise<void> {
    const result = await autoSyncCollab(project, this.deps.sites, this.deps.install)
    const previousProblem = this.syncProblemOf(project.repo)
    this.lastSyncs.set(repoKeyOf(project.repo), { at: this.deps.now().toISOString(), ...result })
    if (this.syncProblemOf(project.repo) !== previousProblem) this.deps.onChange(project.repo)
    // 跳过时（不在 main、没有 origin/main、合并没完成、本地 main 领先、工作区的改动挡着快进）都还有东西没交或不能断定
    if (result.outcome !== 'skipped' && hasNoUnsubmittedFilesOrConflicts(await collabRepoLocalStateOf(project.repo))) this.deps.onNothingToSubmit(project.repo)
  }

  /** 这次加载后最近一次自动同步；还没同步过为 null */
  lastSyncOf(repo: string): SyncRecord | null {
    return this.lastSyncs.get(repoKeyOf(repo)) ?? null
  }

  /** 最近一次没能自动同步的原因；同步了、本来一样新、还没同步过为 null */
  syncProblemOf(repo: string): string | null {
    const last = this.lastSyncOf(repo)
    return last?.outcome === 'skipped' ? last.reason : null
  }

  /** 项目移出列表：不再盯，忘掉自动同步的结果 */
  forget(repo: string): void {
    const key = repoKeyOf(repo)
    this.watched.get(key)?.watcher.close()
    this.watched.delete(key)
    this.lastSyncs.delete(key)
  }

  closeAll(): void {
    for (const watched of this.watched.values()) watched.watcher.close()
    this.watched.clear()
  }
}
