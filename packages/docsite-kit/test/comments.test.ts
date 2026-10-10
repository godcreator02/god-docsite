import { describe, expect, it } from 'vitest'
import { assertCommentPagesExist, commentFrontmatterSchema, commentThreadsOf, type CommentEntry } from '../src/comments.js'
import { placeCards } from '../src/ui/comment-placement.js'

const validate = (path: string, value: unknown) => commentFrontmatterSchema({ path })['~standard'].validate(value)

describe('评论的 frontmatter', () => {
  it('index.mdx 按发起的那条校验，时间统一成 ISO；YAML 读成 Date 的也收', () => {
    expect(validate('/site/comments/a/index.mdx', { author: '小周', createdAt: new Date('2026-10-10T14:05:00+08:00'), page: '/writing', quote: '原文', status: 'open' })).toEqual({
      value: { kind: 'thread', author: '小周', createdAt: '2026-10-10T06:05:00.000Z', page: '/writing', quote: '原文', status: 'open' },
    })
  })

  it('其余文件按回复校验，回复里不能写 page', () => {
    expect(validate('C:\\site\\comments\\a\\answer.mdx', { author: 'Claude', createdAt: '2026-10-10T14:12:00+08:00' })).toEqual({
      value: { kind: 'reply', author: 'Claude', createdAt: '2026-10-10T06:12:00.000Z' },
    })
    const result = validate('/site/comments/a/answer.mdx', { author: 'Claude', createdAt: '2026-10-10', page: '/' })
    expect(result.issues?.map((issue) => issue.message)).toEqual(['认不出 page，能写的只有 author、createdAt'])
  })

  it('缺字段、page 不以 / 开头、status 写错时一次列出全部', () => {
    const result = validate('/site/comments/a/index.mdx', { createdAt: 'yesterday', page: 'writing', status: 'done' })
    expect(result.issues?.map((issue) => issue.message)).toEqual([
      'author 要是非空字符串',
      'createdAt 要是时间，如 2026-10-10T12:00:00+08:00',
      'page 写页面地址，以 / 开头，如 /writing',
      'status 要是 open 或 resolved',
    ])
  })
})

const thread = (path: string, createdAt: string, page = '/'): CommentEntry => ({ kind: 'thread', author: 'a', createdAt, page, status: 'open', info: { path } })
const reply = (path: string, createdAt: string): CommentEntry => ({ kind: 'reply', author: 'b', createdAt, info: { path } })

describe('评论串', () => {
  it('按文件夹分组，评论串按发起时间排，回复按时间排', () => {
    const threads = commentThreadsOf([reply('b/2.mdx', '3'), thread('b/index.mdx', '2'), reply('b/1.mdx', '2.5'), thread('a/index.mdx', '1')])
    expect(threads.map((t) => [t.id, t.replies.map((r) => r.info.path)])).toEqual([
      ['a', []],
      ['b', ['b/1.mdx', 'b/2.mdx']],
    ])
  })

  it('文件不在一层文件夹里、文件夹里没有 index.mdx 时报错，一次列出全部', () => {
    expect(() => commentThreadsOf([thread('loose.mdx', '1'), reply('c/1.mdx', '1')])).toThrow(
      'loose.mdx 要放在评论串自己的文件夹里，一层，如 2026-10-10-search/index.mdx\n评论串 c 只有回复，没有发起的 index.mdx',
    )
  })

  it('批的页面不存在时报错', () => {
    const threads = commentThreadsOf([thread('a/index.mdx', '1', '/gone'), thread('b/index.mdx', '2', '/')])
    expect(() => assertCommentPagesExist(threads, ['/'])).toThrow('评论串 a 批的页面 /gone 不存在')
  })
})

describe('评论卡片的位置', () => {
  const cards = [
    { id: 'a', wantedTop: 0, height: 100 },
    { id: 'b', wantedTop: 50, height: 100 },
    { id: 'c', wantedTop: 400, height: 50 },
  ]

  it('没有选中的：对齐原文，挨得太近就往下推', () => {
    expect(Object.fromEntries(placeCards(cards, undefined, 10))).toEqual({ a: 0, b: 110, c: 400 })
  })

  it('选中的正好对齐原文，上面的往上让', () => {
    expect(Object.fromEntries(placeCards(cards, 'b', 10))).toEqual({ a: -60, b: 50, c: 400 })
  })
})
