import { notificationCountsOf, type NotificationGroup } from '@godcreator/collab'
import { ownerAndRepoOf } from '../gitea-api/gitea.js'
import { git } from '../git/git.js'
import type { ProjectNotificationsNow } from '../notifications/project-notifications.js'
import { projectTitleOf } from '../project/project.js'

/** 窗格里一个项目的一行：项目名、身份与显示名、通知各组几条、Gitea 上协作仓所在组织的网页 */
export type ProjectSummary = {
  repo: string
  title: string
  person: string
  name: string
  counts: Record<NotificationGroup, number>
  giteaUrl: string
}

/** 从此刻的通知算一行；Gitea 网页从协作仓的 origin 读，不取回远端 */
export async function summaryOf({ project, notifications, nameOf }: ProjectNotificationsNow): Promise<ProjectSummary> {
  return {
    repo: project.repo,
    title: projectTitleOf(project),
    person: project.person,
    name: nameOf(project.person),
    counts: notificationCountsOf(notifications),
    giteaUrl: ownerAndRepoOf(await git(project.repo, ['remote', 'get-url', 'origin'])).ownerUrl,
  }
}
