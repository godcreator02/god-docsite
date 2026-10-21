import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createReply, createThread } from '../src/node/index.js'
import { externalPageThreads } from '../src/site/threads.server.js'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const people = [
  { id: 'owner', name: '负责人', codes: ['owner0000001'] },
  { id: 'member', name: '组员', codes: ['member000001'] },
]

/** 测试里的「编译」：读出文件原文，看得出交进来的是哪个文件 */
const readBody = async (file: string) => readFileSync(file, 'utf8').split('\n').at(-2) ?? ''

describe('externalPageThreads', () => {
  it('直接读材料旁边的评论目录：只挑这一页的串，作者换成名字，每条评论的正文按相对路径编译', async () => {
    const commentsDir = path.join(mkdtempSync(path.join(tmpdir(), 'comments-external-')), 'comments')
    tempDirs.push(path.dirname(commentsDir))
    const thread = await createThread(commentsDir, { page: '/papers/p1/paper', authorId: 'owner', body: '这段推导跳步了', now: new Date('2026-10-21T08:00:00+08:00') })
    const reply = await createReply(commentsDir, thread.id, { authorId: 'member', body: '补上了', now: new Date('2026-10-21T09:00:00+08:00') })
    await createThread(commentsDir, { page: '/papers/p2/paper', authorId: 'owner', body: '别的论文', now: new Date('2026-10-21T10:00:00+08:00') })

    const { threads, bodies } = await externalPageThreads({ commentsDir, people, page: '/papers/p1/paper', compileBody: readBody })
    expect(threads.map((each) => [each.headPath, each.author.name, each.replies.map((one) => [one.path, one.author.name])])).toEqual([
      [thread.headPath, '负责人', [[reply.path, '组员']]],
    ])
    expect(bodies).toEqual({ [thread.headPath]: '这段推导跳步了', [reply.path]: '补上了' })
  })

  it('评论目录还没建就是没有评论', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'comments-external-'))
    tempDirs.push(dir)
    expect(await externalPageThreads({ commentsDir: path.join(dir, 'comments'), people, page: '/papers/p1/paper', compileBody: readBody })).toEqual({ threads: [], bodies: {} })
  })
})
