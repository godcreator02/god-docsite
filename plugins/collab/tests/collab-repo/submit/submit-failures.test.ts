import { describe, expect, it } from 'vitest'
import { SubmitFailures } from '../../../src/collab-repo/submit/submit-failures.js'

const at = '2026-10-03T08:00:00.000Z'

describe('提交审核的失败记录', () => {
  it('失败记下原话，之后成功一次就清掉；本来就没有失败时成功不报变化', () => {
    const changed: string[] = []
    const failures = new SubmitFailures((repo) => changed.push(repo))
    failures.record('D:/p/collab', null)
    expect(changed).toEqual([])
    failures.record('D:/p/Collab', { at, message: '被打回' })
    expect(failures.failureOf('d:/p/collab')).toEqual({ at, message: '被打回' })
    failures.record('D:/p/collab', null)
    expect(failures.failureOf('D:/p/collab')).toBeNull()
    expect(changed).toEqual(['D:/p/Collab', 'D:/p/collab'])
  })
})
