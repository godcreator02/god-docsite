import { describe, expect, it } from 'vitest'
import { identityCodePattern, parsePeople, peopleWithJoined, type StoredPerson } from '../src/core/index.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'], gitea: 'zhou' },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('人员列表', () => {
  it('people.json 是 { id, name, codes?, gitea?, agent? } 的数组；写错时一次列出全部', () => {
    expect(parsePeople(people)).toEqual(people)
    expect(() => parsePeople({ zhou: '小周' })).toThrow('people.json 要是一个数组')
    expect(() =>
      parsePeople([
        { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
        { id: 'zhou', name: '' },
        { id: '小 李', name: '小李', agent: 'yes', role: 'x' },
        'li',
        { id: 'li', name: '小李', codes: ['zhoucode0001', 'BAD'] },
        { id: 'bot', name: 'Bot', agent: true, codes: ['botcode00001'] },
      ]),
    ).toThrow(
      [
        'people.json 第 2 项：id zhou 和前面的重复了',
        'people.json 第 2 项：name 要是非空字符串',
        'people.json 第 3 项：认不出 role，能写的只有 id、name、codes、gitea、agent',
        'people.json 第 3 项：id 要是字母、数字、_、- 组成的字符串',
        'people.json 第 3 项：agent 要是 true 或 false',
        'people.json 第 4 项 要是 { "id": …, "name": … }',
        'people.json 第 5 项：身份码 zhoucode0001 已经写在 zhou 名下，一个码只能是一个人的',
        'people.json 第 5 项：身份码 BAD 要是 8 到 64 个小写字母或数字',
        'people.json 第 6 项：agent 没有身份码，去掉 codes',
      ].join('\n'),
    )
  })

  it('身份码是 8 到 64 个小写字母或数字', () => {
    expect(identityCodePattern.test('zhoucode0001')).toBe(true)
    expect(identityCodePattern.test('abc')).toBe(false)
    expect(identityCodePattern.test('ABC12345')).toBe(false)
    expect(identityCodePattern.test('a'.repeat(65))).toBe(false)
  })

  it('把本机的码加进人员列表：已有这个人就加进他的 codes，没有就新加一项', () => {
    expect(peopleWithJoined(people, 'zhoucode0002', { id: 'zhou', name: '小周' })[0]!.codes).toEqual(['zhoucode0001', 'zhoucode0002'])
    expect(peopleWithJoined(people, 'zhoucode0001', { id: 'zhou', name: '小周' })[0]!.codes).toEqual(['zhoucode0001'])
    expect(peopleWithJoined(people, 'licode000001', { id: 'li', name: '小李', gitea: 'li' })[2]).toEqual({ id: 'li', name: '小李', codes: ['licode000001'], gitea: 'li' })
    expect(() => peopleWithJoined(people, 'zhoucode0001', { id: 'li', name: '小李' })).toThrow('身份码 zhoucode0001 已经写在 zhou 名下')
    expect(() => peopleWithJoined(people, 'botcode00001', { id: 'claude', name: 'Claude' })).toThrow('claude 是 agent')
    expect(() => peopleWithJoined(people, 'zhoucode0002', { id: 'zhou', name: '小周', gitea: 'someone' })).toThrow('zhou 的 gitea 写的是 zhou，不是 someone')
  })
})
