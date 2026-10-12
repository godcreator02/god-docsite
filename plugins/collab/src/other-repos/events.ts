/** 别的仓这边的刷新与事件：完整刷新时做哪几步、收到别的仓或组织里建删仓的消息做什么；每一步怎么做、出错怎么记由调用方传进来 */
import { otherRepoNamesOf, sameRepoName, type RemoteProject } from '../project/project.js'

/** 别的仓那一套里，刷新与事件要调的；name 是项目文件夹里的目录名 */
export type OtherReposHandlers = {
  startWatching(repo: string): void
  /** 克隆组织里新加的仓，回克隆了哪些 */
  cloneMissing(project: RemoteProject): Promise<string[]>
  fetch(project: RemoteProject, name: string): Promise<void>
  review(project: RemoteProject, name: string): Promise<void>
  checkRules(project: RemoteProject, name: string): Promise<void>
  /** 完整刷新之后只留项目文件夹里还在的仓 */
  retainOnly(repo: string, names: readonly string[]): void
  forget(repo: string): void
}

/** 做一步：name 是步名，出错按它记、下次做成了按它清；出错时回 null */
export type RunOtherReposStep = <T>(name: string, work: () => Promise<T>) => Promise<T | null>

/** 别的仓这边做一次要用的：各步调谁、每一步经谁做、日志写到哪 */
export type OtherReposSteps = { handlers: OtherReposHandlers; runStep: RunOtherReposStep; log: { info(message: string): void } }

/** 消息说某个别的仓出了什么事（形状照组织事件认出的消息）；repo 是 Gitea 上的仓名 */
export type OtherRepoEvent = { kind: 'push' | 'pr' | 'issue' | 'comment' | 'leads'; repo: string }

/** 消息说组织里的仓建了、删了（形状照组织事件认出的消息） */
export type OrganizationRepoEvent = { repo: string; action: string }

/** 完整刷新时别的仓这边：先补克隆，再列出项目文件夹里的仓，每个仓并行做三样，最后只留还在的 */
export async function refreshOtherRepos(project: RemoteProject, steps: OtherReposSteps): Promise<void> {
  await cloneNewRepos(project, steps)
  const names = await steps.runStep('other-repos:list', async () => otherRepoNamesOf(project.repo))
  if (names === null) return
  await Promise.all(names.map((name) => refreshOtherRepo(project, name, steps)))
  steps.handlers.retainOnly(project.repo, names)
}

/** 一个别的仓的三样：取回、读合并请求与 issue、核对规矩 */
async function refreshOtherRepo(project: RemoteProject, name: string, { handlers: otherRepos, runStep }: OtherReposSteps): Promise<void> {
  await runStep(`other-repos:fetch:${name}`, () => otherRepos.fetch(project, name))
  await runStep(`other-repos:review:${name}`, () => otherRepos.review(project, name))
  await runStep(`other-repos:rules:${name}`, () => otherRepos.checkRules(project, name))
}

/** 克隆组织里新加的仓，克隆下来的接着读一遍、核对一遍 */
async function cloneNewRepos(project: RemoteProject, { handlers: otherRepos, runStep, log }: OtherReposSteps): Promise<string[]> {
  const cloned = (await runStep('other-repos:clone', () => otherRepos.cloneMissing(project))) ?? []
  if (cloned.length > 0) log.info(`${project.repo}：克隆了组织里新加的仓 ${cloned.join('、')}`)
  return cloned
}

/** 组织里建了仓就补克隆，克隆下来的接着取回、读、核对；删了仓等别的动作只记一行，本机的目录不动 */
export async function applyRepoEvent(project: RemoteProject, event: OrganizationRepoEvent, steps: OtherReposSteps): Promise<void> {
  if (event.action !== 'created') {
    steps.log.info(`${project.repo}：组织里的仓 ${event.repo} ${event.action}，本机的目录不动`)
    return
  }
  for (const name of await cloneNewRepos(project, steps)) await refreshOtherRepo(project, name, steps)
}

/** 别的仓有新提交只取回它；合并请求、issue、评论有动静重读它；负责人换了重读、再核对规矩。项目文件夹里没有这个仓就只记一行 */
export async function applyOtherRepoEvent(project: RemoteProject, event: OtherRepoEvent, { handlers: otherRepos, runStep, log }: OtherReposSteps): Promise<void> {
  const names = await runStep('other-repos:list', async () => otherRepoNamesOf(project.repo))
  const name = names?.find((each) => sameRepoName(each, event.repo))
  if (name === undefined) {
    if (names !== null) log.info(`${project.repo}：收到 ${event.repo} 的消息，项目文件夹里没有这个仓，不处理`)
    return
  }
  if (event.kind === 'push') await runStep(`other-repos:fetch:${name}`, () => otherRepos.fetch(project, name))
  else await runStep(`other-repos:review:${name}`, () => otherRepos.review(project, name))
  if (event.kind === 'leads') await runStep(`other-repos:rules:${name}`, () => otherRepos.checkRules(project, name))
}
