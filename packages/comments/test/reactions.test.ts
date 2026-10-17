// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { identityOf, type StoredPerson } from '@godcreator/identity'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCommentFile, reactionsOf, serializeReactions } from '../src/core/index.js'
import { createReply, createThread, readCommentThreads, setReaction } from '../src/node/index.js'
import { handleCommentWrite, pageThreadsOf, type CommentWriteResult } from '../src/site/index.server.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'wang', name: '小王', codes: ['wangcode0001'] },
  { id: 'claude', name: 'Claude', agent: true },
]
const trustedOrigin = 'http://127.0.0.1:4430'

let commentsDir: string
beforeEach(async () => {
  commentsDir = path.join(await mkdtemp(path.join(tmpdir(), 'comments-reactions-')), 'comments')
})
afterEach(async () => {
  await rm(path.dirname(commentsDir), { recursive: true })
})

describe('表情回应：评论文件 frontmatter 的 reactions', () => {
  it('加上写成 JSON 字符串、按表情的固定顺序；撤到没人时去掉字段，文件回到原样', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: '串头正文' })
    const headFile = path.join(commentsDir, id, 'index.mdx')
    const before = await readFile(headFile, 'utf-8')

    await setReaction(commentsDir, id, { emoji: '🎉', by: 'zhou', on: true })
    await setReaction(commentsDir, id, { emoji: '👍', by: 'wang', on: true })
    const { reactions } = await setReaction(commentsDir, id, { emoji: '👍', by: 'zhou', on: true })
    expect(reactions).toEqual({ '🎉': ['zhou'], '👍': ['wang', 'zhou'] })
    expect(await readFile(headFile, 'utf-8')).toMatch(/^reactions: "\{\\"👍\\":\[\\"wang\\",\\"zhou\\"\],\\"🎉\\":\[\\"zhou\\"\]\}"$/m)
    expect((await readCommentThreads(commentsDir))[0]!.head.reactions).toEqual({ '👍': ['wang', 'zhou'], '🎉': ['zhou'] })

    await setReaction(commentsDir, id, { emoji: '👍', by: 'wang', on: false })
    await setReaction(commentsDir, id, { emoji: '👍', by: 'zhou', on: false })
    await setReaction(commentsDir, id, { emoji: '🎉', by: 'zhou', on: false })
    expect(await readFile(headFile, 'utf-8')).toBe(before)
    expect((await readCommentThreads(commentsDir))[0]!.head.reactions).toBeUndefined()
  })

  it('回复上也能点；重复加、没点过还撤 409；评论不存在 404', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: 'x' })
    const reply = await createReply(commentsDir, id, { authorId: 'wang', body: '回复' })
    await setReaction(commentsDir, id, { replyId: reply.id, emoji: '❤️', by: 'zhou', on: true })
    expect((await readCommentThreads(commentsDir))[0]!.replies[0]!.reactions).toEqual({ '❤️': ['zhou'] })
    await expect(setReaction(commentsDir, id, { replyId: reply.id, emoji: '❤️', by: 'zhou', on: true })).rejects.toMatchObject({ status: 409 })
    await expect(setReaction(commentsDir, id, { emoji: '❤️', by: 'zhou', on: false })).rejects.toMatchObject({ status: 409 })
    await expect(setReaction(commentsDir, id, { replyId: '20261012t080000-nope', emoji: '👍', by: 'zhou', on: true })).rejects.toMatchObject({ status: 404 })
  })

  it('reactions 写得不对直接报错并点名文件', () => {
    const head = (reactions: string) => `---\nauthor: "zhou"\ncreatedAt: "2026-10-12T08:00:00.000Z"\npage: "index.mdx"\nreactions: ${reactions}\n---\n\n正文\n`
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head('"not json"'))).toThrow(/20261012t080000-bad\/index\.mdx 的 reactions 不是合法 JSON/)
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head(JSON.stringify(JSON.stringify({ '🐛': ['zhou'] }))))).toThrow(/不能点的表情/)
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head(JSON.stringify(JSON.stringify({ '👍': [] }))))).toThrow(/非空的人员 id 列表/)
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head(JSON.stringify(JSON.stringify({ '👍': ['zhou', 'zhou'] }))))).toThrow(/重复的人/)
    expect(reactionsOf('x', undefined)).toEqual({})
    expect(serializeReactions({})).toBeUndefined()
  })
})

