import { deadlineFor, dueState } from './deadline.js'

/**
 * 起停状态机。**不碰真进程**：挑口、build、serve、杀树、时钟五样经 `RunnerDeps` 注入——
 * 真机那份在 runner.ts（`realRunnerDeps`），测试喂假的（tests/manager.test.ts）。
 *
 * 一个站一条记录，五态 idle → building → starting → running → stopping → idle。
 * 到点自动关走 `tick()`：绝对到期时刻，调用方每半分钟对一次表（见 deadline.ts）。
 */

export type Log = (line: string) => void

/** 一个子进程，只收用得着的两样：pid（杀树用）、退了的信号 */
export interface Proc {
  pid: number | undefined
  exited: Promise<number | null>
}

export interface RunnerDeps {
  /** 现挑一个空闲端口——**不用站脚本里钉的口**，钉的口只对手跑有意义 */
  freePort(): Promise<number>
  /** `pnpm run build`；done 在退出码 0 时兑现、否则拒绝 */
  build(dir: string, log: Log): { proc: Proc; done: Promise<void> }
  /** `pnpm exec next start -p <port>`；ready 在端口开始应答时兑现、进程先退了就拒绝 */
  serve(dir: string, port: number, log: Log): { proc: Proc; ready: Promise<void> }
  /** 杀整棵进程树（Windows 上 pnpm 是 .cmd，pid 是 cmd.exe，只杀它会留一个占着口的 node 孤儿） */
  killTree(pid: number): Promise<void>
  now(): number
}

export type Phase = 'idle' | 'building' | 'starting' | 'running' | 'stopping'

export interface RunInfo {
  port: number
  pid: number | undefined
  /** 绝对到期时刻（毫秒）；没有就是不自动关 */
  deadline: number | undefined
  startedAt: number
  url: string
}

/** 对外可见的一条站的运行态 */
export interface RunState {
  dir: string
  phase: Phase
  run?: RunInfo
  /** 上一次服务自己退时的退出码 */
  lastExit?: number | null
  /** 上一次起失败的原因 */
  lastError?: string
}

export type RunEvent =
  | 'building'
  | 'starting'
  | 'started'
  | 'failed'
  | 'stopping'
  | 'stopped'
  | 'extended'
  | 'warn'
  | 'expired'

export type StartOutcome =
  | { ok: true; run: RunInfo; built: boolean; alreadyRunning: boolean }
  | { ok: false; error: string }

export interface ManagerOptions {
  deps: RunnerDeps
  /** 用时现读——设置在界面上改完，下一次起就是新值 */
  autoStopMinutes(): number
  /** 状态机自己的叙述 */
  log: Log
  /** 子进程的输出行（build 与 next 都话多，调用方自己决定放哪一级） */
  output?: Log
  onChange(state: RunState, event: RunEvent): void
}

interface Aborter {
  promise: Promise<never>
  abort(reason: string): void
}

function aborter(): Aborter {
  let reject!: (err: Error) => void
  const promise = new Promise<never>((_, rej) => {
    reject = rej
  })
  // 没人等它的时候拒绝也不能变成 unhandled rejection
  promise.catch(() => undefined)
  return { promise, abort: (reason) => reject(new Error(reason)) }
}

interface Entry {
  dir: string
  phase: Phase
  run?: RunInfo
  proc?: Proc
  /** 这一次 start 的身份：stop 从中间打断时，start 的 catch 靠它认出「已经有人收过尾」 */
  token?: object
  aborter?: Aborter
  warned: boolean
  lastExit?: number | null
  lastError?: string
}

export class SiteManager {
  private readonly entries = new Map<string, Entry>()
  private readonly opts: ManagerOptions

  constructor(opts: ManagerOptions) {
    this.opts = opts
  }

  private entry(dir: string): Entry {
    let e = this.entries.get(dir)
    if (e === undefined) {
      e = { dir, phase: 'idle', warned: false }
      this.entries.set(dir, e)
    }
    return e
  }

  private view(e: Entry): RunState {
    const state: RunState = { dir: e.dir, phase: e.phase }
    if (e.run !== undefined) state.run = { ...e.run }
    if (e.lastExit !== undefined) state.lastExit = e.lastExit
    if (e.lastError !== undefined) state.lastError = e.lastError
    return state
  }

  private emit(e: Entry, event: RunEvent): void {
    this.opts.onChange(this.view(e), event)
  }

  /** 退回 idle。lastExit / lastError 留着，界面要显 */
  private finish(e: Entry): void {
    e.phase = 'idle'
    delete e.run
    delete e.proc
    delete e.token
    delete e.aborter
    e.warned = false
  }

  state(dir: string): RunState {
    const e = this.entries.get(dir)
    return e === undefined ? { dir, phase: 'idle' } : this.view(e)
  }

  /** 此刻不在 idle 的全部 */
  all(): RunState[] {
    return [...this.entries.values()].filter((e) => e.phase !== 'idle').map((e) => this.view(e))
  }

