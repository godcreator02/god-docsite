import { collabPathInRepo, newFormatProblems, sitePathInRepo, type CollabProblem } from '@godcreator/collab'
import { journalProblemsOf, readCollabSnapshot } from '@godcreator/collab/node'
import { git } from '../../git/git.js'
import { upstream } from '../../git/status.js'
import type { Project } from '../../project/project.js'
import type { DocsiteCheck } from '../../site-process/dependencies.js'
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

/**
 * 提交前的站点检查，前面带上 site/：site/journal/ 的文件名（站点布局的 loader 也按它读，不合规矩整站打不开），一条一句话；
 * 站点自己那一版的 docsite-check（内容放法、引用的条目本站都有；放错的页面会从侧栏消失、build 会失败，引用了没发布的条目组员打开是「本站没有这条」，
 * dev 只报不拦，所以在进 main 之前拦），没过时它列的问题原样作一条。
 * 其余的站点问题（依赖装没装、基础包版本、页面起不起得来）由 gwb-docsite 启动时查；类型由 site/ 的 typecheck 脚本查
 */
export async function siteProblemsOf(project: Project, docsiteCheck: DocsiteCheck): Promise<string[]> {
  const journal = journalProblemsOf(project.siteDir).map((problem) => `${sitePathInRepo}/  ${problem}`)
  const check = await docsiteCheck(project.siteDir)
  return [...journal, ...(check.passed ? [] : [`${sitePathInRepo}/ 的 docsite-check 没过：\n${check.report}`])]
}

/**
 * 把 main 合进本地 main 之后再查一遍：合并后的 collab/ 比 base（合进来的那个 origin/main）多出的格式问题每条写明文件；
 * site/ 有改动时再做一遍站点检查（这时工作区里的 site/ 就是合并的结果）。
 * 两个人各自没问题、凑在一起才出的问题只有这一步能发现；执行器不查记录格式与站点
 */
export async function problemsAfterMainMergedIn(project: Project, base: string, docsiteCheck: DocsiteCheck): Promise<string[]> {
  const format = newFormatProblems(await readCollabSnapshotAtRevision(project.repo, base), await readCollabSnapshotAtRevision(project.repo, 'HEAD')).map(
    (problem) => `${collabPathInRepo}/${problem.file}  ${problem.message}`,
  )
  const siteChanged = (await git(project.repo, ['diff', '--name-only', '-z', base, 'HEAD', '--', `${sitePathInRepo}/`])) !== ''
  return [...format, ...(siteChanged ? await siteProblemsOf(project, docsiteCheck) : [])]
}
