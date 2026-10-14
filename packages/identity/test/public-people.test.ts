import { describe, expect, it } from 'vitest'
import { mentionBeingTyped, mentionsOf, peopleMatching, peopleFile, personOf, publicPeopleOf, publicPersonOf, type Person } from '../src/core/index.js'

const people: Person[] = [
  { id: 'zhou', name: '小周', gitea: 'zhou' },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('按 id 取人', () => {
  it('取到同一个人；取不到时报 people.json 里没有', () => {
    expect(personOf(people, 'claude')).toBe(people[1])
    expect(() => personOf(people, 'nobody')).toThrow('people.json 里没有 nobody')
  })
})

describe('公开投影', () => {
  it('publicPersonOf 按白名单重造：只有 id、name、gitea、agent，别的字段进不来', () => {
    const stored = { id: 'zhou', name: '小周', codes: ['zhoucode0001'], gitea: 'zhou', extra: 'x' } as Person & { codes: string[]; extra: string }
    expect(publicPersonOf(stored)).toEqual({ id: 'zhou', name: '小周', gitea: 'zhou' })
    expect('codes' in publicPersonOf(stored)).toBe(false)
    expect(publicPeopleOf([stored, { id: 'claude', name: 'Claude', agent: true }])).toEqual([
      { id: 'zhou', name: '小周', gitea: 'zhou' },
      { id: 'claude', name: 'Claude', agent: true },
    ])
  })
})

describe('评论正文里的 @id', () => {
  it('只认人员列表里的，按出现顺序、不重复', () => {
    expect(mentionsOf('@zhou 看一下，也请 @claude 和 @nobody，再 @zhou；mail@zhou 不算', people)).toEqual(['zhou', 'claude'])
  })
})

describe('写 @ 时弹出的名单', () => {
  it('光标前是 @ 加几个字：认出 @ 的位置和已经打的字', () => {
    expect(mentionBeingTyped('看一下 @zh')).toEqual({ start: 4, query: 'zh' })
    expect(mentionBeingTyped('@')).toEqual({ start: 0, query: '' })
  })

  it('邮箱、@@、@ 后面已经打了空格：不算在打 @', () => {
    expect(mentionBeingTyped('mail a@b')).toBeNull()
    expect(mentionBeingTyped('@@zh')).toBeNull()
    expect(mentionBeingTyped('@zhou ')).toBeNull()
  })

  it('按 id 或名字筛，id 以打的字开头的排前面', () => {
    const team: Person[] = [{ id: 'azhou', name: '阿周' }, { id: 'zhou', name: '小周' }, { id: 'li', name: '小李' }]
    expect(peopleMatching(team, 'zh').map((person) => person.id)).toEqual(['zhou', 'azhou'])
    expect(peopleMatching(team, '小').map((person) => person.id)).toEqual(['zhou', 'li'])
    expect(peopleMatching(team, '').map((person) => person.id)).toEqual(['azhou', 'zhou', 'li'])
  })
})

describe('peopleFile', () => {
  it('人员列表的文件名是 people.json', () => {
    expect(peopleFile).toBe('people.json')
  })
})
