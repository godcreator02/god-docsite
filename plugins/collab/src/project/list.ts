import { CollabRejected } from '../errors.js'
import { isOrganization, ownerAndRepoOf, type GiteaHttp } from '../gitea-api/gitea.js'
import { git } from '../git/git.js'
import { requireOrganizationFolder, sameRepo, type Project } from './project.js'

/** 设置 projects 现在的值与改写它 */
export type ProjectsSetting = { get(): unknown; set(projects: string[]): Promise<void> }

/** 项目列表：设置 projects 里的协作仓根，加进去之前核对它是组织下、以组织命名的项目文件夹里的协作仓 */
export class ProjectList {
  constructor(
    private readonly setting: ProjectsSetting,
    private readonly http: GiteaHttp,
    private readonly openProject: (repo: string) => Promise<Project>,
  ) {}

  /** 设置 projects 现在的值；写错了直接报错 */
  current(): string[] {
    const value = this.setting.get()
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new CollabRejected(`设置 projects 要是路径列表，现在是 ${JSON.stringify(value)}`)
    return value
  }

  /** 设置 projects 写错了的原因，窗格照原话显示；每次现读，改好了就消失。写错时列表当作空的 */
  listed(): { projects: string[]; error: string | null } {
    try {
      return { projects: this.current(), error: null }
    } catch (error) {
      if (!(error instanceof CollabRejected)) throw error
      return { projects: [], error: error.message }
    }
  }

  /**
   * 先按项目仓的要求打开一次，不是项目仓就在这里拒绝；协作仓 origin 的主人要是 Gitea 上的组织、仓要放在以组织命名的项目文件夹里，
   * 不然也拒绝（实时推送靠组织级 webhook，项目里的仓都在那个文件夹里）
   */
  async add(repo: string): Promise<void> {
    await this.openProject(repo)
    const projects = this.current()
    if (projects.some((each) => sameRepo(each, repo))) throw new CollabRejected(`${repo} 已经在项目列表里`)
    const { owner } = ownerAndRepoOf(await git(repo, ['remote', 'get-url', 'origin']))
    requireOrganizationFolder(repo, owner)
    if (!(await isOrganization(this.http, owner))) throw new CollabRejected(`协作仓 origin 的主人 ${owner} 不是 Gitea 上的组织：协作项目要放在组织里，实时推送靠组织级的 webhook`)
    await this.setting.set([...projects, repo])
  }

  async remove(repo: string): Promise<void> {
    const projects = this.current()
    if (!projects.some((each) => sameRepo(each, repo))) throw new CollabRejected(`${repo} 不在项目列表里`)
    await this.setting.set(projects.filter((each) => !sameRepo(each, repo)))
  }
}
