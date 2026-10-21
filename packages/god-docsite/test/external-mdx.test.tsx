import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import remarkMath from 'remark-math'
import { afterEach, describe, expect, it } from 'vitest'
import { checkMdx } from '../src/node/check-mdx.js'
import { externalFileResponse } from '../src/site/external-file.server.js'
import { ExternalMdxContent, type ExternalMdx } from '../src/site/external-mdx.js'
import { compileExternalMdx, type ExternalMdxOptions } from '../src/site/external-mdx.server.js'
import { Figure, FigureRow, FigureRowCaption } from '../src/site/figure.js'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** 一个材料文件夹：mdx/ 里放正文，assets/ 里放图 */
function materialFolder(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'god-docsite-external-'))
  tempDirs.push(dir)
  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true })
    writeFileSync(path.join(dir, relative), text)
  }
  return dir
}

const optionsOf = (rootDir: string): ExternalMdxOptions => ({
  plugins: { remarkPlugins: [remarkMath], rehypePlugins: [] },
  rootDir,
  assetsHrefOf: (relative) => `/papers/p1/files/${relative}`,
})

function readyOf(result: ExternalMdx): Extract<ExternalMdx, { state: 'ready' }> {
  if (result.state !== 'ready') throw new Error(`应该编译通过，编译器说：${result.message}`)
  return result
}

function brokenMessageOf(result: ExternalMdx): string {
  if (result.state !== 'broken') throw new Error('应该编译不过')
  return result.message
}

const render = (compiled: ExternalMdx) => renderToStaticMarkup(<ExternalMdxContent compiled={compiled} components={{ Figure, FigureRow, FigureRowCaption }} />)

describe('compileExternalMdx', () => {
  it('frontmatter、标题目录照常；Markdown 图片与 Figure 的相对地址换成功能包文件路由的地址，绝对地址不动', async () => {
    const dir = materialFolder({
      'mdx/paper.mdx': ['---', 'title: 题目', '---', '', '## 第一节', '', '![图一](../assets/a.png)', '', '<Figure src="../assets/b%20c.jpg">图注</Figure>', '', '![](https://example.org/x.png)', ''].join('\n'),
    })
    const compiled = readyOf(await compileExternalMdx(path.join(dir, 'mdx', 'paper.mdx'), optionsOf(dir)))
    expect(compiled.frontmatter).toEqual({ title: '题目' })
    expect(compiled.toc.map(({ title, url }) => [title, url])).toEqual([['第一节', '#第一节']])
    const html = render(compiled)
    expect(html).toContain('src="/papers/p1/files/assets/a.png"')
    expect(html).toContain('src="/papers/p1/files/assets/b c.jpg"')
    expect(html).toContain('src="https://example.org/x.png"')
    expect(html).toContain('<figcaption')
  })

  it('越出 rootDir 的图、import、MDX 语法错、frontmatter 写坏：回 broken，原话带行号', async () => {
    const dir = materialFolder({
      'mdx/escape.mdx': '---\ntitle: 题目\n---\n\n第一段\n\n<Figure src="../../other/x.png">图注</Figure>\n',
      'mdx/import.mdx': "import { X } from './x.js'\n\n<X />\n",
      'mdx/syntax.mdx': '<Figure src="a.png"\n',
      'mdx/yaml.mdx': '---\ntitle: [没关上\n---\n正文\n',
    })
    const compileFile = (name: string) => compileExternalMdx(path.join(dir, 'mdx', name), optionsOf(dir))
    const escape = brokenMessageOf(await compileFile('escape.mdx'))
    expect(escape).toMatch(/^7:\d+/)
    expect(escape).toContain('../../other/x.png')
    expect(brokenMessageOf(await compileFile('import.mdx'))).toMatch(/^1:1.*外部页不能写 import/)
    expect(brokenMessageOf(await compileFile('syntax.mdx'))).toMatch(/^\d+:\d+/)
    expect(brokenMessageOf(await compileFile('yaml.mdx'))).toMatch(/^frontmatter 不是合法的 YAML/)
    expect(render(await compileFile('import.mdx'))).toContain('这一页编译不过')
  })

  it('全站的 rehype 插件排在平台自带的前面：块级公式先被公式插件换掉，代码高亮碰不到它', async () => {
    type HastNode = { type: string; tagName?: string; properties?: { className?: unknown }; children?: HastNode[] }
    const isDisplayMath = (node: HastNode) => node.tagName === 'pre' && node.children?.some((child) => String(child.properties?.className ?? '').includes('math-display')) === true
    /** 和 rehype-katex 一样把块级公式换成渲染好的元素：排在代码高亮后面时，高亮先拿到 language-math 的代码块就报错 */
    const rehypeFakeKatex = () => (tree: HastNode) => {
      const visit = (node: HastNode) => {
        node.children = node.children?.map((child) => (isDisplayMath(child) ? { type: 'element', tagName: 'div', properties: { className: ['fake-katex'] }, children: [] } : child))
        node.children?.forEach(visit)
      }
      visit(tree)
    }
    const dir = materialFolder({ 'note.mdx': '公式：\n\n$$\na^2 + b^2 = c^2\n$$\n' })
    const compiled = await compileExternalMdx(path.join(dir, 'note.mdx'), { ...optionsOf(dir), plugins: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeFakeKatex] } })
    expect(render(readyOf(compiled))).toContain('class="fake-katex"')
  })

  it('文件没变沿用上次的结果，改了就重新编译', async () => {
    const dir = materialFolder({ 'note.mdx': '第一版\n' })
    const file = path.join(dir, 'note.mdx')
    const first = await compileExternalMdx(file, optionsOf(dir))
    expect(await compileExternalMdx(file, optionsOf(dir))).toBe(first)
    writeFileSync(file, '第二版，长一点\n')
    utimesSync(file, new Date(), new Date(Date.now() + 2000))
    expect(render(await compileExternalMdx(file, optionsOf(dir)))).toContain('第二版')
  })
})

