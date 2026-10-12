/**
 * 按项目做刷新的各步：各步出错不往外抛（推送触发的刷新在定时器里），按项目、按步记下原话，同一步下次做成了就清掉；
 * 同一个项目同时只做一件
 */
import { messageOf } from '../../errors.js'
import { repoKeyOf } from '../../project/project.js'

/** 一次完整刷新或一批按消息做的：什么时候、各步出错的原话（没出错为 null） */
export type RefreshRecord = { at: string; error: string | null }

export type ProjectStepRunnerDeps = {
  /** 某个项目各步的出错变了 */
  onChange(repo: string): void
  now(): Date
}

export class ProjectStepRunner {
  /** 各项目各步此刻的出错：步名到原话 */
  private readonly stepErrors = new Map<string, Map<string, string>>()
  private readonly running = new Set<string>()

  constructor(private readonly deps: ProjectStepRunnerDeps) {}

  /** 各步此刻的出错，一步一条；都没出错为空 */
  errorsOf(repo: string): string[] {
    return [...(this.stepErrors.get(repoKeyOf(repo))?.values() ?? [])]
  }

  /** 项目移出列表时：它各步的出错都不再记 */
  forget(repo: string): void {
    this.stepErrors.delete(repoKeyOf(repo))
  }

  /** 做一步：做成了清掉这一步上次的出错，出错就记下原话、加进这一次的 errors，回 null */
  async step<T>(repo: string, name: string, errors: string[], work: () => Promise<T>): Promise<T | null> {
    try {
      const result = await work()
      this.setStepError(repo, name, null)
      return result
    } catch (error) {
      const message = messageOf(error)
      this.setStepError(repo, name, message)
      errors.push(message)
      return null
    }
  }

  stepSync(repo: string, name: string, errors: string[], work: () => void): void {
    try {
      work()
      this.setStepError(repo, name, null)
    } catch (error) {
      const message = messageOf(error)
      this.setStepError(repo, name, message)
      errors.push(message)
    }
  }

  private setStepError(repo: string, name: string, message: string | null): void {
    const key = repoKeyOf(repo)
    const steps = this.stepErrors.get(key) ?? new Map<string, string>()
    if (message === null) steps.delete(name)
    else steps.set(name, message)
    this.stepErrors.set(key, steps)
  }

  /** 做 work 前后比一次出错，变了才通知；不是 exclusively 里的（加载时、加进列表时开始监视）用它 */
  notifyWhenStepErrorsChange(repo: string, work: () => Promise<void>): Promise<void> {
    const before = JSON.stringify(this.errorsOf(repo))
    return work().then(() => {
      if (JSON.stringify(this.errorsOf(repo)) !== before) this.deps.onChange(repo)
    })
  }

  /** 同一个项目同时只做一件；完整刷新先清掉上次全部的出错，按这一次重新记 */
  async exclusively(repo: string, full: boolean, work: (errors: string[]) => Promise<void>): Promise<RefreshRecord | 'busy'> {
    const key = repoKeyOf(repo)
    if (this.running.has(key)) return 'busy'
    this.running.add(key)
    const errors: string[] = []
    try {
      await this.notifyWhenStepErrorsChange(repo, async () => {
        if (full) this.stepErrors.delete(key)
        await work(errors)
      })
    } finally {
      this.running.delete(key)
    }
    return { at: this.deps.now().toISOString(), error: errors.length === 0 ? null : errors.join('\n') }
  }
}
