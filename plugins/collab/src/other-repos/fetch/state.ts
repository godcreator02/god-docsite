import path from 'node:path'
import { projectDirOfCollabRepo } from '@godcreator/collab/node'
import { CollabRejected } from '../../errors.js'
import { gitMessageOf, runGit } from '../../git/git.js'
import { otherRepoNamesOf, repoKeyOf, type GitRemote, type RemoteProject } from '../../project/project.js'
import { cloneMissingRepos, type OrganizationSource } from './clone-new-repos.js'
import { otherRepoHeadOf, type OtherRepoHead } from './head.js'
import { watchOtherRepoHeads, type OtherReposWatcher } from './watch.js'

export { otherRepoHeadOf, type OtherRepoHead } from './head.js'

/** 用令牌对项目文件夹里协作仓以外的一个仓 git fetch origin，只取回、不动它的分支与工作区；name 是项目文件夹里的目录名 */
export async function fetchOtherRepo(collabRepo: string, name: string, remote: GitRemote): Promise<void> {
  const fetched = await runGit(path.join(projectDirOfCollabRepo(collabRepo), name), ['fetch', 'origin'], remote.env)
  if (fetched.code !== 0) throw new CollabRejected(`取回 ${name} 失败：${gitMessageOf(fetched)}`)
}

export type OtherReposFetchDeps = {
  /** 某个项目别的仓的 HEAD 状态变了 */
  onChange(repo: string): void
  log: { warn(message: string): void }
  /** 引用接连变化时，停下这么久没有新变化才重算 */
  settleMilliseconds: number
}

type Watched = { latest: OtherRepoHead[] | null; watcher: OtherReposWatcher }

/**
 * 别的仓那一边的取回，按项目仓根记：取回、补克隆组织里新加的仓，盯着各仓的 HEAD 和服务器上的同名分支比。
 * 只取回，不动这些仓的分支与工作区；人要求时才快进（见 update.ts）
 */
export class OtherReposFetch {
  private readonly watched = new Map<string, Watched>()

  constructor(private readonly deps: OtherReposFetchDeps) {}

  /** 开始盯一个项目的别的仓；已经在盯就不动。开始不了（项目文件夹不存在、读不了）直接抛 */
  startWatching(collabRepo: string): void {
    const key = repoKeyOf(collabRepo)
    if (this.watched.has(key)) return
    const watched: Watched = { latest: null, watcher: { close: () => {} } }
    watched.watcher = watchOtherRepoHeads(collabRepo, {
      onChange: (heads) => {
        watched.latest = heads
        this.deps.onChange(collabRepo)
      },
      onError: (message) => this.deps.log.warn(`${collabRepo}：${message}`),
      settleMilliseconds: this.deps.settleMilliseconds,
    })
    this.watched.set(key, watched)
  }

  /** 各仓此刻的 HEAD 状态：盯着的最新一份；还没算出第一份就现算一次 */
  async headsOf(collabRepo: string): Promise<OtherRepoHead[]> {
    const latest = this.watched.get(repoKeyOf(collabRepo))?.latest
    if (latest !== undefined && latest !== null) return latest
    const projectDir = projectDirOfCollabRepo(collabRepo)
    return Promise.all(otherRepoNamesOf(collabRepo).map((name) => otherRepoHeadOf(path.join(projectDir, name), name)))
  }

  /** 把组织里新加的仓克隆进项目文件夹，回克隆了哪些（目录名） */
  cloneMissing(project: RemoteProject, source: OrganizationSource): Promise<string[]> {
    return cloneMissingRepos(project.repo, source, project.remote)
  }

  /** 取回一个别的仓；name 是项目文件夹里的目录名 */
  fetch(project: RemoteProject, name: string): Promise<void> {
    return fetchOtherRepo(project.repo, name, project.remote)
  }

  forget(collabRepo: string): void {
    const key = repoKeyOf(collabRepo)
    this.watched.get(key)?.watcher.close()
    this.watched.delete(key)
  }

  closeAll(): void {
    for (const watched of this.watched.values()) watched.watcher.close()
    this.watched.clear()
  }
}
