// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { identityOf, type StoredPerson } from '@godcreator/identity'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCommentFile, threadsOf } from '../src/core/index.js'
import { createReply, createThread, readCommentThreads, setThreadStatus } from '../src/node/index.js'
import { handleCommentWrite, pageThreadsOf, type CommentWriteResult } from '../src/site/index.server.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'claude', name: 'Claude', agent: true },
]
const trustedOrigin = 'http://127.0.0.1:4430'

let commentsDir: string
beforeEach(async () => {
  commentsDir = path.join(await mkdtemp(path.join(tmpdir(), 'comments-status-')), 'comments')
})
afterEach(async () => {
  await rm(path.dirname(commentsDir), { recursive: true })
})

const headFileOf = (threadId: string) => path.join(commentsDir, threadId, 'index.mdx')

describe('评论串的状态：串头 frontmatter 的 status', () => {
  it('新建的串写 status: "open"；标为已解决写上谁、什么时候，别的字段与正文不动；重新打开去掉这两项', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: '串头正文', anchor: 'a-heading' })
    const before = await readFile(headFileOf(id), 'utf-8')
    expect(before).toMatch(/^status: "open"$/m)

    const { resolved } = await setThreadStatus(commentsDir, id, 'resolved', { by: 'zhou', now: new Date('2026-10-15T08:00:00.000Z') })
    expect(resolved).toEqual({ by: 'zhou', at: '2026-10-15T08:00:00.000Z' })
    const after = await readFile(headFileOf(id), 'utf-8')
    expect(after).toMatch(/^status: "resolved"\nresolvedBy: "zhou"\nresolvedAt: "2026-10-15T08:00:00.000Z"$/m)
    expect(after.replace(/^(status|resolvedBy|resolvedAt): .*\n/gm, '')).toBe(before.replace(/^status: .*\n/m, ''))
    expect((await readCommentThreads(commentsDir))[0]!.head.resolved).toEqual({ by: 'zhou', at: '2026-10-15T08:00:00.000Z' })

    await setThreadStatus(commentsDir, id, 'open')
    expect(await readFile(headFileOf(id), 'utf-8')).toBe(before)
    expect((await readCommentThreads(commentsDir))[0]!.head.resolved).toBeUndefined()
  })

  it('已经是这个状态就拒绝（409）并写明谁标的；串不存在 404；标为已解决缺 by 400', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: 'x' })
    await expect(setThreadStatus(commentsDir, id, 'open')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('本来就是未解决') as unknown })
    await setThreadStatus(commentsDir, id, 'resolved', { by: 'zhou', now: new Date('2026-10-15T08:00:00.000Z') })
    await expect(setThreadStatus(commentsDir, id, 'resolved', { by: 'zhou' })).rejects.toMatchObject({ status: 409, message: expect.stringContaining('zhou 在 2026-10-15T08:00:00.000Z 标的') as unknown })
    await expect(setThreadStatus(commentsDir, '20261012t080000-nope', 'resolved', { by: 'zhou' })).rejects.toMatchObject({ status: 404 })
    await setThreadStatus(commentsDir, id, 'open')
    await expect(setThreadStatus(commentsDir, id, 'resolved')).rejects.toMatchObject({ status: 400 })
  })

  it('不写 status 的旧串头算未解决；状态写得不对直接报错并点名文件', () => {
    const head = (status: string) => `---\nauthor: "zhou"\ncreatedAt: "2026-10-12T08:00:00.000Z"\npage: "index.mdx"\n${status}---\n\n正文\n`
    expect(parseCommentFile('20261012t080000-old/index.mdx', head('')).resolved).toBeUndefined()
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head('status: "done"\n'))).toThrow(/20261012t080000-bad\/index\.mdx 的 status 只能是 open 或 resolved/)
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head('status: "resolved"\n'))).toThrow(/要有 resolvedBy 与 resolvedAt/)
    expect(() => parseCommentFile('20261012t080000-bad/index.mdx', head('status: "open"\nresolvedBy: "zhou"\n'))).toThrow(/不能有 resolvedBy/)
  })

  it('回复不能带状态：读文件与整理评论串都报错', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: 'x' })
    const reply = await createReply(commentsDir, id, { authorId: 'zhou', body: '回复' })
    const replyFile = path.join(commentsDir, reply.path)
    await writeFile(replyFile, (await readFile(replyFile, 'utf-8')).replace('---\n\n', 'status: "resolved"\n---\n\n'))
    await expect(readCommentThreads(commentsDir)).rejects.toThrow(/是回复，不能有 status/)
    expect(() =>
      threadsOf([
        { path: `${id}/index.mdx`, authorId: 'zhou', createdAt: 'x', page: 'index.mdx' },
        { path: reply.path, authorId: 'zhou', createdAt: 'x', resolved: { by: 'zhou', at: 'x' } },
      ]),
    ).toThrow(/回复不能带已解决状态/)
  })
})

