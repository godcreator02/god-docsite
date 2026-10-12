import type { GiteaHttp, GiteaLocation } from '../gitea-api/gitea.js'
import { repoRulesProblemsOf, setUpRepoByRules, type MainRule } from '../gitea-api/repo-rules.js'
import { repoKeyOf, type RemoteProject } from '../project/project.js'

/** 协作仓的 main 谁都不能直接推，负责人也走提交审核（AGit 推 refs/for/main）；只许执行器的团队 bots 合并 */
export const collabRepoMainRule: MainRule = { push: 'nobody', merge: 'executor' }

/** collab.repo.setup 配协作仓：位置用打开项目时记下的 origin；回配好之后的负责人与位置 */
export async function setupCollabRepo(project: RemoteProject, http: GiteaHttp, leads: string[] | undefined): Promise<{ leads: string[]; location: GiteaLocation }> {
  return { leads: await setUpRepoByRules(http, project.gitea, project.person, leads, collabRepoMainRule), location: project.gitea }
}

/**
 * 各项目协作仓没按规矩配好的地方，按项目仓根记：刚连上推送、collab.check 与收到协作仓的 leads changed 时核对。
 * 本机身份不是协作仓的管理员、或协作仓还没有 main 时不核对，当作没有问题
 */
export class CollabRepoRules {
  private readonly problems = new Map<string, string[]>()

  constructor(
    private readonly http: GiteaHttp,
    private readonly onChange: (repo: string) => void,
  ) {}

  async check(project: RemoteProject): Promise<void> {
    const problems = (await repoRulesProblemsOf(this.http, project.gitea, collabRepoMainRule)) ?? []
    const key = repoKeyOf(project.repo)
    if (JSON.stringify(problems) === JSON.stringify(this.problems.get(key) ?? [])) return
    this.problems.set(key, problems)
    this.onChange(project.repo)
  }

  /** 上次核对出的问题，每条一句；没有问题、还没核对过为空 */
  problemsOf(repo: string): string[] {
    return this.problems.get(repoKeyOf(repo)) ?? []
  }

  forget(repo: string): void {
    this.problems.delete(repoKeyOf(repo))
  }
}
