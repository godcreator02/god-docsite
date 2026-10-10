import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatCommentBlockSpec, sourceHash } from '../src/comment-source.js'
import { commentablePagesOf, commentRequestResponse, commentSourceResponse, type CommentablePage } from '../src/server/comments.js'

let siteRoot: string
let commentsDir: string
let pageFile: string
let pages: CommentablePage[]

beforeEach(async () => {
  siteRoot = await mkdtemp(path.join(tmpdir(), 'docsite-comments-'))
  commentsDir = path.join(siteRoot, 'comments')
  pageFile = path.join(siteRoot, 'content', 'writing.mdx')
  await mkdir(commentsDir)
  await mkdir(path.dirname(pageFile))
  pages = [
    { url: '/writing', sourceFile: pageFile },
    { url: '/figure', sourceFile: undefined },
  ]
})

afterEach(async () => {
  await rm(siteRoot, { recursive: true })
})

function post(fields: Record<string, string>, as = '小周', images: File[] = []) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  for (const image of images) form.append('image', image)
  return commentRequestResponse(new Request('http://site/api/comments', { method: 'POST', body: form }), { commenter: { name: as }, pages, commentsDir })
}

async function created(fields: Record<string, string>, images: File[] = []) {
  const response = await post({ op: 'create', page: '/writing', ...fields }, '小周', images)
  expect(response.status, await response.clone().text()).toBe(200)
  return (await response.json()) as { thread: string; file: string }
}

/** 页面源码里从 startText 开头到 endText 结尾那一块的位置，和编译插件写到网页上的一样 */
function blockSpecOf(source: string, placement: 'inline' | 'flow', startText: string, endText: string) {
  const start = source.indexOf(startText)
  const end = source.indexOf(endText, start) + endText.length
  const pointOf = (offset: number) => {
    const before = source.slice(0, offset).split('\n')
    return { line: before.length, column: before.at(-1)!.length + 1 }
  }
  return formatCommentBlockSpec({ placement, start: pointOf(start), end: pointOf(end), hash: sourceHash(source.slice(start, end)) })
}

const headOf = (thread: string) => readFile(path.join(commentsDir, thread, 'index.md'), 'utf8')

