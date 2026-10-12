import { describe, expect, it } from 'vitest'
import { collabState, commentDestinationOf, inboxOf, parsePeople, type CommentThreadOnFile } from '../src/task-model/index.js'
import { cleanSnapshot, peopleText, task } from './fixtures.js'

const people = parsePeople(peopleText)

const thread = (id: string, head: Partial<CommentThreadOnFile['head']>, replies: CommentThreadOnFile['replies'] = []): CommentThreadOnFile => ({
  id,
  head: { author: 'bob-test', status: 'open', file: 'index.mdx', body: '', ...head },
  replies,
})

describe('找我的', () => {
  it('任务：负责人是我、还没做完的', () => {
    const state = collabState(cleanSnapshot)
    expect(inboxOf(state, [], 'carol-test', people).tasks.map((each) => each.id)).toEqual([task.id])
    expect(inboxOf(state, [], 'bob-test', people).tasks).toEqual([])
  })

  it('@ 我的：没解决的评论串里别人写的、正文 @<id> 了我的，发起的那条与回复都算；自己 @ 自己不算', () => {
    const threads = [
      thread('a', { page: '/plan', body: '请 @carol-test 看看' }, [{ author: 'godcreator', file: 'r1.mdx', body: '@carol-test 也看下这里' }, { author: 'carol-test', file: 'r2.mdx', body: '@carol-test 自己记一下' }]),
      thread('b', { status: 'resolved', body: '@carol-test 已经解决了' }),
    ]
    expect(inboxOf({ tasks: [] }, threads, 'carol-test', people).mentions).toEqual([
      { in: 'comment', comment: 'a/index.mdx', author: 'bob-test', text: '请 @carol-test 看看', page: '/plan?comment=a' },
      { in: 'reply', comment: 'a/r1.mdx', author: 'godcreator', text: '@carol-test 也看下这里', page: '/plan?comment=a' },
    ])
  })

  it('回复我的：我发起或回复过之后，别人在同一串里的回复；不挂在页面上的去全部评论页', () => {
    const threads = [
      thread('mine', { author: 'carol-test' }, [{ author: 'bob-test', file: 'r1.mdx', body: '收到' }]),
      thread('joined', { page: '/plan' }, [
        { author: 'godcreator', file: 'r1.mdx', body: '在我之前' },
        { author: 'carol-test', file: 'r2.mdx', body: '我来' },
        { author: 'bob-test', file: 'r3.mdx', body: '谢谢' },
      ]),
      thread('other', {}, [{ author: 'godcreator', file: 'r1.mdx', body: '和我无关' }]),
    ]
    expect(inboxOf({ tasks: [] }, threads, 'carol-test', people).repliesToMe).toEqual([
      { comment: 'mine/r1.mdx', author: 'bob-test', text: '收到', threadId: 'mine', page: '/comments?comment=mine' },
      { comment: 'joined/r3.mdx', author: 'bob-test', text: '谢谢', threadId: 'joined', page: '/plan?comment=joined' },
    ])
  })

  it('点一串评论去哪：挂在页面上的去那一页，不挂的去全部评论页，都带上评论串', () => {
    expect(commentDestinationOf({ id: '2026-10-10-abc', head: { page: '/a/b' } })).toBe('/a/b?comment=2026-10-10-abc')
    expect(commentDestinationOf({ id: '2026-10-10-abc', head: {} })).toBe('/comments?comment=2026-10-10-abc')
  })
})
