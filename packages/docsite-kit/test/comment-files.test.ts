import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Person } from '../src/people.js'
import { commentThreadIdsAbout, readCommentThreads, siteProblems } from '../src/server/comment-files.js'

const people: Person[] = [
  { id: 'zhou', name: '小周', codes: ['zhoucode0001'] },
  { id: 'li', name: '小李' },
]

let siteDir: string
let commentsDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-comment-files-'))
  commentsDir = path.join(siteDir, 'comments')
  await writeFile(path.join(siteDir, 'people.json'), JSON.stringify(people))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true })
})

async function writeComment(thread: string, file: string, frontmatter: string, body: string) {
  await mkdir(path.join(commentsDir, thread), { recursive: true })
  await writeFile(path.join(commentsDir, thread, file), `---\n${frontmatter}\n---\n\n${body}\n`)
}

describe('从文件读评论', () => {
  it('没有评论目录就是没有评论；评论串按发起时间排，回复按时间排，带正文', async () => {
    expect(await readCommentThreads(commentsDir)).toEqual([])
    await writeComment('b', 'index.mdx', 'author: li\ncreatedAt: 2026-10-11T02:00:00Z\nstatus: open', '不挂在页面上')
    await writeComment('a', 'index.mdx', 'author: zhou\ncreatedAt: "2026-10-11T01:00:00Z"\npage: /writing\nstatus: open', '整页')
    await writeComment('a', '2.mdx', 'author: li\ncreatedAt: 2026-10-11T03:00:00Z', '@zhou 第二条')
    await writeComment('a', '1.mdx', 'author: zhou\ncreatedAt: 2026-10-11T02:30:00Z', '第一条')
    const threads = await readCommentThreads(commentsDir)
    expect(threads.map((thread) => thread.id)).toEqual(['a', 'b'])
    expect(threads[0]!.head).toMatchObject({ kind: 'thread', author: 'zhou', page: '/writing', file: 'index.mdx', body: '整页' })
    expect(threads[0]!.replies.map((reply) => reply.body)).toEqual(['第一条', '@zhou 第二条'])
    expect(threads[1]!.head.page).toBeUndefined()
  })

  it('和某人有关：他发起的、回复过的、@ 了他的', async () => {
    await writeComment('a', 'index.mdx', 'author: li\ncreatedAt: 2026-10-11T01:00:00Z\nstatus: open', '请 @zhou 看看')
    await writeComment('b', 'index.mdx', 'author: li\ncreatedAt: 2026-10-11T02:00:00Z\nstatus: open', '无关')
    await writeComment('c', 'index.mdx', 'author: li\ncreatedAt: 2026-10-11T03:00:00Z\nstatus: open', '问题')
    await writeComment('c', 'r.mdx', 'author: zhou\ncreatedAt: 2026-10-11T04:00:00Z', '回答')
    expect(commentThreadIdsAbout(await readCommentThreads(commentsDir), 'zhou', people)).toEqual(['a', 'c'])
  })

  it('站点检查：格式不对、作者不在人员列表里、快照对不上，一次列出全部', async () => {
    expect(await siteProblems(siteDir)).toEqual([])
    await writeComment('a', 'index.mdx', 'author: wang\ncreatedAt: 2026-10-11T01:00:00Z\npage: /writing\nstatus: open\nquote: 原文\nrange: [0, 2]', 'x')
    await writeFile(path.join(commentsDir, 'a', 'snapshot.txt'), '别的字')
    expect(await siteProblems(siteDir)).toEqual(['a/index.mdx 的 author wang 不在 people.json 里', '评论串 a：quote 和快照里 range 那一段不一样：快照里是「别的」'])
    await writeComment('b', 'index.mdx', 'author: zhou\nstatus: closed', 'x')
    expect(await siteProblems(siteDir)).toEqual(['b/index.mdx：createdAt 要是时间，如 2026-10-10T12:00:00+08:00', 'b/index.mdx：status 要是 open 或 resolved'])
  })
})
