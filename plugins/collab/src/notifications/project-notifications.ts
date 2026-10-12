import path from 'node:path'
import type { Notification, SiteFeed } from '@godcreator/collab-model/notification-model'
import type { ProjectLeads } from '@godcreator/collab-model/project-model'
import { peopleLookupOf } from '@godcreator/collab-model/task-model'
import type { CollabRecordsState } from '../collab-repo/records/inbox.js'
import type { SubmitFailure } from '../collab-repo/submit/submit-failures.js'
import type { CollabRepoLocalState } from '../collab-repo/sync/state.js'
import { messageOf } from '../errors.js'
import type { OtherRepoHead } from '../other-repos/fetch/state.js'
import type { RepoReview } from '../other-repos/review.js'
import type { RepoSetupProblem } from '../other-repos/rules.js'
import type { WebhookProblem } from '../organization/events/webhook.js'
import { projectTitleOf, type Project } from '../project/project.js'
import { notificationsOf } from './notifications-of.js'

/**
 * 接口 B：把通知发到人身上（QQ 私聊等）。每次一个项目的通知变了都交来此刻的全部，发哪些（比如只发新出现的）由实现决定。
 * nameOf 把 Gitea 用户名换成显示名，给短句用
 */
export type NotificationChannel = {
  observe(repo: string, projectTitle: string, notifications: Notification[], nameOf: (personId: string) => string): Promise<void>
}

/** 算一个项目的通知要读的：两边各目录、组织 webhook 与各步出错此刻的状态 */
export type NotificationReaders = {
  openProject(repo: string): Promise<Project>
  collabLocalStateOf(repo: string): Promise<CollabRepoLocalState>
  syncProblemOf(repo: string): string | null
  submitFailureOf(repo: string): SubmitFailure | null
  collabSetupProblemsOf(repo: string): string[]
  recordsOf(project: Project): Promise<CollabRecordsState>
  otherHeadsOf(repo: string): Promise<OtherRepoHead[]>
  otherReviewsOf(repo: string): RepoReview[]
  otherSetupProblemsOf(repo: string): RepoSetupProblem[]
  webhookProblemOf(repo: string): WebhookProblem | null
  checkErrorsOf(repo: string): string[]
  projectLeadsOf(repo: string): ProjectLeads | null
  /** 这次加载后做完过一次完整刷新：之前读 Gitea 的结果还不齐，不交给接口 B，免得还没读到的被当成消失了 */
  refreshedOnce(repo: string): boolean
}

export type ProjectNotificationsDeps = {
  readers: NotificationReaders
  channel: NotificationChannel
  /** 通知或项目负责人可能变了：交给那个项目在运行的站点 */
  onFeedChanged(repo: string): void
  log: { warn(message: string): void }
}

/** 一个项目此刻的通知，连同算短句要的显示名 */
export type ProjectNotificationsNow = { project: Project; notifications: Notification[]; nameOf: (personId: string) => string }

/**
 * 从两边与组织 webhook 此刻的状态算出通知：网站提示栏、协作窗格的计数、交给 AI 与接口 B 都用这一份。
 * 不记通知本身，每次现算；记录与人员列表现读工作区里的 collab/ 与 site/people.json（网站显示的也是工作区里的）
 */
export class ProjectNotifications {
  constructor(private readonly deps: ProjectNotificationsDeps) {}

  async currentOf(repo: string): Promise<ProjectNotificationsNow> {
    const { readers } = this.deps
    const project = await readers.openProject(repo)
    const [local, records, heads] = await Promise.all([readers.collabLocalStateOf(repo), readers.recordsOf(project), readers.otherHeadsOf(repo)])
    const notifications = notificationsOf({
      collabRepo: { name: path.basename(project.repo), local, syncProblem: readers.syncProblemOf(repo), submitFailure: readers.submitFailureOf(repo), setupProblems: readers.collabSetupProblemsOf(repo) },
      records,
      otherRepos: { heads, reviews: readers.otherReviewsOf(repo), setupProblems: readers.otherSetupProblemsOf(repo) },
      webhookProblem: readers.webhookProblemOf(repo),
      checkErrors: readers.checkErrorsOf(repo),
    })
    return { project, notifications, nameOf: peopleLookupOf(records.people).nameOf }
  }

  /** 交给站点的整份数据：通知已按组排好，连同上次读到的项目负责人 */
  async feedOf(repo: string): Promise<SiteFeed> {
    return { notifications: (await this.currentOf(repo)).notifications, projectLeads: this.deps.readers.projectLeadsOf(repo) }
  }

  /** 某个项目的哪样状态变了：交给站点；做完过一次完整刷新就把此刻的通知交给接口 B */
  changed(repo: string): void {
    this.deps.onFeedChanged(repo)
    if (!this.deps.readers.refreshedOnce(repo)) return
    void this.currentOf(repo)
      .then(({ project, notifications, nameOf }) => this.deps.channel.observe(repo, projectTitleOf(project), notifications, nameOf))
      .catch((error: unknown) => this.deps.log.warn(`${repo} 的通知没能交给通知渠道：${messageOf(error)}`))
  }
}