describe('评论接口', () => {
  it('批整页：写 index.md，frontmatter 带作者、页面；粘贴的图片存进同一文件夹', async () => {
    const image = new File([new Uint8Array([1, 2, 3])], 'paste-abc-0.png', { type: 'image/png' })
    const { thread, file } = await created({ target: '{}', body: '看这里 <b> {x}\n![](./paste-abc-0.png)' }, [image])
    expect(file).toBe('index.md')
    expect(thread).toMatch(/^\d{4}-\d{2}-\d{2}-[0-9a-f]{6}$/)
    expect(await headOf(thread)).toMatch(/^---\nauthor: "小周"\ncreatedAt: "[^"]+"\npage: "\/writing"\nstatus: "open"\n---\n\n看这里 &lt;b> \{x\}\n!\[\]\(\.\/paste-abc-0\.png\)\n$/)
    expect(await readdir(path.join(commentsDir, thread))).toEqual(['index.md', 'paste-abc-0.png'])
  })

  it('批段落里的几个字：标记插在段落开头，评论串记 anchor、quote 与第几次出现', async () => {
    const source = '---\ntitle: 写作\n---\n\n第一段\n\n第二段**加粗**\n第二行\n'
    await writeFile(pageFile, source)
    const block = blockSpecOf(source, 'inline', '第二段', '第二行')
    const { thread } = await created({ target: JSON.stringify({ block, quote: '加粗', quoteIndex: 1 }), body: '这里' })
    const anchor = /anchor: "([0-9a-f]{6})"/.exec(await headOf(thread))![1]
    expect(await headOf(thread)).toContain(`anchor: "${anchor}"\nquote: "加粗"\nquoteIndex: 1\n---`)
    expect(await readFile(pageFile, 'utf8')).toBe(`---\ntitle: 写作\n---\n\n第一段\n\n<CommentAnchor id="${anchor}" />第二段**加粗**\n第二行\n`)
  })

  it('批列表项里的代码块：标记单独一行插在它前面，带上同样的缩进', async () => {
    const source = '- 一项\n  ```ts\n  const a = 1\n  ```\n- 二项\n'
    await writeFile(pageFile, source)
    const { thread } = await created({ target: JSON.stringify({ block: blockSpecOf(source, 'flow', '```ts', '  ```') }), body: '这段代码' })
    const anchor = /anchor: "([0-9a-f]{6})"/.exec(await headOf(thread))![1]
    expect(await readFile(pageFile, 'utf8')).toBe(`- 一项\n  <CommentAnchor id="${anchor}" />\n  \`\`\`ts\n  const a = 1\n  \`\`\`\n- 二项\n`)
  })

  it('已有标记的块直接用它，不改页面；页面里没有这个标记时拒绝', async () => {
    const source = '<CommentAnchor id="k1" />一段\n'
    await writeFile(pageFile, source)
    const { thread } = await created({ target: JSON.stringify({ anchor: 'k1' }), body: '再批一次' })
    expect(await headOf(thread)).toContain('anchor: "k1"')
    expect(await readFile(pageFile, 'utf8')).toBe(source)
    expect(await (await post({ op: 'create', page: '/writing', target: JSON.stringify({ anchor: 'k2' }), body: 'x' })).text()).toBe('writing.mdx 里没有标记 k2：刷新页面再批')
  })

  it('页面打开后改过、块和列表符号同一行、HTML 页面批块时拒绝，评论目录里什么也不留', async () => {
    const source = '一段\n\n- ```ts\n  a\n  ```\n'
    await writeFile(pageFile, source)
    const stale = blockSpecOf(source, 'inline', '一段', '一段')
    await writeFile(pageFile, `新加一行\n\n${source}`)
    expect(await (await post({ op: 'create', page: '/writing', target: JSON.stringify({ block: stale }), body: 'x' })).text()).toBe('writing.mdx 在网页打开以后改过了，这一块对不上：刷新页面再批')
    await writeFile(pageFile, source)
    const sameLine = blockSpecOf(source, 'flow', '```ts', '  ```')
    expect(await (await post({ op: 'create', page: '/writing', target: JSON.stringify({ block: sameLine }), body: 'x' })).text()).toBe('这一块和列表符号或别的内容写在同一行（-），插不进标记：把它挪到下一行再批')
    expect(await (await post({ op: 'create', page: '/figure', target: JSON.stringify({ anchor: 'a' }), body: 'x' })).text()).toBe('/figure 是 HTML 页面，只能批整页')
    expect(await (await post({ op: 'create', page: '/writing', target: JSON.stringify({ quote: 'x', quoteIndex: 1 }), body: 'x' })).text()).toBe('target.quote 要和 anchor 或 block 一起写')
    expect(await readdir(commentsDir)).toEqual([])
  })

  it('删掉最后一个用某标记的评论串时，连页面里的标记一起删；还有别的串在用时留着', async () => {
    await writeFile(pageFile, '<CommentAnchor id="k1" />一段\n\n<CommentAnchor id="k2" />\n```ts\na\n```\n')
    const first = await created({ target: JSON.stringify({ anchor: 'k1' }), body: '一' })
    const second = await created({ target: JSON.stringify({ anchor: 'k1' }), body: '二' })
    const code = await created({ target: JSON.stringify({ anchor: 'k2' }), body: '三' })
    expect((await post({ op: 'delete', thread: first.thread, file: 'index.md' })).status).toBe(200)
    expect(await readFile(pageFile, 'utf8')).toContain('<CommentAnchor id="k1" />')
    expect((await post({ op: 'delete', thread: second.thread, file: 'index.md' })).status).toBe(200)
    expect((await post({ op: 'delete', thread: code.thread, file: 'index.md' })).status).toBe(200)
    expect(await readFile(pageFile, 'utf8')).toBe('一段\n\n```ts\na\n```\n')
  })

  it('回复、解决、重新打开：回复是新文件，解决改 status 并记下是谁', async () => {
    const { thread } = await created({ target: '{}', body: '整页' })
    const replied = await post({ op: 'reply', thread, body: '收到' }, 'Claude')
    const { file } = (await replied.json()) as { file: string }
    expect(await readFile(path.join(commentsDir, thread, file), 'utf8')).toMatch(/^---\nauthor: "Claude"\ncreatedAt: "[^"]+"\n---\n\n收到\n$/)

    expect((await post({ op: 'resolve', thread }, 'Claude')).status).toBe(200)
    const resolved = await headOf(thread)
    expect(resolved).toContain('status: "resolved"\nresolvedBy: "Claude"\nresolvedAt: "')
    expect((await post({ op: 'reopen', thread })).status).toBe(200)
    const reopened = await headOf(thread)
    expect(reopened).toContain('status: "open"')
    expect(reopened).not.toContain('resolvedBy')
    expect(reopened).toMatch(/\n---\n\n整页\n$/)
  })

  it('只有作者能编辑、删除；删发起的那条就是删整串', async () => {
    const { thread } = await created({ target: '{}', body: '原话' })
    expect(await (await post({ op: 'edit', thread, file: 'index.md', body: '别人改' }, '小李')).text()).toBe('只有作者 小周 能编辑这条评论')
    expect((await post({ op: 'edit', thread, file: 'index.md', body: '改过 a<b' })).status).toBe(200)
    const source = await commentSourceResponse(new Request(`http://site/api/comments?thread=${thread}&file=index.md`), commentsDir)
    expect(await source.text()).toBe('改过 a<b')
    expect((await post({ op: 'delete', thread, file: 'index.md' })).status).toBe(200)
    expect(await readdir(commentsDir)).toEqual([])
  })

  it('发布站只读；页面不存在、op 写错、文件名带路径时拒绝', async () => {
    const readOnly = await commentRequestResponse(new Request('http://site/api/comments', { method: 'POST', body: new FormData() }), { commenter: null, pages: [], commentsDir })
    expect(readOnly.status).toBe(403)
    expect(await (await post({ op: 'create', page: '/gone', target: '{}', body: 'x' })).text()).toBe('没有页面 /gone')
    expect((await post({ op: 'move', thread: 'a' })).status).toBe(400)
    const { thread } = await created({ target: '{}', body: 'x' })
    expect(await (await post({ op: 'edit', thread, file: '../index.md', body: 'x' })).text()).toBe('评论文件名 ../index.md 不对')
    expect(await (await post({ op: 'reply', thread: '..', body: 'x' })).text()).toBe('评论串名 .. 不对')
  })
})

describe('能评论的页面', () => {
  it('MDX 页面的源文件在内容目录里，TSX 页面取 glob 给的文件，HTML 页面没有', () => {
    const pagesOfSite = commentablePagesOf(
      [
        { url: '/writing', path: 'writing/index.mdx', data: {} },
        { url: '/chart', path: 'chart.tsx', data: { file: '/content/chart.page.tsx' } },
        { url: '/figure', path: 'figure.html', data: { file: '/content/figure.html' } },
      ],
      '/site',
    )
    expect(pagesOfSite).toEqual([
      { url: '/writing', sourceFile: path.join('/site', 'content', 'writing/index.mdx') },
      { url: '/chart', sourceFile: path.join('/site', '/content/chart.page.tsx') },
      { url: '/figure', sourceFile: undefined },
    ])
  })
})
