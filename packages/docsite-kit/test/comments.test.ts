import { describe, expect, it } from 'vitest'
import { assertCommentPagesExist, commentablePagesOf, commentFrontmatterSchema, commentThreadsOf, snapshotMismatchOf, type CommentEntry } from '../src/comments.js'

const validate = (path: string, value: unknown) => commentFrontmatterSchema({ path })['~standard'].validate(value)

describe('能批的页面', () => {
  it('content/ 的页面，加上功能包标了 comments 的路由下的页面：:参数是一段，* 是余下的全部', () => {
    const isCommentable = commentablePagesOf(['/writing'], ['tasks', 'tasks/:recordId', 'files/*'])
    expect(['/writing', '/tasks', '/tasks/t-1', '/files/a/b.pdf'].filter(isCommentable)).toHaveLength(4)
    expect(['/writing/x', '/tasks/t-1/more', '/taskss', '/calendar/2026-10-11'].some(isCommentable)).toBe(false)
  })
})

describe('评论的 frontmatter', () => {
  it('index.mdx 按发起的那条校验，时间统一成 ISO；YAML 读成 Date 的也收；评论文件写成 .md 时报错', () => {
    const thread = { author: '小周', createdAt: new Date('2026-10-10T14:05:00+08:00'), page: '/writing', quote: '原文', range: [3, 5], status: 'open' }
    const expected = { kind: 'thread', author: '小周', createdAt: '2026-10-10T06:05:00.000Z', page: '/writing', quote: '原文', range: [3, 5], status: 'open' }
    expect(validate('/site/comments/a/index.mdx', thread)).toEqual({ value: expected })
    expect(validate('/site/comments/a/index.md', thread).issues?.map((issue) => issue.message)).toEqual(['评论文件一律写成 .mdx：把扩展名改成 .mdx'])
    expect(validate('/site/comments/a/answer.md', { author: 'a', createdAt: '2026-10-10' }).issues?.map((issue) => issue.message)).toEqual(['评论文件一律写成 .mdx：把扩展名改成 .mdx'])
  })

  it('批一个元素写 element 与 range，已解决的写解决人与时间', () => {
    expect(validate('/c/a/index.mdx', { author: 'a', createdAt: '2026-10-10', page: '/', status: 'resolved', element: 'formula', range: [0, 1], resolvedBy: 'b', resolvedAt: '2026-10-11' })).toEqual({
      value: { kind: 'thread', author: 'a', createdAt: '2026-10-10T00:00:00.000Z', page: '/', status: 'resolved', element: 'formula', range: [0, 1], resolvedBy: 'b', resolvedAt: '2026-10-11T00:00:00.000Z' },
    })
  })

  it('quote、element 少了 range，range 写错或单独写时报错', () => {
    const base = { author: 'a', createdAt: '2026-10-10', page: '/', status: 'open' }
    expect(validate('/c/a/index.mdx', { ...base, quote: 'x' }).issues?.map((issue) => issue.message)).toEqual(['写了 quote 或 element 就要写 range：批的是快照里的哪一段'])
    expect(validate('/c/a/index.mdx', { ...base, element: 'code', range: [5, 5] }).issues?.map((issue) => issue.message)).toEqual(['range 要写成 [start, end]：快照里从 0 数的两个位置，start 小于 end'])
    expect(validate('/c/a/index.mdx', { ...base, range: [0, 1] }).issues?.map((issue) => issue.message)).toEqual(['range 要和 quote 或 element 一起写；都不写是批整页'])
  })

  it('openers 写成 [[start, end], …] 并和 range 一起写；写错、单独写时报错', () => {
    const base = { author: 'a', createdAt: '2026-10-10', page: '/', status: 'open' }
    expect(validate('/c/a/index.mdx', { ...base, element: 'component', range: [13, 19], openers: [[0, 5], [5, 13]] })).toEqual({
      value: { kind: 'thread', author: 'a', createdAt: '2026-10-10T00:00:00.000Z', page: '/', status: 'open', element: 'component', range: [13, 19], openers: [[0, 5], [5, 13]] },
    })
    expect(validate('/c/a/index.mdx', { ...base, quote: 'x', range: [0, 1], openers: [] }).issues?.map((issue) => issue.message)).toEqual(['openers 要写成 [[start, end], …]：每个按钮在快照里从 0 数的两个位置，由外到里'])
    expect(validate('/c/a/index.mdx', { ...base, openers: [[0, 1]] }).issues?.map((issue) => issue.message)).toEqual(['openers 要和 range 一起写'])
  })

  it('其余文件按回复校验，回复里不能写 page', () => {
    expect(validate('C:\\site\\comments\\a\\answer.mdx', { author: 'Claude', createdAt: '2026-10-10T14:12:00+08:00' })).toEqual({
      value: { kind: 'reply', author: 'Claude', createdAt: '2026-10-10T06:12:00.000Z' },
    })
    const result = validate('/site/comments/a/answer.mdx', { author: 'Claude', createdAt: '2026-10-10', page: '/' })
    expect(result.issues?.map((issue) => issue.message)).toEqual(['认不出 page，能写的只有 author、createdAt'])
  })

  it('缺字段、page 不以 / 开头、status 写错、quote 与 block 都写、block 写错时一次列出全部', () => {
    const result = validate('/site/comments/a/index.mdx', { createdAt: 'yesterday', page: 'writing', status: 'done', quote: 'x', element: 'video', range: [0, 1] })
    expect(result.issues?.map((issue) => issue.message)).toEqual([
      'author 要是非空字符串',
      'createdAt 要是时间，如 2026-10-10T12:00:00+08:00',
      'page 写页面地址，以 / 开头，如 /writing',
      'status 要是 open 或 resolved',
      'element 要是 image、formula、code、table、text、component 之一',
      'quote 和 element 只能写一个：批一段文字写 quote，批一个元素写 element',
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

  it('文件不在一层文件夹里、只有回复时报错，一次列出全部', () => {
    expect(() => commentThreadsOf([thread('loose.mdx', '1'), reply('c/1.mdx', '1')])).toThrow(
      'loose.mdx 要放在评论串自己的文件夹里，一层，如 2026-10-10-search/index.mdx\n评论串 c 只有回复，没有发起的 index.mdx',
    )
  })

  it('批的页面不存在时报错', () => {
    const threads = commentThreadsOf([thread('a/index.mdx', '1', '/gone'), thread('b/index.mdx', '2', '/')])
    expect(() => assertCommentPagesExist(threads, ['/'])).toThrow('评论串 a 批的页面 /gone 不存在')
    expect(() => assertCommentPagesExist(threads, ['/'], ['gone'])).not.toThrow()
  })
})

describe('frontmatter 与快照', () => {
  it('quote 等于快照里 range 那一段才对得上；批整页的不用快照', () => {
    expect(snapshotMismatchOf({ quote: '乙丙', range: [1, 3] }, '甲乙丙丁')).toBeUndefined()
    expect(snapshotMismatchOf({}, '')).toBeUndefined()
    expect(snapshotMismatchOf({ quote: '乙丙', range: [0, 2] }, '甲乙丙丁')).toBe('quote 和快照里 range 那一段不一样：快照里是「甲乙」')
    expect(snapshotMismatchOf({ range: [2, 9] }, '甲乙丙丁')).toBe('range [2, 9] 超出了快照（共 4 个字）')
  })
})
