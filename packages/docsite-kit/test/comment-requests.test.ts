import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commentRequestResponse, commentSnapshotsOf, commentSourceResponse } from '../src/server/comments.js'

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

/** agent 发评论：页面 HTML 由假的 pageHtmlOf 给出，记下它被问到的页面 */
function postAsAgent(anchor: unknown, html: string) {
  const askedPages: string[] = []
  const form = new FormData()
  for (const [key, value] of Object.entries({ op: 'create', page: '/writing', anchor: JSON.stringify(anchor), body: '看这里' })) form.set(key, value)
  const pageHtmlOf = async (page: string) => {
    askedPages.push(page)
    return html
  }
  const response = commentRequestResponse(new Request('http://site/api/comments', { method: 'POST', body: form }), { commenter: { name: 'Claude' }, pageUrls: ['/writing'], commentsDir, pageHtmlOf })
  return { response, askedPages }
}

async function created(fields: Record<string, string>, images: File[] = []) {
  const response = await post({ op: 'create', page: '/writing', ...fields }, '小周', images)
  expect(response.status).toBe(200)
  return (await response.json()) as { thread: string; file: string }
}

describe('评论接口', () => {
  it('新建评论串：写 index.md，frontmatter 带作者、页面、原文与位置；页面文字存成 snapshot.txt，粘贴的图片存进同一文件夹', async () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'paste-abc-0.png', { type: 'image/png' })
    const anchor = { quote: '原文', range: [1, 3], snapshot: '前原文后\n下一段' }
    const { thread, file } = await created({ anchor: JSON.stringify(anchor), body: '看这里 <b> {x}\n![](./paste-abc-0.png)' }, [image])
    expect(file).toBe('index.md')
    expect(thread).toMatch(/^\d{4}-\d{2}-\d{2}-[0-9a-f]{6}$/)
    const source = await readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')
    expect(source).toMatch(/^---\nauthor: "小周"\ncreatedAt: "[^"]+"\npage: "\/writing"\nstatus: "open"\nquote: "原文"\nrange: \[1,3\]\n---\n\n看这里 &lt;b> \{x\}\n!\[\]\(\.\/paste-abc-0\.png\)\n$/)
    expect(await readFile(path.join(commentsDir, thread, 'snapshot.txt'), 'utf8')).toBe('前原文后\n下一段')
    expect((await readdir(path.join(commentsDir, thread))).sort()).toEqual(['index.md', 'paste-abc-0.png', 'snapshot.txt'])
  })

  it('批一个元素写 element 与 range；原文和快照里那一段对不上、range 超出快照、anchor 缺快照时拒绝', async () => {
    const { thread } = await created({ anchor: JSON.stringify({ element: 'image', range: [2, 3], snapshot: '图前￼图后' }), body: '这张图' })
    expect(await readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')).toContain('element: "image"\nrange: [2,3]\n')
    const rejected = async (anchor: unknown) => (await post({ op: 'create', page: '/writing', anchor: JSON.stringify(anchor), body: 'x' })).text()
    expect(await rejected({ quote: '原文', range: [0, 2], snapshot: '前原文后' })).toBe('anchor 对不上：quote 和快照里 range 那一段不一样：快照里是「前原」')
    expect(await rejected({ quote: '原文', range: [1, 9], snapshot: '前原文后' })).toBe('anchor 对不上：range [1, 9] 超出了快照（共 4 个字）')
    expect(await rejected({ quote: '原文', range: [1, 3] })).toBe('anchor.snapshot 要是页面文字，换行只用 \\n')
    expect(await rejected({ quote: '原文', range: [3, 1], snapshot: '前原文后' })).toBe('anchor.range 要是 [start, end]，start 小于 end')
  })

  it('agent 传 { quote, occurrence }：服务端取这一页的 HTML 算出页面文字当快照，range 指第 occurrence 处', async () => {
    const html = '<html><body><nav>原文</nav><article data-comment-scope=""><p>原文一</p><p>再看原文<span class="sr-only">原文</span>二</p></article></body></html>'
    const { response, askedPages } = postAsAgent({ quote: '原文', occurrence: 2 }, html)
    const result = await response
    expect(result.status).toBe(200)
    const { thread } = (await result.json()) as { thread: string }
    expect(askedPages).toEqual(['/writing'])
    expect(await readFile(path.join(commentsDir, thread, 'snapshot.txt'), 'utf8')).toBe('原文一再看原文二')
    expect(await readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')).toMatch(/^---\nauthor: "Claude"\ncreatedAt: "[^"]+"\npage: "\/writing"\nstatus: "open"\nquote: "原文"\nrange: \[5,7\]\n---\n\n看这里\n$/)
  })

  it('agent 要的第 occurrence 处不存在、occurrence 不是从 1 数的整数、多带了别的项时拒绝', async () => {
    const html = '<html><body><article data-comment-scope=""><p>原文一</p><p>原文二</p></article></body></html>'
    const rejected = async (anchor: unknown) => {
      const response = await postAsAgent(anchor, html).response
      expect(response.status).toBe(400)
      return response.text()
    }
    expect(await rejected({ quote: '原文', occurrence: 3 })).toBe('这一页的文字里没有第 3 处「原文」，一共有 2 处')
    expect(await rejected({ quote: '没有', occurrence: 1 })).toBe('这一页的文字里没有第 1 处「没有」，一共有 0 处')
    expect(await rejected({ quote: '原文', occurrence: 0 })).toBe('anchor.occurrence 要是从 1 数的整数')
    expect(await rejected({ quote: '原文', occurrence: 1.5 })).toBe('anchor.occurrence 要是从 1 数的整数')
    expect(await rejected({ quote: '原文', occurrence: 1, range: [0, 2] })).toBe('anchor 要是 { quote, range, snapshot }、{ element, range, snapshot }、{ quote, occurrence } 或 {}')
    expect(await readdir(commentsDir)).toEqual([])
  })

  it('读快照：换行统一成 \\n；缺快照、和 frontmatter 对不上时报错，一次列出全部', async () => {
    const { thread } = await created({ anchor: JSON.stringify({ quote: '原文', range: [1, 3], snapshot: '前原文后\n下一段' }), body: 'x' })
    await writeFile(path.join(commentsDir, thread, 'snapshot.txt'), '前原文后\r\n下一段')
    expect(await commentSnapshotsOf([{ id: thread, head: { quote: '原文', range: [1, 3] } }, { id: 'page-only', head: {} }], commentsDir)).toEqual({ [thread]: '前原文后\n下一段' })
    await expect(commentSnapshotsOf([{ id: thread, head: { quote: '别的', range: [1, 3] } }, { id: 'gone', head: { quote: 'x', range: [0, 1] } }], commentsDir)).rejects.toThrow(
      `评论串 ${thread}：quote 和快照里 range 那一段不一样：快照里是「原文」\n评论串 gone 写了 range，但文件夹里没有 snapshot.txt`,
    )
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