  /**
   * 起。`build: true` 先 `pnpm run build` 再 serve。已经在跑回同一份 run（alreadyRunning），
   * 正在起 / 正在停一律拒绝——不并发。失败一律收成回执、退回 idle，不往外抛。
   */
  async start(dir: string, options: { build: boolean }): Promise<StartOutcome> {
    const e = this.entry(dir)
    if (e.phase === 'running' && e.run !== undefined) {
      return { ok: true, run: { ...e.run }, built: false, alreadyRunning: true }
    }
    if (e.phase !== 'idle') return { ok: false, error: `站正在 ${e.phase}，等它完` }

    const token = {}
    const ab = aborter()
    e.token = token
    e.aborter = ab
    delete e.lastError
    delete e.lastExit
    const output = this.opts.output ?? this.opts.log
    try {
      let built = false
      if (options.build) {
        e.phase = 'building'
        this.emit(e, 'building')
        this.opts.log(`build：${dir}`)
        const { proc, done } = this.opts.deps.build(dir, output)
        e.proc = proc
        await Promise.race([done, ab.promise])
        built = true
        this.opts.log('build 完成')
      }
      e.phase = 'starting'
      this.emit(e, 'starting')
      const port = await this.opts.deps.freePort()
      this.opts.log(`start：${dir} 端口 ${String(port)}`)
      const { proc, ready } = this.opts.deps.serve(dir, port, output)
      e.proc = proc
      await Promise.race([ready, ab.promise])
      const now = this.opts.deps.now()
      const run: RunInfo = {
        port,
        pid: proc.pid,
        deadline: deadlineFor(now, this.opts.autoStopMinutes()),
        startedAt: now,
        url: `http://localhost:${String(port)}`,
      }
      e.run = run
      e.phase = 'running'
      e.warned = false
      this.emit(e, 'started')
      this.opts.log(`就绪：${run.url}`)
      // 服务自己退了（崩了、被人从外面杀了）：退回 idle 并出声
      void proc.exited.then((code) => {
        if (e.proc !== proc || e.phase !== 'running') return
        e.lastExit = code
        this.opts.log(`${dir} 的服务自己退了（退出码 ${String(code)}）`)
        this.finish(e)
        this.emit(e, 'stopped')
      })
      return { ok: true, run: { ...run }, built, alreadyRunning: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // stop / disposeAll 从中间打断的：那边已经杀过树、收过尾了，这儿只回失败
      if (e.token === token) {
        const pid = e.proc?.pid
        if (pid !== undefined) await this.opts.deps.killTree(pid)
        e.lastError = message
        this.opts.log(`起失败：${dir}——${message}`)
        this.finish(e)
        this.emit(e, 'failed')
      }
      return { ok: false, error: message }
    }
  }

  /** 停。building / starting 也停得了（打断那次 start）；idle 什么都不做 */
  async stop(dir: string): Promise<boolean> {
    const e = this.entries.get(dir)
    if (e === undefined || e.phase === 'idle' || e.phase === 'stopping') return false
    e.phase = 'stopping'
    this.emit(e, 'stopping')
    const pid = e.proc?.pid
    if (pid !== undefined) await this.opts.deps.killTree(pid)
    e.aborter?.abort('中途被停了')
    this.finish(e)
    this.emit(e, 'stopped')
    this.opts.log(`已停：${dir}`)
    return true
  }

  /** 延长：到期时刻从此刻按设置重算，提醒标记清零。没在跑回 undefined */
  extend(dir: string): RunInfo | undefined {
    const e = this.entries.get(dir)
    if (e === undefined || e.phase !== 'running' || e.run === undefined) return undefined
    e.run.deadline = deadlineFor(this.opts.deps.now(), this.opts.autoStopMinutes())
    e.warned = false
    this.emit(e, 'extended')
    this.opts.log(`${dir} 延到 ${e.run.deadline === undefined ? '不自动关' : new Date(e.run.deadline).toLocaleTimeString()}`)
    return { ...e.run }
  }

  /** 对表：到点的停，进提前量的提醒一次 */
  tick(): void {
    const now = this.opts.deps.now()
    for (const e of this.entries.values()) {
      if (e.phase !== 'running' || e.run === undefined) continue
      const due = dueState(e.run.deadline, now)
      if (due === 'expired') {
        this.opts.log(`${e.dir} 到点，自动关`)
        this.emit(e, 'expired')
        void this.stop(e.dir)
      } else if (due === 'warn' && !e.warned) {
        e.warned = true
        this.emit(e, 'warn')
      }
    }
  }

  /** 件卸载时调：杀光自己起的全部站，包括还在 build / starting 的 */
  async disposeAll(): Promise<void> {
    await Promise.all([...this.entries.values()].filter((e) => e.phase !== 'idle').map((e) => this.stop(e.dir)))
  }
}
