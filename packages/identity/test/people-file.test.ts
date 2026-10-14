import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StoredPerson } from '../src/core/index.js'
import { joinSitePeople, sitePeople, writeSitePeople } from '../src/node/index.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('写站点的 people.json', () => {
  let siteDir: string
  beforeEach(async () => {
    siteDir = await mkdtemp(path.join(tmpdir(), 'identity-people-'))
  })
  afterEach(async () => {
    await rm(siteDir, { recursive: true })
  })

  it('一项一行写回，读回来一样', async () => {
    await writeSitePeople(siteDir, people)
    expect(await readFile(path.join(siteDir, 'people.json'), 'utf8')).toBe(
      '[\n  {"id":"zhou","name":"小周","codes":["zhoucode0001"]},\n  {"id":"claude","name":"Claude","agent":true}\n]\n',
    )
    expect(sitePeople(siteDir)).toEqual(people)
  })

  it('不合法的列表写不进去，文件不动', async () => {
    await writeSitePeople(siteDir, people)
    await expect(writeSitePeople(siteDir, [...people, { id: 'zhou', name: '又一个小周' }])).rejects.toThrow('id zhou 和前面的重复了')
    expect(sitePeople(siteDir)).toEqual(people)
  })

  it('加入：新码写进那个人的 codes；码已经在他名下时不动文件', async () => {
    await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
    expect(await joinSitePeople(siteDir, 'zhoucode0002', { id: 'zhou', name: '小周' })).toEqual({ changed: true })
    expect(sitePeople(siteDir)[0]!.codes).toEqual(['zhoucode0001', 'zhoucode0002'])
    const before = await readFile(path.join(siteDir, 'people.json'), 'utf8')
    expect(await joinSitePeople(siteDir, 'zhoucode0002', { id: 'zhou', name: '小周' })).toEqual({ changed: false })
    expect(await readFile(path.join(siteDir, 'people.json'), 'utf8')).toBe(before)
    await expect(joinSitePeople(siteDir, 'zhoucode0001', { id: 'li', name: '小李' })).rejects.toThrow('已经写在 zhou 名下')
  })
})