describe('评论写入 action：add-reaction 与 remove-reaction', () => {
  async function write(fields: Record<string, string>, code: string | null = 'zhoucode0001'): Promise<{ result: CommentWriteResult; status: number }> {
    const form = new FormData()
    for (const [name, value] of Object.entries(fields)) form.set(name, value)
    const request = new Request('http://127.0.0.1:4430/comments', { method: 'POST', headers: { Origin: trustedOrigin }, body: form })
    const returned = await handleCommentWrite({ request, commentsDir, people, identity: identityOf(people, code ?? undefined), trustedOrigin })
    return { result: returned.data, status: returned.init?.status ?? 200 }
  }

  it('点的人是本机身份；replyId 不写或写空串是点在串头；不能点的表情 400；只读 403', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: 'x' })
    const reply = await createReply(commentsDir, id, { authorId: 'wang', body: '回复' })
    expect(await write({ intent: 'add-reaction', threadId: id, emoji: '👍' })).toEqual({ status: 200, result: { ok: true, intent: 'add-reaction', threadId: id } })
    expect(await write({ intent: 'add-reaction', threadId: id, replyId: reply.id, emoji: '👀' }, 'wangcode0001')).toEqual({
      status: 200,
      result: { ok: true, intent: 'add-reaction', threadId: id, replyId: reply.id },
    })
    expect((await write({ intent: 'add-reaction', threadId: id, replyId: '', emoji: '👍' })).status).toBe(409)
    expect((await write({ intent: 'add-reaction', threadId: id, emoji: '🐛' })).result).toMatchObject({ ok: false, error: expect.stringContaining('不能点') as unknown })
    expect((await write({ intent: 'remove-reaction', threadId: id, emoji: '👍' }, null)).status).toBe(403)
    const [thread] = (await readCommentThreads(commentsDir)).map(({ head, replies }) => ({ head: head.reactions, reply: replies[0]!.reactions }))
    expect(thread).toEqual({ head: { '👍': ['zhou'] }, reply: { '👀': ['wang'] } })
    expect(await write({ intent: 'remove-reaction', threadId: id, emoji: '👍' })).toMatchObject({ status: 200 })
    expect((await readCommentThreads(commentsDir))[0]!.head.reactions).toBeUndefined()
  })

  it('页面 loader 读出的回应按表情的固定顺序，人换成 {id, name}', () => {
    const entry = (file: string, reactions: Record<string, string[]>) => ({
      info: { path: `20261012t080000-seed1/${file}` },
      author: 'zhou',
      createdAt: '2026-10-12T08:00:00.000Z',
      ...(file === 'index.mdx' ? { page: 'index.mdx' } : {}),
      reactions: JSON.stringify(reactions),
    })
    const [thread] = pageThreadsOf({
      entries: [entry('index.mdx', { '🚀': ['claude'], '👍': ['wang', 'zhou'] }), entry('20261012t090000-ab12.mdx', { '😄': ['zhou'] })],
      people,
      page: 'index.mdx',
    })
    expect(thread!.reactions).toEqual([
      { emoji: '👍', people: [{ id: 'wang', name: '小王' }, { id: 'zhou', name: '小周' }] },
      { emoji: '🚀', people: [{ id: 'claude', name: 'Claude' }] },
    ])
    expect(thread!.replies[0]!.reactions).toEqual([{ emoji: '😄', people: [{ id: 'zhou', name: '小周' }] }])
  })
})
