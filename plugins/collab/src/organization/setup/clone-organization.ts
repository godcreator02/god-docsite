import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { CollabRejected } from '../../errors.js'
import { gitReposIn } from '../../git/status.js'
import { isGiteaName } from '../../gitea-api/gitea.js'
import { collabPathInRepo, peoplePathInRepo } from '@godcreator/collab-model/project-model'
import { cloneReposInto, type OrganizationSource } from '../../other-repos/fetch/clone-new-repos.js'
import { isCollabRepo, peopleOfRepo, type GitRemote } from '../../project/project.js'

/** 克隆好的组织：项目文件夹、协作仓的仓根、令牌的账号、它在不在 site/people.json 里、项目文件夹里的全部仓 */
export type OrganizationCloned = { projectDir: string; repo: string; person: string; listed: boolean; repos: string[] }

/** 组织地址 https://<主机>/<组织>：读出组织名，组织地址去掉结尾的 / 与地址里的用户名 */
export function organizationOfUrl(url: string): { organization: string; organizationUrl: string } {
  const trimmed = url.trim()
  const shape = '要组织地址 https://<主机>/<组织>'
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new CollabRejected(`${trimmed} 不是地址；克隆项目${shape}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new CollabRejected(`${trimmed} 不是 http(s) 地址；克隆项目${shape}`)
  if (parsed.search !== '' || parsed.hash !== '') throw new CollabRejected(`${trimmed} 带了 ? 或 # 后面的部分；克隆项目${shape}`)
  const segments = parsed.pathname.split('/').filter((segment) => segment !== '')
  if (segments.length === 0) throw new CollabRejected(`${trimmed} 里没有组织名；克隆项目${shape}`)
  if (segments.length > 1) throw new CollabRejected(`${trimmed} 像是仓的地址；克隆项目${shape}，会克隆组织里的全部仓`)
  const organization = decodeURIComponent(segments[0]!)
  if (!isGiteaName(organization)) throw new CollabRejected(`组织名 ${JSON.stringify(organization)} 只能含字母、数字与 _ . -`)
  return { organization, organizationUrl: `${parsed.origin}/${organization}` }
}

const collabRepoMarks = `${collabPathInRepo}/ 与 ${peoplePathInRepo}`

/** 带 collab/ 与 site/people.json 的仓就是协作仓，组织里要正好一个 */
function collabRepoNameAmong(projectDir: string, organization: string, repoNames: string[]): string {
  const candidates = repoNames.filter((name) => isCollabRepo(path.join(projectDir, name)))
  if (candidates.length === 1) return candidates[0]!
  if (candidates.length === 0) {
    throw new CollabRejected(`组织 ${organization} 的仓里没有一个带 ${collabRepoMarks} 的协作仓；克隆了 ${repoNames.join('、')}，都在 ${projectDir}`)
  }
  throw new CollabRejected(`组织 ${organization} 里带 ${collabRepoMarks} 的协作仓不止一个：${candidates.join('、')}；一个项目只能有一个协作仓，都克隆在 ${projectDir}`)
}

/**
 * 用令牌把组织里全部仓克隆进 <parent>/<组织>/，看令牌的账号在不在协作仓的 site/people.json 里。
 * 项目文件夹已经存在就拒绝
 */
export async function cloneOrganization(parent: string, source: OrganizationSource, login: string, remote: GitRemote): Promise<OrganizationCloned> {
  const { organization } = source
  if (!existsSync(parent)) throw new CollabRejected(`${parent} 不存在`)
  const projectDir = path.join(parent, organization)
  if (existsSync(projectDir)) throw new CollabRejected(`${projectDir} 已经存在；已经克隆过就用 collab.project.add 把其中的协作仓加进列表`)
  const repoNames = await source.repoNames()
  if (repoNames.length === 0) throw new CollabRejected(`组织 ${organization} 里没有仓，或者令牌的账号看不到它们`)
  mkdirSync(projectDir)
  try {
    await cloneReposInto(projectDir, repoNames, source, remote)
  } catch (error) {
    if (!(error instanceof CollabRejected)) throw error
    throw new CollabRejected(`${error.message}\n已克隆的仓留在 ${projectDir}；要重新克隆整个组织，先删掉这个文件夹`)
  }
  const repo = path.join(projectDir, collabRepoNameAmong(projectDir, organization, repoNames))
  return { projectDir, repo, person: login, listed: peopleOfRepo(repo).some((person) => person.id === login), repos: gitReposIn(projectDir) }
}
