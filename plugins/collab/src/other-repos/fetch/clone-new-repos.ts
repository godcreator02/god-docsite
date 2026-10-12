import { existsSync } from 'node:fs'
import path from 'node:path'
import { projectDirOfCollabRepo } from '@godcreator/collab-model/project-model'
import { CollabRejected } from '../../errors.js'
import { gitMessageOf, runGit } from '../../git/git.js'
import { organizationRepoNames, type GiteaHttp } from '../../gitea-api/gitea.js'
import type { GitRemote } from '../../project/project.js'

/** 一个组织在哪、有哪些仓、每个仓从哪克隆；生产里经 gwb-gitea 列仓、按组织地址拼克隆地址，测试里换成本地裸仓 */
export type OrganizationSource = {
  organization: string
  repoNames(): Promise<string[]>
  cloneUrlOf(repoName: string): string
}

export function repoCloneUrlOf(organizationUrl: string, repoName: string): string {
  return `${organizationUrl}/${repoName}.git`
}

export function organizationSourceOf(http: GiteaHttp, organization: string, organizationUrl: string): OrganizationSource {
  return { organization, repoNames: () => organizationRepoNames(http, organization), cloneUrlOf: (repoName) => repoCloneUrlOf(organizationUrl, repoName) }
}

/**
 * 按给的顺序逐个克隆进项目文件夹，目录名就是仓名；一个失败就停下，报出已经克隆了哪些与 git 的原话。
 * core.longpaths 写进新仓的配置：资料库里 MinerU 章节的文件名很长，项目文件夹放得深一点就超过 Windows 的 260 字符，检出失败
 */
export async function cloneReposInto(projectDir: string, repoNames: string[], source: OrganizationSource, remote: GitRemote): Promise<void> {
  const cloned: string[] = []
  for (const name of repoNames) {
    const result = await runGit(projectDir, ['clone', '-c', 'core.longpaths=true', source.cloneUrlOf(name), path.join(projectDir, name)], remote.env)
    if (result.code !== 0) {
      const done = cloned.length === 0 ? '（没有）' : cloned.join('、')
      throw new CollabRejected(`克隆 ${name} 失败，停在这里、后面的仓没有克隆。已经克隆了：${done}。git 的原话：\n${gitMessageOf(result)}`)
    }
    cloned.push(name)
  }
}

/** 组织里新加的、项目文件夹（协作仓的上一级，以组织命名）里还没有的仓，用令牌克隆进来，回克隆了哪些 */
export async function cloneMissingRepos(collabRepo: string, source: OrganizationSource, remote: GitRemote): Promise<string[]> {
  const projectDir = projectDirOfCollabRepo(collabRepo)
  const missing = (await source.repoNames()).filter((name) => !existsSync(path.join(projectDir, name)))
  if (missing.length === 0) return []
  await cloneReposInto(projectDir, missing, source, remote)
  return missing
}
