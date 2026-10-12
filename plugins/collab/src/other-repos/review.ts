import type { PullUpdateChange } from '@godcreator/collab-model/notification-model'
import { giteaRepo, type GiteaHttp, type GiteaLocation, type GiteaRepo, type Issue, type PullReview } from '../gitea-api/gitea.js'
import { PerRepoStore } from '../project/per-repo-store.js'
import { giteaLocationOfRepoIn, type RemoteProject } from '../project/project.js'

/** 别的仓里合到 main、别人开的、开着的合并请求，只列本机身份是负责人（协作者）的仓：这些仓没有执行器，人同意后由 agent 合并 */
export type PullToReview = { repo: string; number: number; title: string; poster: string; url: string }

/** 本机身份是负责人的仓里开着的 issue，最后发言的人（没有评论时是提出人）不是这个仓的负责人 */
export type IssueToAnswer = { repo: string; number: number; title: string; poster: string; lastSpeaker: string; url: string }

/** 我开的、合到 main 的、开着的合并请求：最新的有效审阅要求修改，或最后一条评论不是我；by 是那位审阅人或评论人 */
export type MyPullUpdate = { repo: string; number: number; title: string; change: PullUpdateChange; by: string; url: string }

/** 我提的、开着的 issue，最后发言的是这个仓的负责人、且不是我 */
export type MyIssueAnswered = { repo: string; number: number; title: string; by: string; url: string }

/** 一个别的仓读到的四样；repo 是 Gitea 上的仓名 */
export type RepoReview = { repo: string; pullsToReview: PullToReview[]; issuesToAnswer: IssueToAnswer[]; myPullUpdates: MyPullUpdate[]; myIssuesAnswered: MyIssueAnswered[] }

/** 开着的 issue 上最后发言的人；没有评论时是提出人，不再读评论 */
async function lastSpeakerOf(repository: GiteaRepo, issue: Issue): Promise<string> {
  if (issue.comments === 0) return issue.poster
  return (await repository.lastCommenter(issue.number)) ?? issue.poster
}

/** 最新的有效审阅：批准或要求修改、没被撤销的里最后一条；审阅人是我自己的不算 */
function latestEffectiveReview(reviews: PullReview[], person: string): PullReview | null {
  return reviews.filter((review) => (review.state === 'APPROVED' || review.state === 'REQUEST_CHANGES') && !review.dismissed && review.reviewer !== person).at(-1) ?? null
}

async function issuesOf(repository: GiteaRepo, location: GiteaLocation, person: string, leads: string[]): Promise<Pick<RepoReview, 'issuesToAnswer' | 'myIssuesAnswered'>> {
  const isLead = leads.includes(person)
  const relevant = (await repository.openIssues()).filter((issue) => isLead || issue.poster === person)
  const spoken = await Promise.all(relevant.map(async (issue): Promise<[Issue, string]> => [issue, await lastSpeakerOf(repository, issue)]))
  return {
    issuesToAnswer: isLead
      ? spoken
          .filter(([, lastSpeaker]) => !leads.includes(lastSpeaker))
          .map(([issue, lastSpeaker]) => ({ repo: location.repo, number: issue.number, title: issue.title, poster: issue.poster, lastSpeaker, url: issue.url }))
      : [],
    myIssuesAnswered: spoken
      .filter(([issue, lastSpeaker]) => issue.poster === person && lastSpeaker !== person && leads.includes(lastSpeaker))
      .map(([issue, lastSpeaker]) => ({ repo: location.repo, number: issue.number, title: issue.title, by: lastSpeaker, url: issue.url })),
  }
}

async function myPullUpdateOf(repository: GiteaRepo, location: GiteaLocation, person: string, pull: { number: number; title: string; url: string }): Promise<MyPullUpdate | null> {
  const update = { repo: location.repo, number: pull.number, title: pull.title, url: pull.url }
  const review = latestEffectiveReview(await repository.pullReviews(pull.number), person)
  if (review?.state === 'REQUEST_CHANGES') return { ...update, change: 'changes-requested', by: review.reviewer }
  const lastCommenter = await repository.lastCommenter(pull.number)
  if (lastCommenter !== null && lastCommenter !== person) return { ...update, change: 'new-comment', by: lastCommenter }
  return null
}

/**
 * 读一个别的仓：协作者就是负责人。本机身份是负责人时列出等我审阅的合并请求与轮到负责人回的 issue；
 * 不论是不是负责人，都看我开的合并请求有没有被要求修改或有了新评论、我提的 issue 有没有负责人回了。还没有 main 的空仓没有合并请求
 */
export async function reviewOtherRepo(http: GiteaHttp, location: GiteaLocation, person: string): Promise<RepoReview> {
  const repository = giteaRepo(http, location.owner, location.repo)
  const [leads, hasMain] = await Promise.all([repository.collaborators(), repository.hasMain()])
  const pullsToMain = hasMain ? (await repository.openPulls()).filter((pull) => pull.baseRef === 'main') : []
  const [issues, myPullUpdates] = await Promise.all([
    issuesOf(repository, location, person, leads),
    Promise.all(pullsToMain.filter((pull) => pull.poster === person).map((pull) => myPullUpdateOf(repository, location, person, pull))),
  ])
  return {
    repo: location.repo,
    pullsToReview: leads.includes(person)
      ? pullsToMain.filter((pull) => pull.poster !== person).map((pull) => ({ repo: location.repo, number: pull.number, title: pull.title, poster: pull.poster, url: pull.url }))
      : [],
    ...issues,
    myPullUpdates: myPullUpdates.filter((update): update is MyPullUpdate => update !== null),
  }
}

/**
 * 各项目里别的仓读到的合并请求与 issue，按仓记：刚连上推送、collab.check 时每个仓读一遍；
 * 收到某个仓的合并请求、issue、评论或负责人换了的消息时只重读那一个仓
 */
export class OtherReposReview {
  private readonly reviews: PerRepoStore<RepoReview>

  constructor(
    private readonly http: GiteaHttp,
    onChange: (repo: string) => void,
  ) {
    this.reviews = new PerRepoStore(onChange)
  }

  /** 重读项目文件夹里的一个别的仓（name 是目录名），位置从它的 origin 读 */
  async review(project: RemoteProject, name: string): Promise<void> {
    this.reviews.set(project.repo, name, await reviewOtherRepo(this.http, await giteaLocationOfRepoIn(project.repo, name), project.person))
  }

  /** 完整刷新之后只留项目文件夹里还在的仓 */
  retainOnly(repo: string, names: readonly string[]): void {
    this.reviews.retainOnly(repo, names)
  }

  /** 各仓上次读到的，按目录名排；读失败的仓留着再上一次的 */
  reviewsOf(repo: string): RepoReview[] {
    return this.reviews.entriesOf(repo).map(([, review]) => review)
  }

  forget(repo: string): void {
    this.reviews.forget(repo)
  }
}
