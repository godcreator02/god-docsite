import { describe, expect, it } from 'vitest'
import { personOf, publicPeopleOf, publicPersonOf, type Person } from '../src/index.js'
import type { StoredPerson } from '../src/server/index.js'

const stored: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['probezhou001'], gitea: 'zhou' },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('公开投影', () => {
  it('按白名单重造：输入带 codes 与别的服务端字段时，输出只有 id、name（及可选 gitea/agent），输入原样', () => {
    const input = stored[0]!
    const projected = publicPersonOf(input)
    expect(projected).toEqual({ id: 'zhou', name: '小周', gitea: 'zhou' })
    expect('codes' in projected).toBe(false)
    expect(input).toEqual({ id: 'zhou', name: '小周', codes: ['probezhou001'], gitea: 'zhou' })
    expect(publicPeopleOf(stored)).toEqual([
      { id: 'zhou', name: '小周', gitea: 'zhou' },
      { id: 'claude', name: 'Claude', agent: true },
    ])
  })

  it('结构化类型带着多余字段的对象（声明成 Person）同样只投影白名单字段', () => {
    const sneaky: Person = { id: 'li', name: '小李', codes: ['probeli00001'], extra: 'server-only' } as Person & { codes: string[]; extra: string }
    expect(publicPersonOf(sneaky)).toEqual({ id: 'li', name: '小李' })
  })

  it('personOf 按 id 取人；取不到时报错点名', () => {
    expect(personOf(stored, 'claude').name).toBe('Claude')
    expect(() => personOf(stored, 'nobody')).toThrow('people.json 里没有 nobody')
  })
})
