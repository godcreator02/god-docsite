import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parsePeople, readPeopleFile } from '../src/server/people-file.js'

const valid = [
  { id: 'zhou', name: '小周', codes: ['probezhou001'] },
  { id: 'li', name: '小李', codes: ['probeli00001'] },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('parsePeople：people.json 的盘协议（沿用既有规则）', () => {
  it('合法内容原样通过；agent 不写 codes，gitea 可选', () => {
    expect(parsePeople(valid)).toEqual(valid)
    expect(parsePeople([{ id: 'a', name: '甲', codes: ['aaaaaaaa01'], gitea: 'a' }])).toEqual([{ id: 'a', name: '甲', codes: ['aaaaaaaa01'], gitea: 'a' }])
  })

  it('不是数组、项不是对象时指出写法', () => {
    expect(() => parsePeople({})).toThrow('要是一个数组')
    expect(() => parsePeople(['zhou'])).toThrow('要是 { "id": …, "name": … }')
  })

  it('id 重复、码重复、未知键各报各的错，一次列全', () => {
    const duplicatedId = parsePeople.bind(null, [
      { id: 'zhou', name: '小周', codes: ['probezhou001'] },
      { id: 'zhou', name: '又一个小周' },
    ])
    expect(duplicatedId).toThrow('id zhou 和前面的重复了')
    const duplicatedCode = parsePeople.bind(null, [
      { id: 'zhou', name: '小周', codes: ['probezhou001'] },
      { id: 'li', name: '小李', codes: ['probezhou001'] },
    ])
    expect(duplicatedCode).toThrow('probezhou001 已经写在 zhou 名下')
    expect(() => parsePeople([{ id: 'zhou', name: '小周', email: 'x@y' }])).toThrow('认不出 email')
  })

  it('码的规则：8 到 64 个小写字母或数字；agent 写 codes 报错；codes 要是非空数组', () => {
    expect(() => parsePeople([{ id: 'a', name: '甲', codes: ['short'] }])).toThrow('8 到 64 个小写字母或数字')
    expect(() => parsePeople([{ id: 'a', name: '甲', codes: ['UPPERCASE1'] }])).toThrow('8 到 64 个小写字母或数字')
    expect(() => parsePeople([{ id: 'a', name: '甲', codes: [] }])).toThrow('至少一个')
    expect(() => parsePeople([{ id: 'a', name: '甲', agent: true, codes: ['aaaaaaaa01'] }])).toThrow('agent 没有身份码')
  })
})

describe('readPeopleFile：站点目录里读 people.json', () => {
  let siteDir: string
  beforeEach(async () => {
    siteDir = await mkdtemp(path.join(tmpdir(), 'identity-boundary-'))
  })
  afterEach(async () => {
    await rm(siteDir, { recursive: true })
  })

  it('没有文件、内容不是 JSON 时报错说明', () => {
    expect(() => readPeopleFile(siteDir)).toThrow('站点目录里没有 people.json')
  })

  it('写好后能读，且每次重新读：改盘不用重启', async () => {
    const file = path.join(siteDir, 'people.json')
    await writeFile(file, JSON.stringify(valid))
    expect(readPeopleFile(siteDir)).toEqual(valid)
    await writeFile(file, JSON.stringify([{ id: 'li', name: '小李', codes: ['probeli00001'] }]))
    expect(readPeopleFile(siteDir)).toHaveLength(1)
  })
})
