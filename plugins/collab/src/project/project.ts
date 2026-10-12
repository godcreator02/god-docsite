import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { collabPathInRepo, peoplePathInRepo, projectDirOfCollabRepo, sitePathInRepo } from '@godcreator/collab-model/project-model'
import { CollabFormatError, parsePeople, personOfCode, type Person } from '@godcreator/collab-model/task-model'
import { siteTitleOf } from '@godcreator/docsite-kit/files'
import type { JoiningPerson } from '@godcreator/gwb-docsite'
import { CollabRejected } from '../errors.js'
import { isGiteaName, ownerAndRepoOf, type GiteaLocation } from '../gitea-api/gitea.js'
import { git } from '../git/git.js'
import { gitReposIn } from '../git/status.js'

/** 一个项目仓：仓根、collab/ 与 site/ 的位置、本 home 在这个项目里的身份（site/people.json 里的 id，就是 Gitea 用户名） */
export type Project = { repo: string; collabDir: string; siteDir: string; person: string }

/** 联网的 git 调用（fetch、push、clone）要带上的环境变量；生产里由 account.ts 按 gwb-gitea 的令牌拼出 */
export type GitRemote = { env: Record<string, string> }

/** 要联网的命令拿到的项目：已核对过 origin 在配的 Gitea 上、令牌的账号就是身份、仓放在以组织命名的项目文件夹里；gitea 是 origin 在 Gitea 上的位置 */
export type RemoteProject = Project & { remote: GitRemote; gitea: GiteaLocation }

/**
 * 协作仓放在以组织命名的项目文件夹里（「克隆项目」就是这样放的）：项目里别的仓都在这个文件夹里，
 * 取回、列合并请求、克隆新仓都按它找。不是这样放的就拒绝，不猜别的位置
 */
export function requireOrganizationFolder(repo: string, organization: string): void {
  const projectDir = projectDirOfCollabRepo(repo)
  if (path.basename(projectDir).toLowerCase() !== organization.toLowerCase()) {
    throw new CollabRejected(`协作仓 ${repo} 的上一级 ${projectDir} 不是以组织 ${organization} 命名的项目文件夹：用 collab.project.clone 把组织整个克隆一遍，协作仓会放在 <目录>/${organization}/ 下`)
  }
}

/** 项目文件夹里协作仓以外的 git 仓（资料库、代码仓）的目录名，按名字排序 */
export function otherRepoNamesOf(collabRepo: string): string[] {
  return gitReposIn(projectDirOfCollabRepo(collabRepo)).filter((name) => name !== path.basename(collabRepo))
}

/** name 要是项目文件夹里协作仓以外的 git 仓；不是就拒绝，回它的目录 */
export function otherRepoDirOf(project: RemoteProject, name: string): string {
  if (!isGiteaName(name)) throw new CollabRejected(`name 要是项目文件夹里的仓名（只含字母、数字与 _ . -），收到 ${JSON.stringify(name)}`)
  if (name.toLowerCase() === path.basename(project.repo).toLowerCase()) throw new CollabRejected(`${name} 是协作仓：协作仓由检查时的自动同步跟上 main`)
  const projectDir = projectDirOfCollabRepo(project.repo)
  if (!otherRepoNamesOf(project.repo).includes(name)) throw new CollabRejected(`项目文件夹 ${projectDir} 里没有叫 ${name} 的 git 仓`)
  return path.join(projectDir, name)
}

/** 项目文件夹里一个仓（name 是目录名）在 Gitea 上的位置：从它的 origin 读 */
export async function giteaLocationOfRepoIn(collabRepo: string, name: string): Promise<GiteaLocation> {
  return ownerAndRepoOf(await git(path.join(projectDirOfCollabRepo(collabRepo), name), ['remote', 'get-url', 'origin']))
}

/** 带 collab/ 与 site/people.json 的仓是协作仓 */
export function isCollabRepo(repo: string): boolean {
  return existsSync(path.join(repo, collabPathInRepo)) && existsSync(path.join(repo, ...peoplePathInRepo.split('/')))
}

