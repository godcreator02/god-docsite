import { repoKeyOf } from '../../project/project.js'

/** 上次提交审核失败：什么时候、原话（被打回附执行器的留言、合 main 冲突、推送前拦下、等不到结论） */
export type SubmitFailure = { at: string; message: string }

/** 各项目上次提交审核失败的原话，按项目仓根记；之后提交审核成功一次、或自动同步后已经没有东西可提交就清掉（record 给 null）。变了调 onChange */
export class SubmitFailures {
  private readonly failures = new Map<string, SubmitFailure>()

  constructor(private readonly onChange: (repo: string) => void) {}

  record(repo: string, failure: SubmitFailure | null): void {
    const key = repoKeyOf(repo)
    if (failure === null && !this.failures.has(key)) return
    if (failure === null) this.failures.delete(key)
    else this.failures.set(key, failure)
    this.onChange(repo)
  }

  failureOf(repo: string): SubmitFailure | null {
    return this.failures.get(repoKeyOf(repo)) ?? null
  }

  forget(repo: string): void {
    this.failures.delete(repoKeyOf(repo))
  }
}
