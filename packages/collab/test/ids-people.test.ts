import { describe, expect, it } from 'vitest'
import { CollabFormatError, isRecordId, newRecordId, parsePeople, peopleLookupOf, personOfCode, recordTime } from '../src/core/index.js'
import { peopleText } from './fixtures.js'

describe('记录 id', () => {
  it('14 位本地时间加 - 加 7 位小写字母数字', () => {
    const id = newRecordId(new Date(2026, 8, 25, 14, 32, 1), 'k3f9x2a')
    expect(id).toBe('20260925143201-k3f9x2a')
    expect(isRecordId(id)).toBe(true)
  })

  it('不给随机段时自己生成，格式照样对', () => {
    expect(isRecordId(newRecordId(new Date()))).toBe(true)
  })

  it('随机段格式不对就报错', () => {
    expect(() => newRecordId(new Date(), 'ABC')).toThrow(CollabFormatError)
  })

  it('认出格式不对的 id', () => {
    for (const bad of ['20260925143201_k3f9x2a', '2026092514320-k3f9x2a', '20260925143201-K3F9X2A', '20260925143201-k3f9x2']) {
      expect(isRecordId(bad)).toBe(false)
    }
  })

  it('从 id 读出写下时刻', () => {
    expect(recordTime('20260925143201-k3f9x2a')).toBe('2026-09-25 14:32:01')
  })
})

describe('人员列表 site/people.json', () => {
  it('照基础包的格式解析：id、显示名、身份码、Gitea 账号、agent', () => {
    const people = parsePeople(peopleText)
    expect(people.map((person) => person.id)).toEqual(['godcreator', 'bob-test', 'carol-test', 'claude'])
    expect(people[1]).toEqual({ id: 'bob-test', name: '小王', codes: ['bobcode00001'], gitea: 'bob-test' })
  })

  const rejected: Array<[string, string, RegExp]> = [
    ['不是 JSON', '[{', /不是合法 JSON/],
    ['不是数组', '{"people":[]}', /数组/],
    ['认不出的键', '[{"id":"a","name":"A","email":"x"}]', /认不出 email/],
    ['id 重复', '[{"id":"a","name":"A"},{"id":"a","name":"B"}]', /重复/],
    ['缺显示名', '[{"id":"a"}]', /name/],
  ]
  for (const [name, text, message] of rejected) {
    it(`拒绝：${name}`, () => {
      expect(() => parsePeople(text)).toThrow(CollabFormatError)
      expect(() => parsePeople(text)).toThrow(message)
    })
  }

  it('按 id 查显示名：列表里没有的原样显示 id', () => {
    const { nameOf } = peopleLookupOf(parsePeople(peopleText))
    expect(nameOf('bob-test')).toBe('小王')
    expect(nameOf('dave-test')).toBe('dave-test')
  })

  it('按本 home 的身份码找到本机身份；不在列表里为 null', () => {
    const people = parsePeople(peopleText)
    expect(personOfCode(people, 'bobcode00001')?.id).toBe('bob-test')
    expect(personOfCode(people, 'nobody000001')).toBeNull()
  })
})
