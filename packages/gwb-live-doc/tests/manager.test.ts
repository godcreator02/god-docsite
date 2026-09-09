import { describe, expect, it } from 'vitest'
import { SiteManager, type RunEvent, type RunnerDeps, type RunState } from '../src/manager.js'

/**
 * 起停状态机——**不起真进程**：运行器那几样（挑口、build、serve、杀树、时钟）全喂假的，
 * 看状态怎么迁、事件怎么发、到点怎么停。真起子进程的那半在 runner.slow.test.ts。
 */

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(err: Error): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 一套可操控的假运行器：build 与 serve 的完成都由用例手动兑现 */
function fakeDeps(): RunnerDeps & {
  builds: Array<{ dir: string; done: Deferred<void> }>
  serves: Array<{ dir: string; port: number; ready: Deferred<void>; exited: Deferred<number | null>; pid: number }>
  killed: number[]
  clock: { now: number }
} {
  let nextPid = 1000
  let nextPort = 40000
  const deps = {
    builds: [] as Array<{ dir: string; done: Deferred<void> }>,
    serves: [] as Array<{ dir: string; port: number; ready: Deferred<void>; exited: Deferred<number | null>; pid: number }>,
    killed: [] as number[],
    clock: { now: 1_700_000_000_000 },
    freePort: () => Promise.resolve(nextPort++),
    build: (dir: string) => {
      const done = deferred<void>()
      deps.builds.push({ dir, done })
      const pid = nextPid++
      return { proc: { pid, exited: done.promise.then(() => 0, () => 1) }, done: done.promise }
    },
    serve: (dir: string, port: number) => {
      const ready = deferred<void>()
      const exited = deferred<number | null>()
      const pid = nextPid++
      deps.serves.push({ dir, port, ready, exited, pid })
      return { proc: { pid, exited: exited.promise }, ready: ready.promise }
    },
    killTree: (pid: number) => {
      deps.killed.push(pid)
      // 杀了树，serve 那头就退了
      const s = deps.serves.find((x) => x.pid === pid)
      s?.exited.resolve(null)
      return Promise.resolve()
    },
    now: () => deps.clock.now,
  }
  return deps
}

function make(minutes = 120) {
  const deps = fakeDeps()
  const events: Array<{ event: RunEvent; state: RunState }> = []
  const manager = new SiteManager({
    deps,
    autoStopMinutes: () => minutes,
    log: () => {},
    onChange: (state, event) => events.push({ event, state: structuredClone(state) }),
  })
  return { deps, events, manager }
}

const DIR = 'D:\\u\\repo\\docs-site'

/** 让微任务队列跑空——假 promise 兑现之后状态机那头还要几步 await */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('SiteManager：起', () => {
  it('build:false 直接 serve；端口就绪后 running，带端口、pid、到期时刻', async () => {
    const { deps, manager, events } = make(120)
    const outcome = manager.start(DIR, { build: false })
    await flush()
    expect(deps.builds).toEqual([])
    expect(deps.serves).toHaveLength(1)
    expect(manager.state(DIR).phase).toBe('starting')
    deps.serves[0]!.ready.resolve()
    const got = await outcome
    expect(got.ok).toBe(true)
    if (!got.ok) return
    expect(got.run.port).toBe(40000)
    expect(got.run.pid).toBe(1000)
    expect(got.run.deadline).toBe(deps.clock.now + 120 * 60_000)
    expect(got.run.url).toBe('http://localhost:40000')
    expect(manager.state(DIR).phase).toBe('running')
    expect(events.map((e) => e.event)).toEqual(['starting', 'started'])
  })

  it('build:true 先 build，成了再 serve', async () => {
    const { deps, manager, events } = make()
    const outcome = manager.start(DIR, { build: true })
    await flush()
    expect(deps.builds).toHaveLength(1)
    expect(deps.serves).toEqual([])
    expect(manager.state(DIR).phase).toBe('building')
    deps.builds[0]!.done.resolve()
    await flush()
    expect(deps.serves).toHaveLength(1)
    deps.serves[0]!.ready.resolve()
    const got = await outcome
    expect(got.ok && got.built).toBe(true)
    expect(events.map((e) => e.event)).toEqual(['building', 'starting', 'started'])
  })

  it('build 失败：回失败、不 serve、退回 idle、发 failed', async () => {
    const { deps, manager, events } = make()
    const outcome = manager.start(DIR, { build: true })
    await flush()
    deps.builds[0]!.done.reject(new Error('build 退出码 1'))
    const got = await outcome
    expect(got.ok).toBe(false)
    if (got.ok) return
    expect(got.error).toContain('build 退出码 1')
    expect(deps.serves).toEqual([])
    expect(manager.state(DIR).phase).toBe('idle')
    expect(events.at(-1)?.event).toBe('failed')
  })

  it('serve 没就绪就退：杀树兜底、回失败、退回 idle', async () => {
    const { deps, manager } = make()
    const outcome = manager.start(DIR, { build: false })
    await flush()
    deps.serves[0]!.ready.reject(new Error('60 秒内端口没应答'))
    const got = await outcome
    expect(got.ok).toBe(false)
    expect(deps.killed).toEqual([1000])
    expect(manager.state(DIR).phase).toBe('idle')
  })

  it('已经在跑：再起回同一份 run，alreadyRunning 标出来，不再起第二个进程', async () => {
    const { deps, manager } = make()
    const first = manager.start(DIR, { build: false })
    await flush()
    deps.serves[0]!.ready.resolve()
    await first
    const again = await manager.start(DIR, { build: false })
    expect(again.ok && again.alreadyRunning).toBe(true)
    expect(deps.serves).toHaveLength(1)
  })

  it('正在起的时候再起：拒绝，不并发', async () => {
    const { deps, manager } = make()
    const first = manager.start(DIR, { build: false })
    await flush()
    const second = await manager.start(DIR, { build: false })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error).toContain('starting')
    deps.serves[0]!.ready.resolve()
    await first
  })

  it('auto-stop 0：没有到期时刻', async () => {
    const { deps, manager } = make(0)
    const outcome = manager.start(DIR, { build: false })
    await flush()
    deps.serves[0]!.ready.resolve()
    const got = await outcome
    expect(got.ok && got.run.deadline).toBeUndefined()
  })
})