describe('checkMdx', () => {
  it('编译过回 ok，不过回编译器原话', async () => {
    const dir = materialFolder({ 'mdx/ok.mdx': '---\ntitle: 题目\n---\n\n公式 $\\{a\\}$ 与 <Figure src="../a.png" />\n', 'mdx/bad.mdx': '<Figure src="../../x.png" />\n' })
    expect(await checkMdx(path.join(dir, 'mdx', 'ok.mdx'), { rootDir: dir })).toEqual({ ok: true })
    const bad = await checkMdx(path.join(dir, 'mdx', 'bad.mdx'), { rootDir: dir })
    expect(bad.ok).toBe(false)
    expect(bad.ok === false && bad.message).toContain('越出了')
  })
})

describe('externalFileResponse', () => {
  const request = (headers: Record<string, string> = {}) => new Request('http://127.0.0.1/x', { headers })

  it('按扩展名给类型、带 ETag，没变回 304', async () => {
    const dir = materialFolder({ 'assets/a.png': 'png' })
    const response = await externalFileResponse(dir, 'assets/a.png', request())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await response.text()).toBe('png')
    const etag = response.headers.get('etag')!
    expect((await externalFileResponse(dir, 'assets/a.png', request({ 'if-none-match': etag }))).status).toBe(304)
  })

  it('不存在、越出目录、是文件夹、认不出扩展名，都抛 404', async () => {
    const dir = materialFolder({ 'assets/a.png': 'png', 'assets/folder.png/inside.txt': '', 'notes.xyz': '?', 'outside.png': 'png' })
    const statusOf = async (relative: string) => {
      try {
        await externalFileResponse(path.join(dir, 'assets'), relative, request())
        return 200
      } catch (thrown) {
        return (thrown as Response).status
      }
    }
    expect(await statusOf('a.png')).toBe(200)
    expect(await statusOf('b.png')).toBe(404)
    expect(await statusOf('../outside.png')).toBe(404)
    expect(await statusOf('folder.png')).toBe(404)
    await expect(externalFileResponse(dir, 'notes.xyz', request())).rejects.toMatchObject({ status: 404 })
  })
})
