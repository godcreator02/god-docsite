import { describe, expect, it } from 'vitest'
import type { PushEvent } from '../../../src/organization/events/messages.js'
import { EventScheduler } from '../../../src/organization/events/scheduler.js'

describe('推送触发的刷新', () => {
  const pushToCollab: PushEvent = { kind: 'push', repo: 'collab', ref: 'refs/heads/main' }
  const pullOpened: PushEvent = { kind: 'pr', repo: 'firmware', action: 'opened', number: 3 }

  function schedulerWith(results: Array<'busy' | 'done'>) {
    let now = 0
    const timers: Array<{ at: number; run: () => void }> = []
    const refreshed: number[] = []
    const applied: Array<{ at: number; events: PushEvent[] }> = []
    const scheduler = new EventScheduler({
      refresh: async () => {
        refreshed.push(now)
        return results.shift() ?? 'done'
      },
      apply: async (_repo, events) => {
        applied.push({ at: now, events })
        return results.shift() ?? 'done'
      },
      now: () => now,
      setTimeout: (run, milliseconds) => {
        timers.push({ at: now + milliseconds, run })
      },
    })
    /** 时间走到 to，到点的定时器依次运行 */
    const advance = async (to: number) => {
      for (;;) {
        timers.sort((a, b) => a.at - b.at)
        const next = timers[0]
        if (next === undefined || next.at > to) break
        timers.shift()
        now = next.at
        next.run()
        // 让刷新的 Promise 走完（结果是 busy 时它会再排一个定时器）
        await new Promise((resolve) => setImmediate(resolve))
      }
      now = to
    }
    return { scheduler, refreshed, applied, advance }
  }

  it('完整刷新等 2 秒再做，期间来的要求合成一次', async () => {
    const { scheduler, refreshed, advance } = schedulerWith([])
    scheduler.request('repo', 'full')
    scheduler.request('repo', 'full')
    await advance(1_500)
    scheduler.request('repo', 'full')
    await advance(5_000)
    expect(refreshed).toEqual([2_000])
  })

  it('完整刷新同一个项目最快每 10 秒一次', async () => {
    const { scheduler, refreshed, advance } = schedulerWith([])
    scheduler.request('repo', 'full')
    await advance(3_000)
    scheduler.request('repo', 'full')
    await advance(30_000)
    expect(refreshed).toEqual([2_000, 12_000])
  })

  it('轮到时项目正在刷新：不丢，过一会儿再试', async () => {
    const { scheduler, refreshed, advance } = schedulerWith(['busy'])
    scheduler.request('repo', 'full')
    await advance(30_000)
    expect(refreshed).toEqual([2_000, 12_000])
  })

  it('按消息做的 2 秒内攒成一批一起做，不受完整刷新 10 秒一次的限制', async () => {
    const { scheduler, refreshed, applied, advance } = schedulerWith([])
    scheduler.request('repo', 'full')
    await advance(2_500)
    scheduler.request('repo', pushToCollab)
    await advance(3_000)
    scheduler.request('repo', pullOpened)
    await advance(10_000)
    expect(refreshed).toEqual([2_000])
    expect(applied).toEqual([{ at: 4_500, events: [pushToCollab, pullOpened] }])
  })

  it('同一批里也要完整刷新时只做完整刷新：它会把那几处一起做到', async () => {
    const { scheduler, refreshed, applied, advance } = schedulerWith([])
    scheduler.request('repo', pushToCollab)
    scheduler.request('repo', 'full')
    await advance(10_000)
    expect(refreshed).toEqual([2_000])
    expect(applied).toEqual([])
  })

  it('按消息做时项目正在刷新：那几处一个不丢，过一会儿再做', async () => {
    const { scheduler, applied, advance } = schedulerWith(['busy'])
    scheduler.request('repo', pushToCollab)
    scheduler.request('repo', pullOpened)
    await advance(10_000)
    expect(applied).toEqual([
      { at: 2_000, events: [pushToCollab, pullOpened] },
      { at: 4_000, events: [pushToCollab, pullOpened] },
    ])
  })
})
