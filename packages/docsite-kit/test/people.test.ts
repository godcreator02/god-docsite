import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertCommentAuthorsKnown, type CommentEntry } from '../src/comments.js'
import { identityCodeEnvName, identityOf, mentionBeingTyped, mentionsOf, parsePeople, peopleMatching, peopleWithJoined, type Person } from '../src/people.js'
import { siteCommenter, siteIdentity, sitePeople } from '../src/server/comments.js'

const people: Person[] = [
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

  it('按身份码找人：没有码、码不在列表里时只读，写明原因', () => {
    expect(identityOf(people, 'zhoucode0001')).toEqual({ person: people[0] })
    expect(identityOf(people, undefined).reason).toContain('不是经 gwb 插件 gwb-docsite 启动的')
    expect(identityOf(people, 'othercode001').reason).toContain('本机的身份码 othercode001 不在 people.json 里')
  })

  it('把本机的码加进人员列表：已有这个人就加进他的 codes，没有就新加一项', () => {
    expect(peopleWithJoined(people, 'zhoucode0002', { id: 'zhou', name: '小周' })[0]!.codes).toEqual(['zhoucode0001', 'zhoucode0002'])
    expect(peopleWithJoined(people, 'zhoucode0001', { id: 'zhou', name: '小周' })[0]!.codes).toEqual(['zhoucode0001'])
    expect(peopleWithJoined(people, 'licode000001', { id: 'li', name: '小李', gitea: 'li' })[2]).toEqual({ id: 'li', name: '小李', codes: ['licode000001'], gitea: 'li' })
    expect(() => peopleWithJoined(people, 'zhoucode0001', { id: 'li', name: '小李' })).toThrow('身份码 zhoucode0001 已经写在 zhou 名下')
    expect(() => peopleWithJoined(people, 'botcode00001', { id: 'claude', name: 'Claude' })).toThrow('claude 是 agent')
    expect(() => peopleWithJoined(people, 'zhoucode0002', { id: 'zhou', name: '小周', gitea: 'someone' })).toThrow('zhou 的 gitea 写的是 zhou，不是 someone')
  })

  it('评论正文里的 @id：只认人员列表里的，按出现顺序、不重复', () => {
    expect(mentionsOf('@zhou 看一下，也请 @claude 和 @nobody，再 @zhou；mail@zhou 不算', people)).toEqual(['zhou', 'claude'])
  })

  it('评论的 author、resolvedBy 不在人员列表里时报错，一次列出全部', () => {
    const entry = (path: string, author: string) => ({ author, createdAt: '1', info: { path } })
    const head = { ...entry('a/index.mdx', 'zhou'), kind: 'thread', page: '/', status: 'resolved', resolvedBy: 'wang' } as CommentEntry & { kind: 'thread'; page: string; status: 'resolved' }
    const reply = { ...entry('a/r.mdx', '小周'), kind: 'reply' } as CommentEntry & { kind: 'reply' }
    expect(() => assertCommentAuthorsKnown([{ id: 'a', head, replies: [reply] }], people)).toThrow(
      'a/r.mdx 的 author 小周 不在 people.json 里\na/index.mdx 的 resolvedBy wang 不在 people.json 里',
    )
  })
})

describe('站点目录里的人员列表', () => {
  let siteDir: string
  beforeEach(async () => {
    siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-people-'))
  })
  afterEach(async () => {
    delete process.env[identityCodeEnvName]
    await rm(siteDir, { recursive: true })
  })

  it('没有 people.json 时报错，写明怎么写；写评论的人按环境变量里的身份码找', async () => {
    expect(() => sitePeople(siteDir)).toThrow('站点目录里没有 people.json')
    await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
    expect(sitePeople(siteDir)).toEqual(people)
    expect(siteCommenter(siteDir)).toBeNull()
    expect(siteIdentity(siteDir).reason).toContain('没有本机的身份码')
    process.env[identityCodeEnvName] = 'zhoucode0001'
    expect(siteCommenter(siteDir)).toEqual(people[0])
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
