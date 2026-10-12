import { newFormatProblems, type CollabProblem } from '@godcreator/collab-model/task-model'
import { readCollabSnapshot } from '@godcreator/collab-model/task-model/node'
import { collabPathInRepo, sitePathInRepo } from '@godcreator/collab-model/project-model'
import { collabSiteMdxProblems, collabSiteProblems } from '@godcreator/collab-site/site-check'
import { git } from '../../git/git.js'
import { upstream } from '../../git/status.js'
import type { Project } from '../../project/project.js'
import { readCollabSnapshotAtRevision } from './revision-files.js'

/**
 * 提交前校验工作区里的 collab/：只报这次改动带来的格式问题，参照是本地 main 和 origin/main 的分叉点，
 * 那时就有的问题不算我的。和别人后来合进 main 的记录凑在一起才出的问题，把 main 合进来之后由 problemsAfterMainMergedIn 报
 */
export async function collabProblems(project: Project): Promise<CollabProblem[]> {
  const forkPoint = await forkPointOf(project.repo)
  const atForkPoint = await readCollabSnapshotAtRevision(project.repo, forkPoint)
  return newFormatProblems(atForkPoint, await readCollabSnapshot(project.repo))
}

/** 本地 main 和 origin/main 的分叉点（我还没合进去的提交之前那个）：提交前的校验拿它当参照，那时就有的问题不算我的 */
async function forkPointOf(repo: string): Promise<string> {
  return (await git(repo, ['merge-base', 'HEAD', upstream])).trim()
}

/** 提交前的站点检查：查工作区里的 site/（人员列表、评论、日志页的文件名），再编译 MDX，一条一句话，前面带上 site/ */
export async function siteProblemsOf(project: Project): Promise<string[]> {
  const problems = [...(await collabSiteProblems(project.siteDir)), ...(await collabSiteMdxProblems(project.siteDir))]
  return problems.map((problem) => `${sitePathInRepo}/  ${problem}`)
}

/**
 * 把 main 合进本地 main 之后再查一遍：合并后的 collab/ 比 base（合进来的那个 origin/main）多出的格式问题每条写明文件；
 * site/ 有改动时再做一遍站点检查（这时工作区里的 site/ 就是合并的结果）。
 * 两个人各自没问题、凑在一起才出的问题只有这一步能发现；执行器不查记录格式与站点
 */
export async function problemsAfterMainMergedIn(project: Project, base: string): Promise<string[]> {
  const format = newFormatProblems(await readCollabSnapshotAtRevision(project.repo, base), await readCollabSnapshotAtRevision(project.repo, 'HEAD')).map(
    (problem) => `${collabPathInRepo}/${problem.file}  ${problem.message}`,
  )
  const siteChanged = (await git(project.repo, ['diff', '--name-only', '-z', base, 'HEAD', '--', `${sitePathInRepo}/`])) !== ''
  return [...format, ...(siteChanged ? await siteProblemsOf(project) : [])]
}
