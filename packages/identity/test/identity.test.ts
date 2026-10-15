import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { identityOf, type StoredPerson } from '../src/core/index.js'
import { identityCodeEnvName, siteIdentity, sitePeople } from '../src/node/index.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'], gitea: 'zhou' },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('按身份码找人', () => {
  it('码在列表里就是那个人；返回的 person 不带 codes', () => {
    expect(identityOf(people, 'zhoucode0001')).toEqual({ person: { id: 'zhou', name: '小周', gitea: 'zhou' } })
    expect('codes' in identityOf(people, 'zhoucode0001').person!).toBe(false)
  })

  it('没有码、码不在列表里时只读，写明原因；原因和结果里都不出现码本身', () => {
    expect(identityOf(people, undefined).reason).toContain('不是经 gwb 插件 gwb-docsite 启动的')
    const unknown = identityOf(people, 'othercode001')
    expect(unknown.person).toBeNull()
    expect(unknown.reason).toContain('本机的身份码不在 people.json 里')
    expect(unknown.reason).not.toContain('othercode001')
  })
})

describe('站点目录里的人员列表', () => {
  let siteDir: string
  beforeEach(async () => {
    siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-identity-'))
  })
  afterEach(async () => {
    delete process.env[identityCodeEnvName]
    await rm(siteDir, { recursive: true })
  })

  it('没有 people.json 时报错，写明怎么写；写好后每次重新读', async () => {
    expect(() => sitePeople(siteDir)).toThrow('站点目录里没有 people.json')
    await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
    expect(sitePeople(siteDir)).toEqual(people)
  })

  it('dev 下本机身份按环境变量里的身份码找：没有码只读，有码是那个人（不带 codes）', async () => {
    await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
    expect(siteIdentity(siteDir, 'dev').reason).toContain('没有本机的身份码')
    process.env[identityCodeEnvName] = 'zhoucode0001'
    expect(siteIdentity(siteDir, 'dev')).toEqual({ person: { id: 'zhou', name: '小周', gitea: 'zhou' } })
    process.env[identityCodeEnvName] = 'othercode001'
    expect(siteIdentity(siteDir, 'dev').reason).not.toContain('othercode001')
  })

  it('start（发布版）一律只读：环境变量里的身份码在人员列表里也不认', async () => {
    await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
    process.env[identityCodeEnvName] = 'zhoucode0001'
    const identity = siteIdentity(siteDir, 'start')
    expect(identity.person).toBeNull()
    expect(identity.reason).toContain('发布版')
  })
})
