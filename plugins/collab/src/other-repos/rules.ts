import type { GiteaHttp, GiteaLocation } from '../gitea-api/gitea.js'
import { applyRepoRules, repoRulesProblemsOf, setUpRepoByRules, type MainRule } from '../gitea-api/repo-rules.js'
import { PerRepoStore } from '../project/per-repo-store.js'
import { giteaLocationOfRepoIn, otherRepoDirOf, type RemoteProject } from '../project/project.js'

/** 别的仓没有执行器：main 的推送与合并都只许负责人，不写团队 */
const otherRepoMainRule: MainRule = { push: 'leads', merge: 'leads' }

/** 建仓之后照规矩配好：负责人就是建仓的人（见 applyRepoRules） */
export function applyOtherRepoRules(http: GiteaHttp, owner: string, repo: string, leads: string[], doneBefore: string[]): Promise<string[]> {
  return applyRepoRules(http, owner, repo, leads, otherRepoMainRule, doneBefore)
}

/** collab.repo.setup 配一个别的仓（name 是项目文件夹里的目录名，不是 git 仓就拒绝）：位置从它的 origin 读；回配好之后的负责人与位置 */
export async function setupOtherRepo(project: RemoteProject, http: GiteaHttp, name: string, leads: string[] | undefined): Promise<{ leads: string[]; location: GiteaLocation }> {
  otherRepoDirOf(project, name)
  const location = await giteaLocationOfRepoIn(project.repo, name)
  return { leads: await setUpRepoByRules(http, location, project.person, leads, otherRepoMainRule), location }
}

/** 一个别的仓没按规矩配好：repo 是项目文件夹里的目录名，problems 每条是给人看的一句 */
export type RepoSetupProblem = { repo: string; problems: string[] }

/**
 * 各项目里别的仓没按规矩配好的地方，按仓记：刚连上推送、collab.check 时每个仓核对一遍；收到某个仓负责人换了、组织里建了仓时只核对那一个。
 * 本机身份不是那个仓的管理员、或它还没有 main 时不核对，当作没有问题
 */
export class OtherReposRules {
  private readonly problems: PerRepoStore<string[]>

  constructor(
    private readonly http: GiteaHttp,
    onChange: (repo: string) => void,
  ) {
    this.problems = new PerRepoStore(onChange)
  }

  async check(project: RemoteProject, name: string): Promise<void> {
    this.problems.set(project.repo, name, (await repoRulesProblemsOf(this.http, await giteaLocationOfRepoIn(project.repo, name), otherRepoMainRule)) ?? [])
  }

  retainOnly(repo: string, names: readonly string[]): void {
    this.problems.retainOnly(repo, names)
  }

  /** 有问题的仓，按目录名排 */
  problemsOf(repo: string): RepoSetupProblem[] {
    return this.problems
      .entriesOf(repo)
      .filter(([, problems]) => problems.length > 0)
      .map(([name, problems]) => ({ repo: name, problems }))
  }

  forget(repo: string): void {
    this.problems.forget(repo)
  }
}
