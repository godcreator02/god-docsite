import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertCommentAuthorsKnown, type CommentEntry } from '../src/comments.js'
import { parseMe, parsePeople, type Person } from '../src/people.js'
import { siteCommenter, sitePeople } from '../src/server/comments.js'

const people: Person[] = [
  { id: 'zhou', name: '小周' },
  { id: 'claude', name: 'Claude', agent: true },
]

describe('人员列表', () => {
  it('people.json 是 { id, name, agent? } 的数组；写错时一次列出全部', () => {
    expect(parsePeople(people)).toEqual(people)
    expect(() => parsePeople({ zhou: '小周' })).toThrow('people.json 要是一个数组')
    expect(() => parsePeople([{ id: 'zhou', name: '小周' }, { id: 'zhou', name: '' }, { id: '小 李', name: '小李', agent: 'yes', role: 'x' }, 'li'])).toThrow(
      [
        'people.json 第 2 项：id zhou 和前面的重复了',
        'people.json 第 2 项：name 要是非空字符串',
        'people.json 第 3 项：认不出 role，能写的只有 id、name、agent',
        'people.json 第 3 项：id 要是字母、数字、_、- 组成的字符串',
        'people.json 第 3 项：agent 要是 true 或 false',
        'people.json 第 4 项 要是 { "id": …, "name": … }',
      ].join('\n'),
    )
  })

  it('me.json 写 { id }，是人员列表里的一个人，不能是 agent', () => {
    expect(parseMe({ id: 'zhou' }, people)).toEqual({ id: 'zhou', name: '小周' })
    expect(() => parseMe({ id: 'zhou', name: 'x' }, people)).toThrow('me.json 要写成 { "id": "<people.json 里你的 id>" }')
    expect(() => parseMe({ id: 'li' }, people)).toThrow('me.json 写的 li 不在 people.json 里')
    expect(() => parseMe({ id: 'claude' }, people)).toThrow('me.json 写的 claude 是 agent')
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

describe('站点目录里的人员文件', () => {
  let siteDir: string
  beforeEach(async () => {
    siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-people-'))
  })
  afterEach(async () => {
    await rm(siteDir, { recursive: true })
  })

  it('没有 people.json、me.json 时报错，写明怎么写；有了就按 me.json 取写评论的人', async () => {
    expect(() => sitePeople(siteDir)).toThrow('站点目录里没有 people.json')
    await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
    expect(sitePeople(siteDir)).toEqual(people)
    expect(() => siteCommenter(siteDir)).toThrow('站点目录里没有 me.json：写 { "id": "<people.json 里你的 id>" } 说明你是谁，这个文件不进 git')
    await writeFile(path.join(siteDir, 'me.json'), '{ "id": "zhou" }')
    expect(siteCommenter(siteDir)).toEqual({ id: 'zhou', name: '小周' })
  })
})
