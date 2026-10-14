import { sitePathInRepo } from '@godcreator/collab'
import { installSiteDependencies, type InstallDependencies, type SiteControl } from '../../site-process/dependencies.js'
import { CollabRejected } from '../../errors.js'
import { git, gitMessageOf, runGit } from '../../git/git.js'
import { aheadBehind, fastForwardObstacleOf, upstream, whereYouAre } from '../../git/status.js'
import type { RemoteProject } from '../../project/project.js'

const siteDependencyFiles = ['site/package.json', 'site/pnpm-lock.yaml']

/**
 * 不能快进的原因；能快进为 null。本地 main 上平时没有 main 里没有的提交（提交审核要么合并、要么把改动退回工作区），
 * 有就是提交审核正在等执行器，或者合 main 出的冲突还没改好，这两种都不同步
 */
async function whyNotFastForward(repo: string): Promise<string | null> {
  const obstacle = await fastForwardObstacleOf(repo)
  if (obstacle === null) return null
  if (obstacle.kind === 'off-main') return `${whereYouAre(obstacle.branch)}：协作仓只用 main 一条分支，只在 main 上自动同步`
  if (obstacle.kind === 'no-upstream') return `仓里没有 ${upstream}：检查取回失败过，再运行一次 collab.check`
  if (obstacle.kind === 'merging') return '提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核'
  return '本地 main 上有还没进 main 的提交：提交审核正在等执行器，或者上次提交审核中途断了，再运行一次 collab.submit'
}

/** 检查里自动同步的结果：快进进来了（几个提交、装没装依赖）、本来就一样新、不能自动同步的原因 */
export type AutoSyncResult =
  | { outcome: 'merged'; commits: number; dependenciesInstalled: boolean; siteRestarted: boolean }
  | { outcome: 'up-to-date' }
  | { outcome: 'skipped'; reason: string }

/**
 * 检查取回之后自动同步：在 main 上、能快进就快进；快进进来的改动动了 site/ 的依赖就接着装（装完按常驻的规矩启动，启动前查站点），
 * 只动了 site/ 别的文件就让站点再过一遍启动前的检查。
 * 不满足就什么都不动、写明原因，网站提示栏照原因列出。不取回远端（检查刚取回过）
 */
export async function autoSyncCollab(project: RemoteProject, sites: SiteControl, install: InstallDependencies): Promise<AutoSyncResult> {
  const blocked = await whyNotFastForward(project.repo)
  if (blocked !== null) return { outcome: 'skipped', reason: blocked }
  const { behind } = await aheadBehind(project.repo)
  if (behind === 0) return { outcome: 'up-to-date' }

  const headBefore = (await git(project.repo, ['rev-parse', 'HEAD'])).trim()
  const merge = await runGit(project.repo, ['merge', '--ff-only', upstream])
  // 快进失败只剩工作区的改动会被覆盖这一种：git 这时什么都没动
  if (merge.code !== 0) {
    return { outcome: 'skipped', reason: `工作区里没提交的改动和 main 上的新改动碰到了同一个文件：提交审核时会把 main 合进来，冲突由人配合 AI 改好\n${gitMessageOf(merge)}` }
  }
  const head = (await git(project.repo, ['rev-parse', 'HEAD'])).trim()
  const dependenciesChanged = (await git(project.repo, ['diff', '--name-only', headBefore, head, '--', ...siteDependencyFiles])).trim() !== ''
  if (!dependenciesChanged) {
    const siteChanged = (await git(project.repo, ['diff', '--name-only', headBefore, head, '--', `${sitePathInRepo}/`])).trim() !== ''
    if (siteChanged) await sites.recheck(project)
    return { outcome: 'merged', commits: behind, dependenciesInstalled: false, siteRestarted: false }
  }
  try {
    const installed = await installSiteDependencies(project, sites, install)
    return { outcome: 'merged', commits: behind, dependenciesInstalled: true, siteRestarted: installed.siteRestarted }
  } catch (error) {
    if (!(error instanceof CollabRejected)) throw error
    throw new CollabRejected(`自动同步已快进到 ${upstream}（HEAD ${head}），快进进来的改动动了 site/ 的依赖，接着装依赖失败：\n${error.message}`)
  }
}
