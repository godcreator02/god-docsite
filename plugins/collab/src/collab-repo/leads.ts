import type { ProjectLeads } from '@godcreator/collab-model/project-model'
import type { GiteaAccess } from '../gitea-api/access.js'
import { giteaRepo, type GiteaHttp } from '../gitea-api/gitea.js'
import { repoKeyOf, type RemoteProject } from '../project/project.js'

/** 项目负责人：Gitea 上协作仓的协作者。删任务与模块时每次现读 */
export function projectLeadsOf(gitea: GiteaAccess, project: RemoteProject): Promise<ProjectLeads> {
  return giteaRepo(gitea.http, project.gitea.owner, project.gitea.repo).collaborators()
}

/** 各项目上次读到的项目负责人，按项目仓根记：刚连上推送、collab.check 与收到协作仓的 leads changed 时重读，变了调 onChange */
export class CollabRepoLeads {
  private readonly leads = new Map<string, ProjectLeads>()

  constructor(
    private readonly http: GiteaHttp,
    private readonly onChange: (repo: string) => void,
  ) {}

  async refresh(project: RemoteProject): Promise<void> {
    const leads = await giteaRepo(this.http, project.gitea.owner, project.gitea.repo).collaborators()
    const key = repoKeyOf(project.repo)
    if (JSON.stringify(leads) === JSON.stringify(this.leads.get(key) ?? null)) return
    this.leads.set(key, leads)
    this.onChange(project.repo)
  }

  /** 上次读到的；这次加载后还没读到为 null */
  leadsOf(repo: string): ProjectLeads | null {
    return this.leads.get(repoKeyOf(repo)) ?? null
  }

  forget(repo: string): void {
    this.leads.delete(repoKeyOf(repo))
  }
}
