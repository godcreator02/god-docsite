import type { PushEvent } from './messages.js'

/** 收到消息后等一会儿再做：同一次合并的 push 与「合并请求已关闭」两条几乎同时到，合成一批 */
const pushDebounceMilliseconds = 2_000
/** 插件自己要的完整刷新最快这么久一次：认不出的消息每条都要完整刷新，有人乱发时每台电脑最多这么频繁地多刷新一次 */
const fullRefreshMinIntervalMilliseconds = 10_000

export type EventSchedulerDeps = {
  /** 完整刷新一个项目；正在刷新时回 busy */
  refresh(repo: string): Promise<'busy' | unknown>
  /** 按消息只做那几处；正在刷新时回 busy */
  apply(repo: string, events: PushEvent[]): Promise<'busy' | unknown>
  now(): number
  setTimeout(run: () => void, milliseconds: number): void
}

/** 一个项目攒着要做的：要不要完整刷新、按消息要做的几处；完整刷新会把那几处一起做到，要完整刷新时不再单做 */
type PendingWork = { full: boolean; events: PushEvent[] }

/**
 * 插件自己要的刷新：完整刷新（连上推送、加了项目、认不出的消息）与按消息做（认得出的消息）。都先等一会儿攒成一批；
 * 完整刷新同一个项目最快 10 秒一次。轮到时项目正在刷新（命令触发的），等一下再试
 */
export class EventScheduler {
  private readonly pending = new Map<string, PendingWork>()
  private readonly lastFull = new Map<string, number>()

  constructor(private readonly deps: EventSchedulerDeps) {}

  request(repo: string, work: 'full' | PushEvent): void {
    const queued = this.pending.get(repo)
    const pending = queued ?? { full: false, events: [] }
    if (work === 'full') pending.full = true
    else pending.events.push(work)
    if (queued !== undefined) return
    this.pending.set(repo, pending)
    this.deps.setTimeout(() => void this.run(repo), pushDebounceMilliseconds)
  }

  private fullAllowedIn(repo: string): number {
    return (this.lastFull.get(repo) ?? -Infinity) + fullRefreshMinIntervalMilliseconds - this.deps.now()
  }

  private async run(repo: string): Promise<void> {
    const pending = this.pending.get(repo)!
    const wait = pending.full ? this.fullAllowedIn(repo) : 0
    if (wait > 0) {
      this.deps.setTimeout(() => void this.run(repo), wait)
      return
    }
    this.pending.delete(repo)
    if (pending.full) {
      this.lastFull.set(repo, this.deps.now())
      if ((await this.deps.refresh(repo)) === 'busy') this.request(repo, 'full')
      return
    }
    if ((await this.deps.apply(repo, pending.events)) === 'busy') for (const event of pending.events) this.request(repo, event)
  }
}
