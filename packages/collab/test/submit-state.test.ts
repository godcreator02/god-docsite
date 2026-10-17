import { describe, expect, it } from 'vitest'
import { notificationOf } from '../src/core/notifications/notifications.js'
import { hasUnsubmittedChanges, isSubmitInProgress, submitBlockersOf, submitStateOf } from '../src/core/notifications/submit-state.js'

describe('一键提交的状态', () => {
  it('按形状逐项查：三种状态各收各的字段，多了、少了、认不出都拒收', () => {
    expect(submitStateOf(null)).toBeNull()
    expect(submitStateOf({ state: 'requested', by: 'bob', at: 't' })).toEqual({ state: 'requested', by: 'bob', at: 't' })
    expect(submitStateOf({ state: 'merged', by: 'bob', at: 't', pull: { number: 3, url: 'u' } })).toEqual({ state: 'merged', by: 'bob', at: 't', pull: { number: 3, url: 'u' } })
    expect(() => submitStateOf({ state: 'done', by: 'bob', at: 't' })).toThrow(/state 要是 requested \/ running \/ merged 之一/)
    expect(() => submitStateOf({ state: 'running', by: 'bob', at: 't', pull: null })).toThrow(/认不出的字段 pull/)
    expect(() => submitStateOf({ state: 'merged', by: 'bob', at: 't' })).toThrow(/缺字段 pull/)
    expect(() => submitStateOf('requested')).toThrow(/要是对象/)
  })

  it('requested 与 running 算还在提交，merged 与 null 不算', () => {
    expect(isSubmitInProgress({ state: 'requested', by: 'bob', at: 't' })).toBe(true)
    expect(isSubmitInProgress({ state: 'running', by: 'bob', at: 't' })).toBe(true)
    expect(isSubmitInProgress({ state: 'merged', by: 'bob', at: 't', pull: { number: 1, url: 'u' } })).toBe(false)
    expect(isSubmitInProgress(null)).toBe(false)
  })

  it('冲突、不在 main、读不对的记录挡住一键提交，一种一句；有没提交的改动才有按钮', () => {
    const notifications = [
      notificationOf({ kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] }),
      notificationOf({ kind: 'record-problem', file: 'records/a.json', message: 'x' }),
      notificationOf({ kind: 'record-problem', file: 'records/b.json', message: 'y' }),
      notificationOf({ kind: 'sync-problem', reason: 'z' }),
    ]
    expect(submitBlockersOf(notifications)).toEqual(['collab/ 里有读不对的记录'])
    expect(submitBlockersOf([notificationOf({ kind: 'off-main', branch: 'dev' })])).toEqual(['协作仓不在 main 上'])
    expect(hasUnsubmittedChanges(notifications)).toBe(true)
    expect(hasUnsubmittedChanges(notifications.slice(1))).toBe(false)
  })
})
