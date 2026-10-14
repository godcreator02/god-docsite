// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { parseCommentFile, serializeCommentFile, serializeTextAnchor, threadsByPage } from '../src/core/index.js'
import { createThread, readCommentThreads } from '../src/node/index.js'

const trickyAnchors = [
  '带"双引号"的元素',
  '反斜杠\\n不是换行，C:\\temp\\',
  '第一行\n第二行\r\n第三行',
  '中文锚点：批注、引号「」与 emoji 🎯',
  "单引号 'x'、井号 # 与冒号: 都不特殊",
  '控制字符\t\u0000\u007f\u0085\u2028与 BOM \ufeff',
  serializeTextAnchor({ quote: '被批的"原文"\\', start: 3, end: 9, snapshot: '整页\n文字 "带引号"' }),
]

describe('评论文件读写对称', () => {
  let commentsDir: string
  beforeEach(async () => {
    commentsDir = await mkdtemp(path.join(tmpdir(), 'comments-file-'))
  })
  afterEach(async () => {
    await rm(commentsDir, { recursive: true })
  })

  it('带引号、反斜杠、换行、中文的锚点与页面写进去再读回来完全一致', async () => {
    for (const anchor of trickyAnchors) await createThread(commentsDir, { page: `页面/${anchor}.mdx`, authorId: 'zhou', body: '正文', anchor })
    const threads = await readCommentThreads(commentsDir)
    expect(threads.map((thread) => thread.head.anchor).sort()).toEqual([...trickyAnchors].sort())
    expect(threads.map((thread) => thread.head.page).sort()).toEqual(trickyAnchors.map((anchor) => `页面/${anchor}.mdx`).sort())
  })

  it('fumadocs-mdx 按 YAML 读 frontmatter：读到的也是原值，且每个字段一行', () => {
    for (const anchor of trickyAnchors) {
      const text = serializeCommentFile({ page: 'index.mdx', author: 'zhou', createdAt: '2026-10-12T08:00:00.000Z', anchor }, '正文')
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)![1]!
      expect(frontmatter.split('\n')).toHaveLength(4)
      expect(parse(frontmatter)).toEqual({ page: 'index.mdx', author: 'zhou', createdAt: '2026-10-12T08:00:00.000Z', anchor })
    }
  })

  it('手写的文件：不加引号的时间仍是字符串，CRLF 换行也认', () => {
    const parsed = parseCommentFile('20261012t080000-ab12/index.mdx', '---\r\npage: index.mdx\r\nauthor: zhou\r\ncreatedAt: 2026-10-12T08:00:00Z\r\n---\r\n\r\n正文\r\n')
    expect(parsed).toEqual({ path: '20261012t080000-ab12/index.mdx', page: 'index.mdx', authorId: 'zhou', createdAt: '2026-10-12T08:00:00Z', body: '正文' })
  })

  it('不是评论文件的形状直接报错并点名文件', () => {
    expect(() => parseCommentFile('a/index.mdx', '正文')).toThrow('a/index.mdx 没有 frontmatter')
    expect(() => parseCommentFile('a/index.mdx', '---\nauthor: "zhou\n---\n')).toThrow('a/index.mdx 的 frontmatter 不是合法 YAML')
    expect(() => parseCommentFile('a/index.mdx', '---\nauthor: zhou\ncreatedAt: x\npage: 12\n---\n')).toThrow('a/index.mdx 的 page 要是字符串，收到 12')
    expect(() => parseCommentFile('a/index.mdx', '---\ncreatedAt: x\n---\n')).toThrow('a/index.mdx 缺 author 字段')
  })
})

describe('全站评论按页分组', () => {
  it('每页的串带着各自的回复', () => {
    const byPage = threadsByPage([
      { path: '20261012t080000-seed1/index.mdx', authorId: 'owner', createdAt: '2026-10-12T08:00:00.000Z', page: 'index.mdx' },
      { path: '20261012t080000-seed1/20261012t080500-r1a2.mdx', authorId: 'zhou', createdAt: '2026-10-12T08:05:00.000Z' },
      { path: '20261012t090000-other/index.mdx', authorId: 'owner', createdAt: '2026-10-12T09:00:00.000Z', page: 'guide.mdx' },
    ])
    expect([...byPage.keys()]).toEqual(['index.mdx', 'guide.mdx'])
    expect(byPage.get('index.mdx')![0]!.replies.map((reply) => reply.id)).toEqual(['20261012t080500-r1a2'])
    expect(byPage.get('guide.mdx')![0]!.replies).toEqual([])
  })
})
