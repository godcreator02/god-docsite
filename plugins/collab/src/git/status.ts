import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { git, gitMessageOf, runGit } from './git.js'

/** 项目里的仓都只用 main 一条分支，上游是 origin 的 main */
export const localBranch = 'main'
export const upstream = 'origin/main'

/** 只读地运行 git：--no-optional-locks 让 git status 不去刷新 index；git 状态的追踪监视着 index，刷新了会引来下一次重算 */
export function readGit(repo: string, args: string[]): Promise<string> {
  return git(repo, ['--no-optional-locks', ...args])
}

/** 当前分支名；分离的 HEAD 是空串 */
export async function currentBranch(repo: string): Promise<string> {
  return (await readGit(repo, ['branch', '--show-current'])).trim()
}

/** 有一次合并还没完成（提交审核把 main 合进来出了冲突、还没提交） */
export async function isMerging(repo: string): Promise<boolean> {
  return (await runGit(repo, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'])).code === 0
}

/** 本机有没有 origin/main：服务器上的仓还没有 main、或者还没取回过时没有 */
export async function hasUpstream(repo: string): Promise<boolean> {
  return hasRef(repo, `refs/remotes/${upstream}`)
}

/** 本机有没有这个引用 */
async function hasRef(repo: string, ref: string): Promise<boolean> {
  const output = await runGit(repo, ['--no-optional-locks', 'rev-parse', '--verify', '--quiet', ref])
  if (output.code === 0) return true
  if (output.code === 1) return false
  throw new Error(`git rev-parse --verify ${ref} 失败：${gitMessageOf(output)}`)
}

/** HEAD 与一个引用比，多几个、少几个提交（rev-list --left-right --count HEAD...ref） */
async function countsAgainstRef(repo: string, ref: string): Promise<{ ahead: number; behind: number }> {
  const [ahead, behind] = (await readGit(repo, ['rev-list', '--left-right', '--count', `HEAD...${ref}`])).trim().split(/\s+/).map(Number)
  return { ahead: ahead!, behind: behind! }
}

/** 当前分支比上次取回的 origin/main 多几个、少几个提交；要先确定有 origin/main */
export async function aheadBehind(repo: string): Promise<{ ahead: number; behind: number }> {
  return countsAgainstRef(repo, `refs/remotes/${upstream}`)
}

/**
 * 当前分支和服务器上的同名分支（上次取回的 origin/<分支>）比，多几个、少几个提交。
 * 服务器上没有这个分支、或在分离的 HEAD 上时，多的是 HEAD 上哪个 origin 分支都没有的提交，少的算 0；还没有提交的空仓两样都是 0
 */
export async function serverCountsOf(repo: string, branch: string): Promise<{ ahead: number; behind: number }> {
  const serverBranch = `refs/remotes/origin/${branch}`
  if (branch !== '' && (await hasRef(repo, serverBranch))) return countsAgainstRef(repo, serverBranch)
  if (!(await hasRef(repo, 'HEAD'))) return { ahead: 0, behind: 0 }
  return { ahead: Number((await readGit(repo, ['rev-list', '--count', 'HEAD', '--not', '--remotes=origin'])).trim()), behind: 0 }
}

/** git status 的一条：两位状态码与路径（相对仓根）；改名、复制的原路径也记一条，状态码相同 */
export type StatusEntry = { code: string; file: string }

/** 仓里没提交的改动（包括没被跟踪、也没被忽略的新文件），按路径排序 */
export async function statusEntriesOf(repo: string): Promise<StatusEntry[]> {
  const output = await readGit(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  const fields = output.split('\0').filter((field) => field !== '')
  const entries: StatusEntry[] = []
  for (let index = 0; index < fields.length; index++) {
    const entry = fields[index]!
    const code = entry.slice(0, 2)
    entries.push({ code, file: entry.slice(3) })
    if (code[0] === 'R' || code[0] === 'C') entries.push({ code, file: fields[++index]! })
  }
  return entries.sort((a, b) => a.file.localeCompare(b.file))
}

/** 合并没完成的文件：状态码里有 U，或两边都加了（AA）、都删了（DD） */
export function isUnmerged(entry: StatusEntry): boolean {
  return entry.code.includes('U') || entry.code === 'AA' || entry.code === 'DD'
}

/** 一批状态里合并出冲突、还没改好的文件（相对仓根）；已经有 status 输出的调用方用它，不再多跑一次 git status */
export function conflictedFilesAmong(entries: readonly StatusEntry[]): string[] {
  return entries.filter(isUnmerged).map((entry) => entry.file)
}

/** 合并出冲突、还没改好的文件（相对仓根） */
export async function conflictedFilesOf(repo: string): Promise<string[]> {
  return conflictedFilesAmong(await statusEntriesOf(repo))
}

/** 某个目录下没提交的文件，相对这个目录 */
export function filesUnder(entries: StatusEntry[], dir: string): string[] {
  return entries.filter((entry) => entry.file.startsWith(`${dir}/`)).map((entry) => entry.file.slice(dir.length + 1))
}

/** 一个目录下每个 git 仓的目录名（底下有 .git 的；目录联接、符号链接指向的也算），按名字排序 */
export function gitReposIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => existsSync(path.join(dir, name, '.git')))
    .sort()
}

/** 回执里「当前在分离的 HEAD / 分支 X 上」这句；branch 是 currentBranch 的输出 */
export function whereYouAre(branch: string): string {
  return `当前在${branch === '' ? '分离的 HEAD' : `分支 ${branch}`} 上`
}

/**
 * 不能快进的原因（能快进为 null）：不在 main 上、没有 origin/main、有还没完成的合并、本地 main 领先于 origin/main，
 * 按这个顺序查。协作仓的自动同步与别的仓的更新（collab.repos.update）都按它查，各配自己的提示原话
 */
export type FastForwardObstacle = { kind: 'off-main'; branch: string } | { kind: 'no-upstream' } | { kind: 'merging' } | { kind: 'ahead'; ahead: number }

export async function fastForwardObstacleOf(repo: string): Promise<FastForwardObstacle | null> {
  const branch = await currentBranch(repo)
  if (branch !== localBranch) return { kind: 'off-main', branch }
  if (!(await hasUpstream(repo))) return { kind: 'no-upstream' }
  if (await isMerging(repo)) return { kind: 'merging' }
  const { ahead } = await aheadBehind(repo)
  return ahead > 0 ? { kind: 'ahead', ahead } : null
}
