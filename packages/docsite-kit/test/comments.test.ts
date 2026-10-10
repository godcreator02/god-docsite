import { describe, expect, it } from 'vitest'
import { assertCommentPagesExist, commentFrontmatterSchema, commentThreadsOf, locateQuote, type CommentEntry } from '../src/comments.js'

const validate = (path: string, value: unknown) => commentFrontmatterSchema({ path })['~standard'].validate(value)

describe('评论的 frontmatter', () => {
  it('index.md 与 index.mdx 按发起的那条校验，时间统一成 ISO；YAML 读成 Date 的也收', () => {
    const thread = { author: '小周', createdAt: new Date('2026-10-10T14:05:00+08:00'), page: '/writing', quote: '原文', quotePrefix: '前', quoteSuffix: '后', status: 'open' }
    const expected = { kind: 'thread', author: '小周', createdAt: '2026-10-10T06:05:00.000Z', page: '/writing', quote: '原文', quotePrefix: '前', quoteSuffix: '后', status: 'open' }
    expect(validate('/site/comments/a/index.mdx', thread)).toEqual({ value: expected })
    expect(validate('/site/comments/a/index.md', thread)).toEqual({ value: expected })
  })

  it('整块评论写 block，已解决的写解决人与时间', () => {
    const block = { kind: 'code', heading: '代码', index: 1, text: 'import' }
    expect(validate('/c/a/index.md', { author: 'a', createdAt: '2026-10-10', page: '/', status: 'resolved', block, resolvedBy: 'b', resolvedAt: '2026-10-11' })).toEqual({
      value: { kind: 'thread', author: 'a', createdAt: '2026-10-10T00:00:00.000Z', page: '/', status: 'resolved', block, resolvedBy: 'b', resolvedAt: '2026-10-11T00:00:00.000Z' },
    })
  })

  it('其余文件按回复校验，回复里不能写 page', () => {
    expect(validate('C:\\site\\comments\\a\\answer.md', { author: 'Claude', createdAt: '2026-10-10T14:12:00+08:00' })).toEqual({
      value: { kind: 'reply', author: 'Claude', createdAt: '2026-10-10T06:12:00.000Z' },
    })
    const result = validate('/site/comments/a/answer.mdx', { author: 'Claude', createdAt: '2026-10-10', page: '/' })
    expect(result.issues?.map((issue) => issue.message)).toEqual(['认不出 page，能写的只有 author、createdAt'])
  })

  it('缺字段、page 不以 / 开头、status 写错、quote 与 block 都写、block 写错时一次列出全部', () => {
    const result = validate('/site/comments/a/index.mdx', { createdAt: 'yesterday', page: 'writing', status: 'done', quote: 'x', block: { kind: 'video', heading: '', index: 0, text: '' } })
    expect(result.issues?.map((issue) => issue.message)).toEqual([
      'author 要是非空字符串',
      'createdAt 要是时间，如 2026-10-10T12:00:00+08:00',
      'page 写页面地址，以 / 开头，如 /writing',
      'status 要是 open 或 resolved',
      'block.kind 要是 image、code、table、component 之一',
      'block.index 要是从 1 数的整数',
      'quote 和 block 只能写一个：批一段文字写 quote，批一整块写 block',
    ])
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
})

describe('在正文里找原文', () => {
  it('只出现一次就是那一处，前后文对不上也认', () => {
    expect(locateQuote('甲乙丙丁', '乙丙', '不是这个', '也不是')).toBe(1)
  })

  it('出现好几次时取前后文都对得上的那一处', () => {
    expect(locateQuote('左A右，前A后', 'A', '前', '后')).toBe(5)
  })

  it('找不到、或者好几处都对不上前后文时返回 undefined', () => {
    expect(locateQuote('甲乙', '丙')).toBeUndefined()
    expect(locateQuote('左A右，前A后', 'A', '上', '下')).toBeUndefined()
  })
})
