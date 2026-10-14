import { existsSync } from 'node:fs'
import path from 'node:path'
import { collabPathInRepo, sitePathInRepo } from '@godcreator/collab'
import { changedFilesBetween, leadOnlyProblems } from '@godcreator/collab/node'
import { pnpmTypecheck, type SiteTypecheck, type TypecheckSite } from '../../site-process/dependencies.js'
import { CollabRejected } from '../../errors.js'
import type { GiteaRepo } from '../../gitea-api/gitea.js'
import { fetchOrigin, git, gitMessageOf, runGit } from '../../git/git.js'
import { aheadBehind, conflictedFilesOf, currentBranch, filesUnder, isMerging, localBranch, statusEntriesOf, upstream, whereYouAre } from '../../git/status.js'
import type { Project, RemoteProject } from '../../project/project.js'
import { collabProblems, problemsAfterMainMergedIn, siteProblemsOf } from './submit-checks.js'

/** 提交审核只在 main 上做；在别的分支上直接拒绝，写明当前在哪 */
export function requireMainBranch(current: string, action: string): void {
  if (current === localBranch) return
  throw new CollabRejected(`${whereYouAre(current)}；协作仓只用 main 一条分支，${action}只在 main 上做`)
}

export type SubmitResult = {
  /** 这次新建的提交；collab/ 与 site/ 都没有改动、只推送已有提交时为 null */
  commit: string | null
  /** 这次提交里 site/ 下改了几个文件 */
  siteFiles: number
  /** site/ 有改动时提交前的类型检查：passed 跑过且通过，no-script 是站点没写 typecheck 脚本；site/ 没有改动时为 null */
  siteTypecheck: SiteTypecheck | null
  /** 执行器合并了的合并请求 */
  pull: { number: number; url: string }
}

/** 等执行器给结论的时限与查询间隔；执行器通常十几秒内合并或打回，容器重建后第一次要先装 Node 与检查工具，留足余量 */
export type VerdictWait = { timeoutMilliseconds: number; pollMilliseconds: number }

const defaultVerdictWait: VerdictWait = { timeoutMilliseconds: 180_000, pollMilliseconds: 2_000 }

/** 提交说明：按这次带了记录、页面还是两样都有 */
function commitMessageOf(person: string, hasRecords: boolean, hasSite: boolean): string {
  if (hasRecords && hasSite) return `${person} 的协作记录与页面改动`
  return hasSite ? `${person} 的页面改动` : `${person} 的协作记录`
}

/**
 * 提交 collab/ 与 site/：暂存区里别的文件不带上。上次提交审核把 main 合进来时出了冲突、人已经改好的，就完成那次合并，
 * 合并提交本来就包含合并进来的全部改动
 */
async function commitRecordsAndSite(project: Project, collabChanges: number, siteChanges: number): Promise<string | null> {
  const merging = await isMerging(project.repo)
  if (!merging && collabChanges + siteChanges === 0) return null
  // 没有 site/ 的仓也能提交：git add 遇到一个都对不上的路径会直接失败
  const paths = [collabPathInRepo, sitePathInRepo].filter((dir) => existsSync(path.join(project.repo, dir)))
  await git(project.repo, ['add', '--all', '--', ...paths])
  if (merging) await git(project.repo, ['commit', '--no-edit'])
  else await git(project.repo, ['commit', '-m', commitMessageOf(project.person, collabChanges > 0, siteChanges > 0), '--', ...paths])
  return (await git(project.repo, ['rev-parse', 'HEAD'])).trim()
}

/** site/ 有改动时提交前的检查：站点检查不过、类型检查没通过，都不提交 */
async function checkSiteBeforeSubmit(project: Project, typecheck: TypecheckSite): Promise<SiteTypecheck> {
  const problems = await siteProblemsOf(project)
  if (problems.length > 0) throw new CollabRejected(`site/ 的站点检查不过，没有提交：\n${problems.join('\n')}`)
  return typecheck(project.siteDir)
}

/**
 * 推送前把 origin/main 合进本地 main，推上去的就是和最新 main 合好的结果。有冲突就停在半路、冲突标记留在文件里，
 * 人配合 AI 改好后再提交审核，那次提交完成这次合并
 */
async function mergeMainIn(project: Project): Promise<void> {
  if ((await aheadBehind(project.repo)).behind === 0) return
  const merge = await runGit(project.repo, ['merge', '--no-edit', upstream])
  if (merge.code === 0) return
  const conflicted = await conflictedFilesOf(project.repo)
  if (conflicted.length === 0) throw new CollabRejected(`把 ${upstream} 合进来失败，没有推送：\n${gitMessageOf(merge)}`)
  throw new CollabRejected(
    `把 ${upstream} 合进来有冲突，没有推送；冲突标记留在这些文件里（网站顶部的提示栏也会列出来）：\n${conflicted.join('\n')}\n让 AI 按两边的意思改好，再运行 collab.submit`,
  )
}

/**
 * 合并请求的标题：按推上去的改动比 main 多了记录、页面还是两样都有，和提交说明同一套写法。
 * 不给的话 Gitea 取最后一个提交的说明，先合了 main 时就成了「Merge remote-tracking branch」
 */
async function pullTitleOf(project: Project, base: string): Promise<string> {
  const changed = (await git(project.repo, ['diff', '--name-only', base, 'HEAD'])).split('\n')
  const touches = (dir: string) => changed.some((file) => file.startsWith(`${dir}/`))
  return commitMessageOf(project.person, touches(collabPathInRepo), touches(sitePathInRepo))
}

