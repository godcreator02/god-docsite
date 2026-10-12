/** 协作仓这边的刷新与事件：完整刷新时做哪几步、收到协作仓的消息做什么；每一步怎么做、出错怎么记由调用方传进来 */
import type { RemoteProject } from '../project/project.js'

/** 协作仓那一套里，刷新与事件要调的 */
export type CollabRepoHandlers = {
  /** 开始监视协作仓；已经在监视就不动，开始不了就抛 */
  startWatching(repo: string): void
  fetch(project: RemoteProject): Promise<void>
  autoSync(project: RemoteProject): Promise<void>
  readLeads(project: RemoteProject): Promise<void>
  checkRules(project: RemoteProject): Promise<void>
  forget(repo: string): void
}

/** 做一步：name 是步名，出错按它记、下次做成了按它清；出错时回 null */
export type RunCollabRepoStep = <T>(name: string, work: () => Promise<T>) => Promise<T | null>

/** 协作仓这边做一次要用的：各步调谁、每一步经谁做 */
export type CollabRepoSteps = { handlers: CollabRepoHandlers; runStep: RunCollabRepoStep }

/** 消息说协作仓出了什么事（形状照组织事件认出的消息） */
export type CollabRepoEvent = { kind: 'push' | 'pr' | 'issue' | 'comment' | 'leads' }

/** 完整刷新时协作仓这边的四步：取回、读负责人、核对规矩、自动同步 */
export async function refreshCollabRepo(project: RemoteProject, { handlers: collabRepo, runStep }: CollabRepoSteps): Promise<void> {
  await runStep('collab-repo:fetch', () => collabRepo.fetch(project))
  await runStep('collab-repo:leads', () => collabRepo.readLeads(project))
  await runStep('collab-repo:rules', () => collabRepo.checkRules(project))
  // 取回失败也照样试一次：本机已有的 origin/main 可能还没同步进来
  await runStep('collab-repo:sync', () => collabRepo.autoSync(project))
}

/** 协作仓有新提交就取回、能快进就同步；负责人换了重读负责人、再核对规矩。协作仓的合并请求由执行器定论，它的 issue 与评论不处理 */
export async function applyCollabRepoEvent(project: RemoteProject, event: CollabRepoEvent, { handlers: collabRepo, runStep }: CollabRepoSteps): Promise<void> {
  if (event.kind === 'push') {
    await runStep('collab-repo:fetch', () => collabRepo.fetch(project))
    await runStep('collab-repo:sync', () => collabRepo.autoSync(project))
  } else if (event.kind === 'leads') {
    await runStep('collab-repo:leads', () => collabRepo.readLeads(project))
    await runStep('collab-repo:rules', () => collabRepo.checkRules(project))
  }
}
