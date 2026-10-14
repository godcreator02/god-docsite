// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { identityOf, type StoredPerson } from '@godcreator/identity'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readCommentThreads } from '../src/node/index.js'
import { handleCommentWrite, type CommentWriteResult } from '../src/site/index.server.js'

const people: StoredPerson[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'li', name: '小李' },
  { id: 'claude', name: 'Claude', agent: true },
]
const trustedOrigin = 'http://127.0.0.1:4430'
const zhou = identityOf(people, 'zhoucode0001')

let commentsDir: string
beforeEach(async () => {
  commentsDir = path.join(await mkdtemp(path.join(tmpdir(), 'comments-action-')), 'comments')
})
afterEach(async () => {
  await rm(path.dirname(commentsDir), { recursive: true })
})

function postOf(fields: Record<string, string | Blob>, origin: string | null = trustedOrigin): Request {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  const headers = new Headers()
  if (origin !== null) headers.set('Origin', origin)
  return new Request('http://127.0.0.1:4430/docs/page', { method: 'POST', headers, body: form })
}

async function write(request: Request, identity = zhou): Promise<{ result: CommentWriteResult; status: number }> {
  const returned = await handleCommentWrite({ request, commentsDir, people, identity, trustedOrigin })
  return { result: returned.data, status: returned.init?.status ?? 200 }
}

async function createdThreadId(fields: Record<string, string> = {}): Promise<string> {
  const { result } = await write(postOf({ intent: 'create-thread', page: 'index.mdx', body: '串头', ...fields }))
  if (!result.ok || result.threadId === undefined) throw new Error(`建串失败：${JSON.stringify(result)}`)
  return result.threadId
}

describe('评论写入 action：四种 intent', () => {
  it('建串（目录还不存在时连目录一起建）、回复、删回复、删串，作者是本机身份', async () => {
    const threadId = await createdThreadId({ anchor: '{"quote":"原文","start":0,"end":2,"snapshot":"原文"}' })
    const reply = await write(postOf({ intent: 'reply', threadId, body: '回复' }))
    expect(reply).toMatchObject({ status: 200, result: { ok: true, intent: 'reply', threadId } })
    const [thread] = await readCommentThreads(commentsDir)
    expect(thread!.head).toMatchObject({ page: 'index.mdx', authorId: 'zhou', anchor: '{"quote":"原文","start":0,"end":2,"snapshot":"原文"}' })
    expect(thread!.replies.map((each) => each.authorId)).toEqual(['zhou'])

    const replyId = (reply.result as { replyId: string }).replyId
    expect(await write(postOf({ intent: 'delete-reply', threadId, replyId }))).toEqual({ status: 200, result: { ok: true, intent: 'delete-reply' } })
    expect(await write(postOf({ intent: 'delete-thread', threadId }))).toEqual({ status: 200, result: { ok: true, intent: 'delete-thread' } })
    expect(await readdir(commentsDir)).toEqual([])
  })

  it('anchor 是空串当批整页，不写进文件', async () => {
    await createdThreadId({ anchor: '' })
    const [thread] = await readCommentThreads(commentsDir)
    expect(thread!.head.anchor).toBeUndefined()
  })
})

describe('评论写入 action：来源与身份', () => {
  it('Origin 缺了或不是可信 origin：403，不写文件', async () => {
    for (const origin of [null, 'http://evil.example', 'http://127.0.0.1:4450']) {
      expect(await write(postOf({ intent: 'create-thread', page: 'index.mdx', body: 'x' }, origin))).toEqual({
        status: 403,
        result: { ok: false, error: `写入只接受来自 ${trustedOrigin} 的请求` },
      })
    }
    await expect(readdir(commentsDir)).rejects.toThrow()
  })

  it('没有本机身份：403，原因是只读原因', async () => {
    const { status, result } = await write(postOf({ intent: 'create-thread', page: 'index.mdx', body: 'x' }), identityOf(people, undefined))
    expect(status).toBe(403)
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('只读') as unknown })
  })

  it('as 是 agent 就以 agent 署名；as 是人 403；as 空串用当前身份', async () => {
    await write(postOf({ intent: 'create-thread', page: 'a.mdx', body: 'x', as: 'claude' }))
    await write(postOf({ intent: 'create-thread', page: 'b.mdx', body: 'x', as: '' }))
    const authorOfPage = new Map((await readCommentThreads(commentsDir)).map((thread) => [thread.head.page, thread.head.authorId]))
    expect(authorOfPage).toEqual(new Map([['a.mdx', 'claude'], ['b.mdx', 'zhou']]))
    expect((await write(postOf({ intent: 'create-thread', page: 'c.mdx', body: 'x', as: 'li' }))).status).toBe(403)
  })
})

describe('评论写入 action：请求字段', () => {
  it('认不出的 intent、缺字段、多字段、字段是文件、正文空、id 形状不对：400 并说清错在哪', async () => {
    const cases: Array<[Record<string, string | Blob>, string]> = [
      [{ intent: 'resolve', threadId: 'x' }, '认不出 intent "resolve"'],
      [{ page: 'index.mdx', body: 'x' }, '缺 intent 字段'],
      [{ intent: 'create-thread', body: 'x' }, '缺 page 字段'],
      [{ intent: 'create-thread', page: 'index.mdx', body: 'x', threadId: 'y' }, 'create-thread 认不出字段 threadId'],
      [{ intent: 'create-thread', page: 'index.mdx', body: new Blob(['x']) }, 'body 要是文字'],
      [{ intent: 'create-thread', page: 'index.mdx', body: '   ' }, '新建评论串缺少正文'],
      [{ intent: 'delete-thread', threadId: '../escape' }, 'threadId 不是合法 id'],
    ]
    for (const [fields, message] of cases) {
      const { status, result } = await write(postOf(fields))
      expect(status, message).toBe(400)
      expect(result.ok).toBe(false)
      expect((result as { error: string }).error).toContain(message)
    }
  })

  it('请求体不是表单：400', async () => {
    const request = new Request('http://127.0.0.1:4430/docs/page', { method: 'POST', headers: { Origin: trustedOrigin, 'content-type': 'application/json' }, body: '{}' })
    expect((await write(request)).status).toBe(400)
  })

  it('回复或删除的目标不存在：404', async () => {
    expect((await write(postOf({ intent: 'reply', threadId: '20261012t080000-nope', body: 'x' }))).status).toBe(404)
    expect((await write(postOf({ intent: 'delete-thread', threadId: '20261012t080000-nope' }))).status).toBe(404)
    const threadId = await createdThreadId()
    expect((await write(postOf({ intent: 'delete-reply', threadId, replyId: '20261012t080000-nope' }))).status).toBe(404)
  })

  it('服务端自己的错（评论目录被一个文件占着）不转成 4xx，原样抛出', async () => {
    await rm(path.dirname(commentsDir), { recursive: true })
    commentsDir = path.join(await mkdtemp(path.join(tmpdir(), 'comments-action-')), 'comments')
    await writeFile(commentsDir, '不是目录')
    await expect(write(postOf({ intent: 'create-thread', page: 'index.mdx', body: 'x' }))).rejects.toThrow()
  })
})