async function startRunning(minutes = 120) {
  const ctx = make(minutes)
  const outcome = ctx.manager.start(DIR, { build: false })
  await flush()
  ctx.deps.serves[0]!.ready.resolve()
  await outcome
  ctx.events.length = 0
  return ctx
}

describe('SiteManager：停、退、延', () => {
  it('stop：杀整棵树、退回 idle、发 stopped', async () => {
    const { deps, manager, events } = await startRunning()
    await manager.stop(DIR)
    expect(deps.killed).toEqual([1000])
    expect(manager.state(DIR).phase).toBe('idle')
    expect(manager.state(DIR).run).toBeUndefined()
    expect(events.map((e) => e.event)).toEqual(['stopping', 'stopped'])
  })

  it('stop 一个没在跑的：无事发生', async () => {
    const { manager, events } = make()
    await manager.stop(DIR)
    expect(events).toEqual([])
  })

  it('服务自己退了：退回 idle、发 stopped（reason exited）', async () => {
    const { deps, manager, events } = await startRunning()
    deps.serves[0]!.exited.resolve(1)
    await flush()
    expect(manager.state(DIR).phase).toBe('idle')
    expect(events.map((e) => e.event)).toEqual(['stopped'])
    expect(events[0]?.state.lastExit).toBe(1)
  })

  it('extend：到期时刻从此刻重算、发 extended、提醒标记清零', async () => {
    const { deps, manager, events } = await startRunning(60)
    deps.clock.now += 50 * 60_000
    const run = manager.extend(DIR)
    expect(run?.deadline).toBe(deps.clock.now + 60 * 60_000)
    expect(events.map((e) => e.event)).toEqual(['extended'])
  })

  it('extend 一个没在跑的回 undefined', () => {
    const { manager } = make()
    expect(manager.extend(DIR)).toBeUndefined()
  })
})

describe('SiteManager：对表', () => {
  it('还早：tick 什么都不发', async () => {
    const { deps, manager, events } = await startRunning(120)
    deps.clock.now += 10 * 60_000
    manager.tick()
    expect(events).toEqual([])
  })

  it('进了五分钟提前量：发一次 warn，再 tick 不重复', async () => {
    const { deps, manager, events } = await startRunning(120)
    deps.clock.now += 116 * 60_000
    manager.tick()
    manager.tick()
    expect(events.map((e) => e.event)).toEqual(['warn'])
  })

  it('延长之后提前量重新算：再进提前量再提醒一次', async () => {
    const { deps, manager, events } = await startRunning(60)
    deps.clock.now += 56 * 60_000
    manager.tick()
    manager.extend(DIR)
    deps.clock.now += 56 * 60_000
    manager.tick()
    expect(events.map((e) => e.event)).toEqual(['warn', 'extended', 'warn'])
  })

  it('到点：自动停，发 expired 再 stopping / stopped', async () => {
    const { deps, manager, events } = await startRunning(120)
    deps.clock.now += 120 * 60_000
    manager.tick()
    await flush()
    expect(deps.killed).toEqual([1000])
    expect(manager.state(DIR).phase).toBe('idle')
    expect(events.map((e) => e.event)).toEqual(['expired', 'stopping', 'stopped'])
  })

  it('没有到期时刻的永远不停', async () => {
    const { deps, manager, events } = await startRunning(0)
    deps.clock.now += 1000 * 60 * 60_000
    manager.tick()
    expect(events).toEqual([])
  })
})

describe('SiteManager：dispose', () => {
  it('杀光自己起的全部站——包括还在 build / starting 的', async () => {
    const { deps, manager } = make()
    const a = manager.start('D:\\a', { build: false })
    const b = manager.start('D:\\b', { build: true })
    await flush()
    deps.serves[0]!.ready.resolve()
    await a
    await manager.disposeAll()
    expect(deps.killed.sort()).toEqual([1000, 1001])
    expect(manager.all()).toEqual([])
    // 那个还在 build 的 start 也得收尾，不能悬着
    const gotB = await b
    expect(gotB.ok).toBe(false)
  })
})
