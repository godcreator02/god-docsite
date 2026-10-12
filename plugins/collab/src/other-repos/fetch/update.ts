import { CollabRejected } from '../../errors.js'
import { gitMessageOf, runGit } from '../../git/git.js'
import { aheadBehind, fastForwardObstacleOf, upstream, whereYouAre } from '../../git/status.js'
import { otherRepoDirOf, type RemoteProject } from '../../project/project.js'

/** 快进做成了：快进进来几个提交，或者本来就和 origin/main 一样新 */
export type RepoUpdateReceipt = { repo: string; outcome: 'merged'; commits: number } | { repo: string; outcome: 'up-to-date' }

/** 不能快进就拒绝，写明原因、什么都不动。只看本机，要先取回远端才准 */
async function requireFastForwardable(name: string, repoDir: string): Promise<void> {
  const refuse = (reason: string) => new CollabRejected(`没有更新 ${name}：${reason}`)
  const obstacle = await fastForwardObstacleOf(repoDir)
  if (obstacle === null) return
  if (obstacle.kind === 'off-main') throw refuse(`${whereYouAre(obstacle.branch)}：只更新 main，切回 main 才会更新`)
  if (obstacle.kind === 'no-upstream') throw refuse(`仓里没有 ${upstream}：服务器上这个仓还没有 main，或者还没取回过`)
  if (obstacle.kind === 'merging') throw refuse('有一次合并还没完成（MERGE_HEAD 还在）：先完成或放弃那次合并')
  throw refuse(`本地 main 上有服务器上没有的提交（${obstacle.ahead} 个）：合并请求还没合并，或者是没推上去的提交`)
}

/**
 * collab.repos.update：用令牌取回这个仓，再把 main 快进到 origin/main。条件不满足就拒绝、什么都不动：
 * 在 main 上、有 origin/main、没有进行中的合并、本地 main 没有服务器上没有的提交、没提交的改动不和新改动碰同一个文件（这一条由 git merge --ff-only 判断）。
 * merge 带上 remote.env：LFS 文件在检出时下载，要令牌的请求头
 */
export async function updateOtherRepo(project: RemoteProject, name: string): Promise<RepoUpdateReceipt> {
  const repoDir = otherRepoDirOf(project, name)
  const fetched = await runGit(repoDir, ['fetch', 'origin'], project.remote.env)
  if (fetched.code !== 0) throw new CollabRejected(`取回 ${name} 失败：${gitMessageOf(fetched)}`)
  await requireFastForwardable(name, repoDir)
  const { behind } = await aheadBehind(repoDir)
  if (behind === 0) return { repo: name, outcome: 'up-to-date' }
  const merge = await runGit(repoDir, ['merge', '--ff-only', upstream], project.remote.env)
  // 快进失败只剩没提交的改动会被覆盖这一种：git 这时什么都没动
  if (merge.code !== 0) throw new CollabRejected(`没有更新 ${name}：没提交的改动和新改动碰到了同一个文件：先提交或收起这些改动再更新\n${gitMessageOf(merge)}`)
  return { repo: name, outcome: 'merged', commits: behind }
}