describe('评论写入 action：标为已解决与重新打开', () => {
  /** code 为 null：本机没有身份码 */
  async function write(fields: Record<string, string>, code: string | null = 'zhoucode0001'): Promise<{ result: CommentWriteResult; status: number }> {
    const form = new FormData()
    for (const [name, value] of Object.entries(fields)) form.set(name, value)
    const request = new Request('http://127.0.0.1:4430/comments', { method: 'POST', headers: { Origin: trustedOrigin }, body: form })
    const returned = await handleCommentWrite({ request, commentsDir, people, identity: identityOf(people, code ?? undefined), trustedOrigin })
    return { result: returned.data, status: returned.init?.status ?? 200 }
  }

  it('resolve-thread 记下本机身份（as 给 agent 时记 agent）；reopen-thread 改回未解决；重复标 409；只读 403', async () => {
    const { id } = await createThread(commentsDir, { page: 'index.mdx', authorId: 'zhou', body: 'x' })
    expect(await write({ intent: 'resolve-thread', threadId: id })).toEqual({ status: 200, result: { ok: true, intent: 'resolve-thread', threadId: id } })
    expect((await readCommentThreads(commentsDir))[0]!.head.resolved?.by).toBe('zhou')
    expect((await write({ intent: 'resolve-thread', threadId: id })).status).toBe(409)
    expect(await write({ intent: 'reopen-thread', threadId: id })).toEqual({ status: 200, result: { ok: true, intent: 'reopen-thread', threadId: id } })
    expect(await write({ intent: 'resolve-thread', threadId: id, as: 'claude' })).toMatchObject({ status: 200 })
    expect((await readCommentThreads(commentsDir))[0]!.head.resolved?.by).toBe('claude')
    expect((await write({ intent: 'reopen-thread', threadId: id }, null)).status).toBe(403)
    expect((await write({ intent: 'resolve-thread', threadId: id, body: 'x' })).result).toMatchObject({ ok: false, error: expect.stringContaining('resolve-thread 认不出字段 body') as unknown })
  })

  it('页面 loader 读出的串带上标的人（{id, name}）与时刻', async () => {
    const entry = (fields: Record<string, string>) => ({ info: { path: '20261012t080000-seed1/index.mdx' }, author: 'zhou', createdAt: '2026-10-12T08:00:00.000Z', page: 'index.mdx', ...fields })
    const [resolved] = pageThreadsOf({ entries: [entry({ status: 'resolved', resolvedBy: 'claude', resolvedAt: '2026-10-15T08:00:00.000Z' })], people, page: 'index.mdx' })
    expect(resolved!.resolved).toEqual({ by: { id: 'claude', name: 'Claude' }, at: '2026-10-15T08:00:00.000Z' })
    const [open] = pageThreadsOf({ entries: [entry({ status: 'open' })], people, page: 'index.mdx' })
    expect(open!.resolved).toBeUndefined()
  })
})