/** Gitea 在 AGit 推送的输出里写合并请求的网页地址 */
export function pullOfPushOutput(output: string): { number: number; url: string } | null {
  const match = /(https?:\/\/\S+\/pulls\/(\d+))/.exec(output)
  return match === null ? null : { number: Number(match[2]), url: match[1]! }
}

/** 本地 main 退回推送时的 origin/main，这次提交的内容留在工作区，变回没提交的改动 */
async function returnToWorkingTree(repo: string, base: string): Promise<void> {
  await git(repo, ['reset', '--mixed', base])
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

/** 一直查到合并请求关闭（合并或打回）；超过时限还开着回 timeout */
async function verdictOf(gitea: GiteaRepo, number: number, wait: VerdictWait): Promise<'merged' | 'rejected' | 'timeout'> {
  const deadline = Date.now() + wait.timeoutMilliseconds
  for (;;) {
    const state = await gitea.pullState(number)
    if (!state.open) return state.merged ? 'merged' : 'rejected'
    if (Date.now() >= deadline) return 'timeout'
    await sleep(wait.pollMilliseconds)
  }
}

/**
 * 提交审核：在 main 上一起提交 collab/ 与 site/ 的改动，把 origin/main 合进来，推送到 refs/for/main（主题固定是自己的身份，不建分支），
 * 再等执行器的结论。合并了就回执；被打回、或执行器到时限还没给结论（这时插件关掉合并请求），本地 main 退回推送时的 origin/main，
 * 改动回到工作区，报出原因。校验不过就不提交、不推送；改了只有负责人能改的内容、自己又不是负责人（Gitea 上协作仓的协作者）时，
 * 不推送、改动退回工作区（和执行器同一项检查）
 */
export async function submitCollab(project: RemoteProject, gitea: GiteaRepo, typecheck: TypecheckSite = pnpmTypecheck, wait: VerdictWait = defaultVerdictWait): Promise<SubmitResult> {
  requireMainBranch(await currentBranch(project.repo), '提交审核')
  await fetchOrigin(project.repo, project.remote.env)
  const problems = await collabProblems(project)
  if (problems.length > 0) {
    throw new CollabRejected(`collab/ 校验不过，没有提交：\n${problems.map((problem) => `${problem.file}  ${problem.message}`).join('\n')}`)
  }
  const entries = await statusEntriesOf(project.repo)
  const [collabChanges, siteChanges] = [filesUnder(entries, collabPathInRepo), filesUnder(entries, sitePathInRepo)]
  const siteTypecheck = siteChanges.length > 0 ? await checkSiteBeforeSubmit(project, typecheck) : null
  const commit = await commitRecordsAndSite(project, collabChanges.length, siteChanges.length)
  if ((await aheadBehind(project.repo)).ahead === 0) throw new CollabRejected('没有要提交的：collab/ 与 site/ 都没有改动，本地 main 上也没有 origin/main 里还没有的提交')
  await mergeMainIn(project)

  const base = (await git(project.repo, ['rev-parse', upstream])).trim()
  const afterMerge = await problemsAfterMainMergedIn(project, base)
  if (afterMerge.length > 0) {
    await returnToWorkingTree(project.repo, base)
    throw new CollabRejected(`把 main 合进来之后有新问题，没有推送，改动留在工作区（没提交）：\n${afterMerge.join('\n')}`)
  }
  const authorIsLead = (await gitea.collaborators()).includes(project.person)
  const leadOnly = await leadOnlyProblems({
    repo: project.repo,
    base,
    head: 'HEAD',
    authorIsLead,
    author: project.person,
    changedFiles: await changedFilesBetween(project.repo, base, 'HEAD'),
  })
  if (leadOnly.length > 0) {
    await returnToWorkingTree(project.repo, base)
    throw new CollabRejected(`没有推送，改动留在工作区（没提交）：${leadOnly.join('；')}`)
  }
  const push = await runGit(project.repo, ['push', 'origin', 'HEAD:refs/for/main', '-o', `topic=${project.person}`, '-o', `title=${await pullTitleOf(project, base)}`], project.remote.env)
  if (push.code !== 0) {
    await returnToWorkingTree(project.repo, base)
    throw new CollabRejected(`推送失败，改动已退回工作区（没提交）：\n${gitMessageOf(push)}`)
  }
  const pull = pullOfPushOutput(gitMessageOf(push))
  if (pull === null) throw new CollabRejected(`推送成功了，但 Gitea 的输出里找不到合并请求的地址，没法等执行器的结论：\n${gitMessageOf(push)}`)

  const verdict = await verdictOf(gitea, pull.number, wait)
  if (verdict === 'merged') return { commit, siteFiles: siteChanges.length, siteTypecheck, pull }
  if (verdict === 'timeout') await gitea.close(pull.number)
  await returnToWorkingTree(project.repo, base)
  if (verdict === 'timeout') {
    throw new CollabRejected(
      `执行器 ${wait.timeoutMilliseconds / 1000} 秒内没有给结论，NAS 上的执行器可能没在运行：已关掉合并请求 #${pull.number}，改动退回工作区（没提交）。告诉负责人去看执行器，好了再提交审核`,
    )
  }
  const reason = (await gitea.lastComment(pull.number)) ?? '（合并请求上没有留言）'
  throw new CollabRejected(`没有合并：合并请求 #${pull.number} 被关闭，改动退回工作区（没提交）。原因：\n${reason}`)
}