/** 协作仓工作区里的人员列表；读不对时拒绝，写明是 site/people.json 的问题 */
export function peopleOfRepo(repo: string): Person[] {
  try {
    return parsePeople(readFileSync(path.join(repo, ...peoplePathInRepo.split('/')), 'utf8'))
  } catch (error) {
    if (error instanceof CollabFormatError) throw new CollabRejected(error.message)
    throw error
  }
}

/** 项目名：站点的站名；站点还没写站名时用仓的目录名 */
export function projectTitleOf(project: Pick<Project, 'repo' | 'siteDir'>): string {
  return siteTitleOf(project.siteDir) ?? path.basename(project.repo)
}

/** 按项目仓根记东西时用的键：同一个目录在 Windows 上大小写不区分 */
export function repoKeyOf(repo: string): string {
  return path.resolve(repo).toLowerCase()
}

export function sameRepo(a: string, b: string): boolean {
  return repoKeyOf(a) === repoKeyOf(b)
}

/** Gitea 上的两个仓名说的是不是同一个仓：大小写不论 */
export const sameRepoName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Windows 上同一个目录可能有短文件名与长文件名两种写法，大小写也不区分；都换成真实路径再比 */
function sameDirectory(a: string, b: string): boolean {
  const normalize = (dir: string) => realpathSync.native(dir).toLowerCase()
  return normalize(a) === normalize(b)
}

/**
 * 查清 repo 是一个协作仓的仓根，并认出身份：本 home 的身份码（gwb-docsite 的设置 identity-code）在 site/people.json 里对应的那个人。
 * 缺什么就报什么、写明怎么补
 */
export async function openProject(repo: string, identityCode: string): Promise<Project> {
  if (!existsSync(repo)) throw new CollabRejected(`${repo} 不存在`)
  const top = (await git(repo, ['rev-parse', '--show-toplevel'])).trim()
  if (!sameDirectory(top, repo)) throw new CollabRejected(`${repo} 不是仓根，这个仓的仓根是 ${top}`)
  if (!isCollabRepo(repo)) throw new CollabRejected(`${repo} 下没有 ${collabPathInRepo}/ 与 ${peoplePathInRepo}，不是协作仓：要选项目里带这两样的那个仓`)
  const person = personOfCode(peopleOfRepo(repo), identityCode)
  if (person === null) {
    throw new CollabRejected(`本 home 的身份码不在 ${peoplePathInRepo} 里：运行 collab.project.join 把它加进自己那一项（按 gwb-gitea 令牌的账号认人），再 collab.submit 提交审核`)
  }
  return { repo, collabDir: path.join(repo, collabPathInRepo), siteDir: path.join(repo, sitePathInRepo), person: person.id }
}

/**
 * 把本 home 的身份码加进 site/people.json 里 Gitea 账号 login 那一项：一个人可以有几台电脑，各有各的码。
 * 不在列表里就拒绝，加人只有负责人能做。join 是 gwb-docsite 的 gwbDocsite.join
 */
export async function joinProject(repo: string, login: string, join: (siteDir: string, person: JoiningPerson) => Promise<{ changed: boolean }>): Promise<{ person: string; changed: boolean }> {
  if (!isCollabRepo(repo)) throw new CollabRejected(`${repo} 下没有 ${collabPathInRepo}/ 与 ${peoplePathInRepo}，不是协作仓`)
  const entry = peopleOfRepo(repo).find((person) => person.id === login)
  if (entry === undefined) {
    throw new CollabRejected(
      `Gitea 账号 ${login} 不在 ${peoplePathInRepo} 里：请项目负责人加上 { "id": "${login}", "name": "<显示名>", "gitea": "${login}" } 并合进 main，在协作仓里 git pull 拿到之后再运行 collab.project.join`,
    )
  }
  const { changed } = await join(path.join(repo, sitePathInRepo), { id: entry.id, name: entry.name, gitea: login })
  return { person: entry.id, changed }
}
