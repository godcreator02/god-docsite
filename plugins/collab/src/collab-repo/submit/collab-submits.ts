import { InvalidSiteFeed, submitStateOf, type SubmitState } from '@godcreator/collab'
import { CollabRejected, messageOf } from '../../errors.js'
import { repoKeyOf, type RemoteProject } from '../../project/project.js'
import type { SubmitResult } from './submit.js'
import type { SubmitFailures } from './submit-failures.js'

export type CollabSubmitsOptions = {
  /** 打开项目并核对能联网（origin、令牌的账号） */
  openRemote: (repo: string) => Promise<RemoteProject>
  /** 提交审核，一直等到执行器的结论 */
  submitProject: (project: RemoteProject) => Promise<SubmitResult>
  failures: SubmitFailures
  /** 把一键提交的状态写到这个项目站点的频道 collab-submit（站点没在运行就不写） */
  publish: (repo: string, state: SubmitState) => void
  log: { warn: (message: string) => void }
  now: () => Date
}

/**
 * 各项目的提交审核：AI 调 collab.submit 与网页上的一键提交都经这里，一个项目同一时刻只跑一次。
 * 跑的时候往站点的频道 collab-submit 写 running，合并了写 merged，失败写 null；失败的原话记进提交审核的失败记录（成为一条通知），成功一次清掉
 */
export class CollabSubmits {
  private readonly running = new Map<string, { by: string | null; at: string }>()

  constructor(private readonly options: CollabSubmitsOptions) {}

  /** 提交审核；requestedBy 是网页上点一键提交的人，AI 调命令时不给、记成项目的身份。这个项目正在提交就拒绝 */
  async submit(repo: string, requestedBy?: string): Promise<SubmitResult> {
    const key = repoKeyOf(repo)
    const current = this.running.get(key)
    if (current !== undefined) throw new CollabRejected(`这个项目正在提交审核（${current.by ?? '本机'} 在 ${current.at} 发起的），等这次完了再提交`)
    const startedAt = this.options.now().toISOString()
    this.running.set(key, { by: requestedBy ?? null, at: startedAt })
    try {
      const project = await this.options.openRemote(repo)
      const by = requestedBy ?? project.person
      this.running.set(key, { by, at: startedAt })
      this.options.publish(repo, { state: 'running', by, at: startedAt })
      const result = await this.options.submitProject(project)
      this.options.failures.record(repo, null)
      this.options.publish(repo, { state: 'merged', by, at: this.options.now().toISOString(), pull: result.pull })
      return result
    } catch (error) {
      if (error instanceof CollabRejected) this.options.failures.record(repo, { at: this.options.now().toISOString(), message: error.message })
      this.options.publish(repo, null)
      throw error
    } finally {
      this.running.delete(key)
    }
  }

  /**
   * 站点频道 collab-submit 的值变了（连上订阅时也先收到一次）：是网页上点的 requested 就接手提交审核；
   * 是 running 却不是这里在跑（工作台重新加载前留下的），清掉；形状不对报出来再清掉。自己写的 running、merged 回来时不动
   */
  onSiteState(repo: string, data: unknown): void {
    let state: SubmitState
    try {
      state = submitStateOf(data)
    } catch (error) {
      if (!(error instanceof InvalidSiteFeed)) throw error
      this.options.log.warn(`${repo} 站点频道 collab-submit 里的值形状不对，已清掉：${error.message}`)
      this.options.publish(repo, null)
      return
    }
    const runningHere = this.running.has(repoKeyOf(repo))
    if (state?.state === 'running' && !runningHere) this.options.publish(repo, null)
    if (state?.state !== 'requested' || runningHere) return
    this.submit(repo, state.by).catch((error: unknown) => {
      // 被拒的原话已经记成通知；别的错只能写进日志
      if (!(error instanceof CollabRejected)) this.options.log.warn(`${repo} 网页上发起的提交审核出错：${messageOf(error)}`)
    })
  }
}
