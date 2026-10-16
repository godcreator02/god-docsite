// @vitest-environment node
import { identityOf, type StoredPerson } from '@godcreator/identity'
import { describe, expect, it } from 'vitest'
import { commentsAccessOf } from '../src/site/index.js'
import { commentsTableRowsOf, pageThreadsOf, threadsByPageOf, type CommentCollectionEntry } from '../src/site/index.server.js'

const people: StoredPerson[] = [
  { id: 'owner', name: '站长', codes: ['ownercode001'] },
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
]

/** 和 fumadocs-mdx 集合条目同形：info.path 加 frontmatter 字段 */
const entryOf = (filePath: string, frontmatter: Record<string, unknown>): CommentCollectionEntry => ({ info: { path: filePath }, ...frontmatter })

const entries = [
  entryOf('20261012t080000-seed1/index.mdx', { page: 'index.mdx', author: 'owner', createdAt: '2026-10-12T08:00:00.000Z', anchor: 'intro' }),
  entryOf('20261012t080000-seed1/20261012t080500-r1a2.mdx', { author: 'zhou', createdAt: '2026-10-12T08:05:00.000Z' }),
  entryOf('20261012t090000-other/index.mdx', { page: 'guide.mdx', author: 'zhou', createdAt: '2026-10-12T09:00:00.000Z' }),
]

describe('页面 loader 读本页评论', () => {
  it('作者换成 {id, name}，身份码不会出现在结果里', () => {
    const threads = pageThreadsOf({ entries, people, page: 'index.mdx' })
    expect(threads).toEqual([
      {
        id: '20261012t080000-seed1',
        headPath: '20261012t080000-seed1/index.mdx',
        page: 'index.mdx',
        anchor: 'intro',
        author: { id: 'owner', name: '站长' },
        createdAt: '2026-10-12T08:00:00.000Z',
        replies: [{ id: '20261012t080500-r1a2', path: '20261012t080000-seed1/20261012t080500-r1a2.mdx', author: { id: 'zhou', name: '小周' }, createdAt: '2026-10-12T08:05:00.000Z' }],
      },
    ])
    expect(JSON.stringify(threads)).not.toContain('code')
  })

  it('全站按页分组，回复跟着串走', () => {
    const byPage = threadsByPageOf({ entries, people })
    expect([...byPage.keys()]).toEqual(['index.mdx', 'guide.mdx'])
    expect(byPage.get('index.mdx')![0]!.replies).toHaveLength(1)
  })

  it('全站评论表：内容页的串带页面标题，功能包页面的串标题写地址，内容页已不在的串不列', () => {
    const byPage = threadsByPageOf({
      entries: [
        ...entries,
        entryOf('20261012t100000-report/index.mdx', { page: '/reports/sample', author: 'owner', createdAt: '2026-10-12T10:00:00.000Z', anchor: 'sec_one' }),
      ],
      people,
    })
    const rows = commentsTableRowsOf(byPage, [{ key: 'index.mdx', title: '首页', url: '/' }])
    expect(rows.map(({ thread, pageTitle, pageUrl }) => [thread.id, pageTitle, pageUrl])).toEqual([
      ['20261012t080000-seed1', '首页', '/'],
      ['20261012t100000-report', '/reports/sample', '/reports/sample'],
    ])
  })

  it('frontmatter 缺作者、字段不是字符串、作者不在人员列表：报错并点名', () => {
    expect(() => pageThreadsOf({ entries: [entryOf('20261012t080000-bad1/index.mdx', { page: 'index.mdx', createdAt: 'x' })], people, page: 'index.mdx' })).toThrow(
      '评论 20261012t080000-bad1/index.mdx 缺 author 字段',
    )
    expect(() =>
      pageThreadsOf({ entries: [entryOf('20261012t080000-bad2/index.mdx', { page: 'index.mdx', author: 'zhou', createdAt: new Date(0) })], people, page: 'index.mdx' }),
    ).toThrow('评论 20261012t080000-bad2/index.mdx 的 createdAt 要是字符串')
    expect(() =>
      pageThreadsOf({ entries: [entryOf('20261012t080000-bad3/index.mdx', { page: 'index.mdx', author: 'nobody', createdAt: 'x' })], people, page: 'index.mdx' }),
    ).toThrow('people.json 里没有 nobody')
  })
})

describe('评论面板的写入口', () => {
  it('有本机身份可写，署名只带 id 与 name；没有就只读并给原因', () => {
    expect(commentsAccessOf(identityOf(people, 'zhoucode0001'))).toEqual({ kind: 'writable', writer: { id: 'zhou', name: '小周' } })
    expect(commentsAccessOf(identityOf(people, undefined))).toMatchObject({ kind: 'readonly', reasonText: expect.stringContaining('只读') as unknown })
  })
})
