import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commentRequestResponse, commentSourceResponse } from '../src/server/comments.js'

let commentsDir: string

beforeEach(async () => {
  commentsDir = await mkdtemp(path.join(tmpdir(), 'docsite-comments-'))
})

afterEach(async () => {
  await rm(commentsDir, { recursive: true })
})

function post(fields: Record<string, string>, as = '小周', images: File[] = []) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  for (const image of images) form.append('image', image)
  return commentRequestResponse(new Request('http://site/api/comments', { method: 'POST', body: form }), { commenter: { name: as }, pageUrls: ['/writing'], commentsDir })
}

async function created(fields: Record<string, string>, images: File[] = []) {
  const response = await post({ op: 'create', page: '/writing', ...fields }, '小周', images)
  expect(response.status).toBe(200)
  return (await response.json()) as { thread: string; file: string }
}

describe('评论接口', () => {
  it('新建评论串：写 index.md，frontmatter 带作者、页面、原文与前后文；粘贴的图片存进同一文件夹', async () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'paste-abc-0.png', { type: 'image/png' })
    const { thread, file } = await created({ anchor: JSON.stringify({ quote: '原文', quotePrefix: '前', quoteSuffix: '后' }), body: '看这里 <b> {x}\n![](./paste-abc-0.png)' }, [image])
    expect(file).toBe('index.md')
    expect(thread).toMatch(/^\d{4}-\d{2}-\d{2}-[0-9a-f]{6}$/)
    const source = await readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')
    expect(source).toMatch(/^---\nauthor: "小周"\ncreatedAt: "[^"]+"\npage: "\/writing"\nstatus: "open"\nquote: "原文"\nquotePrefix: "前"\nquoteSuffix: "后"\n---\n\n看这里 &lt;b> \{x\}\n!\[\]\(\.\/paste-abc-0\.png\)\n$/)
    expect(await readdir(path.join(commentsDir, thread))).toEqual(['index.md', 'paste-abc-0.png'])
  })

  it('回复、解决、重新打开：回复是新文件，解决改 status 并记下是谁', async () => {
    const { thread } = await created({ anchor: '{}', body: '整页' })
    const replied = await post({ op: 'reply', thread, body: '收到' }, 'Claude')
    const { file } = (await replied.json()) as { file: string }
    expect(await readFile(path.join(commentsDir, thread, file), 'utf8')).toMatch(/^---\nauthor: "Claude"\ncreatedAt: "[^"]+"\n---\n\n收到\n$/)

    expect((await post({ op: 'resolve', thread }, 'Claude')).status).toBe(200)
    const resolved = await readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')
    expect(resolved).toContain('status: "resolved"\nresolvedBy: "Claude"\nresolvedAt: "')
    expect((await post({ op: 'reopen', thread })).status).toBe(200)
    const reopened = await readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')
    expect(reopened).toContain('status: "open"')
    expect(reopened).not.toContain('resolvedBy')
    expect(reopened).toMatch(/\n---\n\n整页\n$/)
  })

  it('只有作者能编辑、删除；删发起的那条就是删整串', async () => {
    const { thread } = await created({ anchor: '{}', body: '原话' })
    expect(await (await post({ op: 'edit', thread, file: 'index.md', body: '别人改' }, '小李')).text()).toBe('只有作者 小周 能编辑这条评论')
    expect((await post({ op: 'edit', thread, file: 'index.md', body: '改过 a<b' })).status).toBe(200)
    const source = await commentSourceResponse(new Request(`http://site/api/comments?thread=${thread}&file=index.md`), commentsDir)
    expect(await source.text()).toBe('改过 a<b')
    expect((await post({ op: 'delete', thread, file: 'index.md' })).status).toBe(200)
    expect(await readdir(commentsDir)).toEqual([])
  })

  it('发布站只读；页面不存在、op 写错、文件名带路径时拒绝', async () => {
    const readOnly = await commentRequestResponse(new Request('http://site/api/comments', { method: 'POST', body: new FormData() }), { commenter: null, pageUrls: [], commentsDir })
    expect(readOnly.status).toBe(403)
    expect(await (await post({ op: 'create', page: '/gone', anchor: '{}', body: 'x' })).text()).toBe('没有页面 /gone')
    expect((await post({ op: 'move', thread: 'a' })).status).toBe(400)
    const { thread } = await created({ anchor: '{}', body: 'x' })
    expect(await (await post({ op: 'edit', thread, file: '../index.md', body: 'x' })).text()).toBe('评论文件名 ../index.md 不对')
    expect(await (await post({ op: 'reply', thread: '..', body: 'x' })).text()).toBe('评论串名 .. 不对')
  })
})
