import { describe, expect, it } from 'vitest'
import { assertCommentPagesExist, commentFrontmatterSchema, commentThreadsByPage, commentThreadsOf, nthIndexOf, occurrenceIndexAt, type CommentEntry } from '../src/comments.js'

const validate = (path: string, value: unknown) => commentFrontmatterSchema({ path })['~standard'].validate(value)

describe('评论的 frontmatter', () => {
  it('index.md 与 index.mdx 按发起的那条校验，时间统一成 ISO；YAML 读成 Date 的也收', () => {
    const thread = { author: '小周', createdAt: new Date('2026-10-10T14:05:00+08:00'), page: '/writing', anchor: 'k3f9a1', quote: '原文', quoteIndex: 2, status: 'open' }
    const expected = { kind: 'thread', author: '小周', createdAt: '2026-10-10T06:05:00.000Z', page: '/writing', anchor: 'k3f9a1', quote: '原文', quoteIndex: 2, status: 'open' }
    expect(validate('/site/comments/a/index.mdx', thread)).toEqual({ value: expected })
    expect(validate('/site/comments/a/index.md', thread)).toEqual({ value: expected })
  })

  it('批整块只写 anchor，已解决的写解决人与时间', () => {
    expect(validate('/c/a/index.md', { author: 'a', createdAt: '2026-10-10', page: '/', status: 'resolved', anchor: 'b1', resolvedBy: 'b', resolvedAt: '2026-10-11' })).toEqual({
      value: { kind: 'thread', author: 'a', createdAt: '2026-10-10T00:00:00.000Z', page: '/', status: 'resolved', anchor: 'b1', resolvedBy: 'b', resolvedAt: '2026-10-11T00:00:00.000Z' },
    })
  })

  it('其余文件按回复校验，回复里不能写 page', () => {
    expect(validate('C:\\site\\comments\\a\\answer.md', { author: 'Claude', createdAt: '2026-10-10T14:12:00+08:00' })).toEqual({
      value: { kind: 'reply', author: 'Claude', createdAt: '2026-10-10T06:12:00.000Z' },
    })
    const result = validate('/site/comments/a/answer.mdx', { author: 'Claude', createdAt: '2026-10-10', page: '/' })
    expect(result.issues?.map((issue) => issue.message)).toEqual(['认不出 page，能写的只有 author、createdAt'])
  })

  it('缺字段、page 不以 / 开头、status 写错、quote 没有 anchor、quoteIndex 写错、写了认不出的字段时一次列出全部', () => {
    const result = validate('/site/comments/a/index.mdx', { createdAt: 'yesterday', page: 'writing', status: 'done', quote: 'x', quoteIndex: 0, block: {} })
    expect(result.issues?.map((issue) => issue.message)).toEqual([
      '认不出 block，能写的只有 author、createdAt、page、status、anchor、quote、quoteIndex、resolvedBy、resolvedAt',
      'author 要是非空字符串',
      'createdAt 要是时间，如 2026-10-10T12:00:00+08:00',
      'page 写页面地址，以 / 开头，如 /writing',
      'status 要是 open 或 resolved',
      'quote 要和 anchor 一起写：先标出是哪一块，再写块里的哪几个字',
      'quoteIndex 要是从 1 数的整数：quote 在这一块的文字里第几次出现',
    ])
  })

  it('anchor 只能有字母数字，quoteIndex 不能单独写', () => {
    const result = validate('/c/a/index.md', { author: 'a', createdAt: '2026-10-10', page: '/', status: 'open', anchor: 'a b', quoteIndex: 1 })
    expect(result.issues?.map((issue) => issue.message)).toEqual(['anchor 只能有字母、数字、- 和 _，现在是 a b', 'quoteIndex 要和 quote 一起写'])
  })
})

const thread = (path: string, createdAt: string, page = '/'): CommentEntry => ({ kind: 'thread', author: 'a', createdAt, page, status: 'open', info: { path } })
const reply = (path: string, createdAt: string): CommentEntry => ({ kind: 'reply', author: 'b', createdAt, info: { path } })

describe('评论串', () => {
  it('按文件夹分组，评论串按发起时间排，回复按时间排', () => {
    const threads = commentThreadsOf([reply('b/2.md', '3'), thread('b/index.md', '2'), reply('b/1.mdx', '2.5'), thread('a/index.mdx', '1')])
    expect(threads.map((t) => [t.id, t.replies.map((r) => r.info.path)])).toEqual([
      ['a', []],
      ['b', ['b/1.mdx', 'b/2.md']],
    ])
  })

  it('文件不在一层文件夹里、只有回复、index.md 与 index.mdx 都有时报错，一次列出全部', () => {
    expect(() => commentThreadsOf([thread('loose.md', '1'), reply('c/1.md', '1'), thread('d/index.md', '1'), thread('d/index.mdx', '1')])).toThrow(
      'loose.md 要放在评论串自己的文件夹里，一层，如 2026-10-10-search/index.md\n评论串 d 里 index.md 和 index.mdx 只能有一个\n评论串 c 只有回复，没有发起的 index.md',
    )
  })

  it('批的页面不存在时报错', () => {
    const threads = commentThreadsOf([thread('a/index.md', '1', '/gone'), thread('b/index.md', '2', '/')])
    expect(() => assertCommentPagesExist(threads, ['/'])).toThrow('评论串 a 批的页面 /gone 不存在')
  })

  it('按批的页面分组', () => {
    const byPage = commentThreadsByPage(commentThreadsOf([thread('a/index.md', '1', '/x'), thread('b/index.md', '2', '/'), thread('c/index.md', '3', '/x')]))
    expect([...byPage].map(([page, threads]) => [page, threads.map((t) => t.id)])).toEqual([
      ['/x', ['a', 'c']],
      ['/', ['b']],
    ])
  })
})

describe('在一块的文字里数第几次出现', () => {
  it('第 n 次出现的位置；出现不到那么多次时返回 undefined', () => {
    expect(nthIndexOf('A一A二A', 'A', 1)).toBe(0)
    expect(nthIndexOf('A一A二A', 'A', 3)).toBe(4)
    expect(nthIndexOf('A一A二A', 'A', 4)).toBeUndefined()
  })

  it('选中的那一处是第几次出现', () => {
    expect(occurrenceIndexAt('A一A二A', 'A', 0)).toBe(1)
    expect(occurrenceIndexAt('A一A二A', 'A', 2)).toBe(2)
    expect(occurrenceIndexAt('AAA', 'AA', 1)).toBe(2)
  })
})
