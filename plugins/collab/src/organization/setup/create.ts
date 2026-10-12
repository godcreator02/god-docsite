import { existsSync } from 'node:fs'
import path from 'node:path'
import { CollabRejected } from '../../errors.js'
import { createOrganizationRepo, isGiteaName, type GiteaHttp } from '../../gitea-api/gitea.js'
import { stepAfter } from '../../gitea-api/repo-rules.js'
import { projectDirOfCollabRepo } from '@godcreator/collab-model/project-model'
import { cloneMissingRepos, type OrganizationSource } from '../../other-repos/fetch/clone-new-repos.js'
import { applyOtherRepoRules } from '../../other-repos/rules.js'
import type { RemoteProject } from '../../project/project.js'

/** collab.repo.create 的回执：仓名、Gitea 上的网页、克隆到的目录、负责人（协作者） */
export type RepoCreated = { name: string; url: string; dir: string; leads: string[] }

/**
 * 在协作仓所在的组织里建私有仓 → 照别的仓的规矩配好，负责人是建仓的人 →
 * 用令牌克隆进项目文件夹（组织里别的新仓也一起克隆，和刷新时一样）。
 * 负责人由这里显式加成协作者：组织管理员建仓时 Gitea 不会自动加
 */
export async function createProjectRepo(project: RemoteProject, http: GiteaHttp, source: OrganizationSource, name: string, description: string): Promise<RepoCreated> {
  if (!isGiteaName(name)) throw new CollabRejected(`name 要是仓名，只含字母、数字与 _ . -，收到 ${JSON.stringify(name)}`)
  const projectDir = projectDirOfCollabRepo(project.repo)
  const dir = path.join(projectDir, name)
  if (existsSync(dir)) throw new CollabRejected(`项目文件夹 ${projectDir} 里已经有 ${name}，换一个仓名`)
  const organization = project.gitea.owner
  const leads = [project.person]

  const { url } = await createOrganizationRepo(http, organization, name, description)
  const done = await applyOtherRepoRules(http, organization, name, leads, [`已在组织 ${organization} 建好私有仓 ${name}（${url}）`])
  await stepAfter(done, '克隆进项目文件夹', async () => {
    const cloned = await cloneMissingRepos(project.repo, source, project.remote)
    if (!cloned.includes(name)) throw new CollabRejected(`组织 ${organization} 的仓列表里没有 ${name}`)
  })
  return { name, url, dir, leads }
}
