import { describe, expect, it } from 'vitest'
import { resolveIdentity } from '../src/server/identity.js'
import type { StoredPerson } from '../src/server/people-file.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['probezhou001'], gitea: 'zhou' },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('resolveIdentity：按宿主提供的码解析身份', () => {
  it('码在人员列表里就是那个人；person 不带 codes', () => {
    expect(resolveIdentity(people, 'probezhou001')).toEqual({ person: { id: 'zhou', name: '小周', gitea: 'zhou' } })
    expect('codes' in resolveIdentity(people, 'probezhou001').person!).toBe(false)
  })

  it('没有码、码不在列表里时只读并写明原因；原因与结果里都不出现码本身', () => {
    const noCode = resolveIdentity(people, undefined)
    expect(noCode.person).toBeNull()
    expect(noCode.reason).toContain('只读')
    expect(noCode.reason).not.toContain('probezhou001')

    const unknown = resolveIdentity(people, 'nosuchcode01')
    expect(unknown.person).toBeNull()
    expect(unknown.reason).toContain('不在 people.json 里')
    expect(unknown.reason).not.toContain('nosuchcode01')
  })

  it('多码的人：任一码都能认出', () => {
    const multi: StoredPerson[] = [{ id: 'zhou', name: '小周', codes: ['probezhou001', 'probezhou002'] }]
    expect(resolveIdentity(multi, 'probezhou002').person?.id).toBe('zhou')
  })
})
