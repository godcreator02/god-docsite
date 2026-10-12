import { describe, expect, it } from 'vitest'
import { dayMs, dayOf, isLaterThanModule, isoDateOf, moduleProgressOf, timelineAxisOf } from '../src/timeline.js'

describe('甘特图的时间轴', () => {
  it('日期与 UTC 零点的毫秒数互换', () => {
    expect(isoDateOf(dayOf('2026-10-11'))).toBe('2026-10-11')
    expect(dayOf('2026-10-12') - dayOf('2026-10-11')).toBe(dayMs)
  })

  it('模块的进度从归进它的任务算', () => {
    const tasks = [
      { module: 'm1', status: 'done' },
      { module: 'm1', status: 'doing' },
      { module: 'm2', status: 'done' },
      { status: 'todo' },
    ]
    expect(moduleProgressOf('m1', tasks)).toEqual({ done: 1, total: 2 })
    expect(moduleProgressOf('m3', tasks)).toEqual({ done: 0, total: 0 })
  })

  it('任务的截止日晚于所属模块的截止日才算晚；没有模块或没有截止日不算', () => {
    const modules = [{ id: 'm1', due: '2026-10-31' }]
    expect(isLaterThanModule({ module: 'm1', due: '2026-11-01' }, modules)).toBe(true)
    expect(isLaterThanModule({ module: 'm1', due: '2026-10-31' }, modules)).toBe(false)
    expect(isLaterThanModule({ due: '2026-12-01' }, modules)).toBe(false)
    expect(isLaterThanModule({ module: 'm1' }, modules)).toBe(false)
  })

  it('从最早的日子前两天画到最晚的日子后三天，每月一号一个刻度', () => {
    const today = dayOf('2026-10-11')
    const axis = timelineAxisOf([dayOf('2026-11-20')], today)
    expect(isoDateOf(axis.from)).toBe('2026-10-09')
    expect(isoDateOf(axis.to)).toBe('2026-11-23')
    expect(axis.monthStarts.map(isoDateOf)).toEqual(['2026-11-01'])
    expect(axis.percentOf(axis.from)).toBe(0)
    expect(axis.percentOf(axis.to)).toBe(100)
  })
})
