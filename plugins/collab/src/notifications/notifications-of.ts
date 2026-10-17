import { notificationOf, sortedNotifications, type CollabProblem, type InboxItems, type Notification, type NotificationFacts } from '@godcreator/collab'
import type { CollabRepoLocalState } from '../collab-repo/sync/state.js'
import type { SubmitFailure } from '../collab-repo/submit/submit-failures.js'
import type { OtherRepoHead } from '../other-repos/fetch/state.js'
import type { RepoReview } from '../other-repos/review.js'
import type { RepoSetupProblem } from '../other-repos/rules.js'
import type { WebhookProblem } from '../organization/events/webhook.js'

/** 协作仓只用这一条分支 */
const mainBranch = 'main'

/** 一个项目此刻要算通知的全部状态：两边各目录交出的，加上组织 webhook 与各步的出错 */
export type NotificationSources = {
  collabRepo: {
    /** 协作仓的目录名：协作仓自己没按规矩配好时，repo-setup 的 repo 写它 */
    name: string
    local: CollabRepoLocalState
    syncProblem: string | null
    submitFailure: SubmitFailure | null
    setupProblems: string[]
  }
  records: { inbox: InboxItems; problems: CollabProblem[] }
  otherRepos: { heads: OtherRepoHead[]; reviews: RepoReview[]; setupProblems: RepoSetupProblem[] }
  webhookProblem: WebhookProblem | null
  /** 刷新与盯文件各步此刻的出错，一步一条 */
  checkErrors: string[]
}

/**
 * 协作仓组：冲突没改好时，提交失败与同步不了的原因都是这件事，只列冲突；不在 main 上时自动同步一定停着，不再列同步不了
 */
function collabRepoFactsOf({ collabRepo, records, webhookProblem, checkErrors }: NotificationSources): NotificationFacts[] {
  const { local, syncProblem, submitFailure, setupProblems, name } = collabRepo
  const hasConflicts = local.conflicts.length > 0
  const offMain = local.branch !== mainBranch
  const facts: Array<NotificationFacts | null> = [
    // sources/ 的文件不进这条通知：站点按 @godcreator/collab 的通知形状逐字段核对，多一个字段就整份拒收
    local.unsubmitted.records.length + local.unsubmitted.siteFiles.length > 0 ? { kind: 'unsubmitted', records: local.unsubmitted.records, siteFiles: local.unsubmitted.siteFiles } : null,
    hasConflicts ? { kind: 'conflicts', files: local.conflicts } : null,
    submitFailure !== null && !hasConflicts ? { kind: 'submit-failure', message: submitFailure.message, at: submitFailure.at } : null,
    syncProblem !== null && !hasConflicts && !offMain ? { kind: 'sync-problem', reason: syncProblem } : null,
    checkErrors.length > 0 ? { kind: 'check-error', message: checkErrors.join('\n') } : null,
    offMain ? { kind: 'off-main', branch: local.branch } : null,
    webhookProblem === null ? null : { kind: 'webhook-setup', organization: webhookProblem.organization, problems: webhookProblem.problems },
    setupProblems.length > 0 ? { kind: 'repo-setup', repo: name, problems: setupProblems } : null,
  ]
  return [...facts.filter((fact) => fact !== null), ...records.problems.map((problem): NotificationFacts => ({ kind: 'record-problem', file: problem.file, message: problem.message }))]
}

/** 别的仓只看 HEAD：只有本地多是未推送，只有服务器多是未拉取，两边都多是分叉 */
function headFactOf({ repo, ahead, behind }: OtherRepoHead): NotificationFacts | null {
  if (ahead > 0 && behind > 0) return { kind: 'diverged', repo, ahead, behind }
  if (ahead > 0) return { kind: 'unpushed', repo, count: ahead }
  if (behind > 0) return { kind: 'unpulled', repo, count: behind }
  return null
}

function otherReposFactsOf({ otherRepos }: NotificationSources): NotificationFacts[] {
  return [
    ...otherRepos.heads.map(headFactOf).filter((fact) => fact !== null),
    ...otherRepos.reviews.flatMap((review): NotificationFacts[] => [
      ...review.pullsToReview.map((pull): NotificationFacts => ({ kind: 'pull-to-review', ...pull })),
      ...review.issuesToAnswer.map((issue): NotificationFacts => ({ kind: 'issue-to-answer', ...issue })),
      ...review.myPullUpdates.map((update): NotificationFacts => ({ kind: 'my-pull-update', ...update })),
      ...review.myIssuesAnswered.map((issue): NotificationFacts => ({ kind: 'my-issue-answered', ...issue })),
    ]),
    ...otherRepos.setupProblems.map(({ repo, problems }): NotificationFacts => ({ kind: 'repo-setup', repo, problems })),
  ]
}

function forMeFactsOf({ records: { inbox } }: NotificationSources): NotificationFacts[] {
  return [
    ...inbox.tasks.map((task): NotificationFacts => ({ kind: 'task', recordId: task.id, title: task.title, due: task.due ?? null, detail: task.detail ?? null })),
    ...inbox.mentions.map((mention): NotificationFacts => ({ kind: 'mention', comment: mention.comment, author: mention.author, page: mention.page, text: mention.text, in: mention.in })),
    ...inbox.repliesToMe.map((reply): NotificationFacts => ({ kind: 'reply', comment: reply.comment, author: reply.author, page: reply.page, text: reply.text, threadId: reply.threadId })),
  ]
}

/** 一个项目此刻的全部通知，按 sortedNotifications 排；只按此刻的状态算，解决了就不再出现 */
export function notificationsOf(sources: NotificationSources): Notification[] {
  return sortedNotifications([...collabRepoFactsOf(sources), ...otherReposFactsOf(sources), ...forMeFactsOf(sources)].map(notificationOf))
}
