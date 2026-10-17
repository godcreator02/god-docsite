import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assembleDocument } from '../src/core/assemble.ts'
import type { ReportBlock, ReportDocument } from '../src/core/index.ts'
import { reportAssetLoader, reportListLoader, reportPageLoader, type WordReportSite } from '../src/site/loaders.server.ts'

vi.mock('../src/core/assemble.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/core/assemble.ts')>()
  return { ...original, assembleDocument: vi.fn(original.assembleDocument) }
})

/** 1×1 的 PNG */
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const text = (value: string) => ({ type: 'text' as const, text: value })
const chapter = (id: string, title: string, extra: ReportBlock[] = []): ReportDocument => ({
  format: 'docreport', schemaVersion: 1, id, metadata: { title, language: 'zh-CN' },
  blocks: [{ type: 'section', id: `${id}_sec`, title, numbering: 'decimal', children: [{ type: 'section', id: `${id}_sub`, title: `${title}的小节`, numbering: 'decimal', children: [{ type: 'paragraph', id: `${id}_p`, content: [text(`${title}正文`)] }] }, ...extra] }],
})

let siteDir: string
let site: WordReportSite
/** 站点被问过哪几页的评论 */
let commentPagesAsked: string[]
async function save(file: string, value: unknown) {
  const absolute = path.join(siteDir, file)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
}

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'word-report-site-'))
  commentPagesAsked = []
  site = {
    siteDir,
    siteName: '测试站',
    hrefBase: '/reports',
    pageComments: (page) => {
      commentPagesAsked.push(page)
      return { threads: [], access: { kind: 'readonly', reasonCode: 'no-identity', reasonText: '测试站只读' } }
    },
  }
  await save('reports/sample/content.json', {
    format: 'docreport', schemaVersion: 1, id: 'doc_sample',
    metadata: { title: '样例报告', language: 'zh-CN', revision: 'A', date: '2026-10-15', authors: ['甲', '乙'] },
    blocks: [{ type: 'include', src: 'chapters/one/content.json' }, { type: 'include', src: 'chapters/two/content.json' }],
  })
  await save('reports/sample/chapters/one/content.json', chapter('one', '第一章'))
  await save('reports/sample/chapters/two/content.json', chapter('two', '第二章', [{ type: 'figure', id: 'two_fig', src: 'assets/plot.png', alt: '曲线', caption: [text('曲线图')] }]))
  await save('reports/sample/chapters/two/assets/plot.png', png)
  await save('reports/broken/content.json', '{ broken')
  await save('reports/README.md', '不是报告目录，列表里不出现')
})
afterEach(async () => {
  await rm(siteDir, { recursive: true, force: true })
})

describe('报告列表的 loader', () => {
  it('reports/ 下每份报告一行，按 id 排；读不对的也列出来，带原话', async () => {
    const { reports, siteName, hrefBase } = await reportListLoader({ params: {} }, site)
    expect({ siteName, hrefBase }).toEqual({ siteName: '测试站', hrefBase: '/reports' })
    expect(reports.map((report) => report.id)).toEqual(['broken', 'sample'])
    expect(reports[1]).toEqual({ id: 'sample', title: '样例报告', revision: 'A', date: '2026-10-15', authors: ['甲', '乙'], chapterCount: 2, warningCount: 0, problem: null })
    expect(reports[0]).toMatchObject({ id: 'broken', title: 'broken', chapterCount: 0, problem: expect.stringContaining('reports/broken/content.json') as unknown })
  })

  it('站点还没有 reports/：列表是空的', async () => {
    await rm(path.join(siteDir, 'reports'), { recursive: true })
    expect((await reportListLoader({ params: {} }, site)).reports).toEqual([])
  })

  it('reports/ 下目录名不能用在网址里：直接报错，不悄悄跳过', async () => {
    await save('reports/Bad Name/content.json', chapter('bad', '坏名字'))
    await expect(reportListLoader({ params: {} }, site)).rejects.toThrow('报告 id 只能是小写字母、数字与 -')
  })
})

describe('报告页的 loader', () => {
  it('整份报告组装成一页：两章按 include 的顺序接上，编号连着；目录是前两层的节', async () => {
    const data = await reportPageLoader({ params: { report: 'sample' } }, site)
    expect(data.reportId).toBe('sample')
    expect(data.report.document.metadata.title).toBe('样例报告')
    expect(data.report.document.blocks.map((block) => (block as { id: string }).id)).toEqual(['one_sec', 'two_sec'])
    expect(data.toc).toEqual([
      { title: '1 第一章', url: '#one_sec', depth: 2 },
      { title: '1.1 第一章的小节', url: '#one_sub', depth: 3 },
      { title: '2 第二章', url: '#two_sec', depth: 2 },
      { title: '2.1 第二章的小节', url: '#two_sub', depth: 3 },
    ])
    expect(Object.getPrototypeOf(data.report.index)).toBe(Object.prototype)
  })

  it('评论按报告页的地址取：归属键是 /reports/<报告 id>', async () => {
    const data = await reportPageLoader({ params: { report: 'sample' } }, site)
    expect(commentPagesAsked).toEqual(['/reports/sample'])
    expect(data.comments).toEqual({ threads: [], access: { kind: 'readonly', reasonCode: 'no-identity', reasonText: '测试站只读' } })
  })

  it('没有这份报告、id 形状不对：404', async () => {
    for (const report of ['nope', '../sample', undefined]) {
      const thrown = await reportPageLoader({ params: { report } }, site).catch((error: unknown) => error)
      expect(thrown).toBeInstanceOf(Response)
      expect((thrown as Response).status).toBe(404)
    }
  })

  it('报告读不对：直接报错，原话点名文件', async () => {
    await expect(reportPageLoader({ params: { report: 'broken' } }, site)).rejects.toThrow('reports/broken/content.json')
  })
})

describe('报告里图片的 loader', () => {
  it('按组装后的路径给图，类型按扩展名；这份报告没用到的路径 404', async () => {
    const { report } = await reportPageLoader({ params: { report: 'sample' } }, site)
    const compiled = Object.keys(report.assets)[0]!
    expect(compiled).toBe('assets/two/plot.png')
    const response = await reportAssetLoader({ params: { report: 'sample', '*': compiled.slice('assets/'.length) } }, site)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
    expect((await reportAssetLoader({ params: { report: 'sample', '*': 'two/other.png' } }, site)).status).toBe(404)
  })

  it('图没变：带着上次的 ETag 来问回 304、不传图；图改了 ETag 跟着变', async () => {
    const params = { report: 'sample', '*': 'two/plot.png' }
    const first = await reportAssetLoader({ params }, site)
    const etag = first.headers.get('etag')!
    expect(first.headers.get('cache-control')).toBe('no-cache')
    const request = (tag: string) => new Request('http://site/reports/sample/assets/two/plot.png', { headers: { 'if-none-match': tag } })
    const notModified = await reportAssetLoader({ params, request: request(etag) }, site)
    expect(notModified.status).toBe(304)
    expect(await notModified.text()).toBe('')
    await save('reports/sample/chapters/two/assets/plot.png', Buffer.concat([png, Buffer.from([0])]))
    const changed = await reportAssetLoader({ params, request: request(etag) }, site)
    expect(changed.status).toBe(200)
    expect(changed.headers.get('etag')).not.toBe(etag)
  })
})

describe('组装结果沿用', () => {
  it('一页的几张图同时请求只组装一次；JSON 没变时再打开报告页也不重新组装', async () => {
    vi.mocked(assembleDocument).mockClear()
    const responses = await Promise.all(Array.from({ length: 5 }, () => reportAssetLoader({ params: { report: 'sample', '*': 'two/plot.png' } }, site)))
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200])
    await reportPageLoader({ params: { report: 'sample' } }, site)
    expect(assembleDocument).toHaveBeenCalledTimes(1)
  })

  it('改了一章的 JSON：下一次请求重新组装，看到改后的内容', async () => {
    await reportPageLoader({ params: { report: 'sample' } }, site)
    await save('reports/sample/chapters/one/content.json', chapter('one', '改过的第一章'))
    const { toc } = await reportPageLoader({ params: { report: 'sample' } }, site)
    expect(toc[0]).toEqual({ title: '1 改过的第一章', url: '#one_sec', depth: 2 })
  })

  it('MDX 报告同样沿用：几张图同时请求只编译组装一次；加了 references.mdx 或另一种入口就重新组装', async () => {
    await save('reports/mdx/index.mdx', '---\ntitle: MDX\nlanguage: zh-CN\nchapters: [c1.mdx]\n---\n')
    await save('reports/mdx/c1.mdx', '# 章\n\n<WordFigure src="assets/plot.png">图</WordFigure>\n')
    await save('reports/mdx/assets/plot.png', png)
    vi.mocked(assembleDocument).mockClear()
    const responses = await Promise.all(Array.from({ length: 4 }, () => reportAssetLoader({ params: { report: 'mdx', '*': 'mdx/plot.png' } }, site)))
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200])
    await reportPageLoader({ params: { report: 'mdx' } }, site)
    expect(assembleDocument).toHaveBeenCalledTimes(1)
    await save('reports/mdx/references.mdx', '<WordReference id="ref-a">文献</WordReference>\n')
    expect((await reportPageLoader({ params: { report: 'mdx' } }, site)).report.document.references).toEqual([{ id: 'ref-a', text: '文献' }])
    await save('reports/mdx/content.json', '{}')
    await expect(reportPageLoader({ params: { report: 'mdx' } }, site)).rejects.toThrow('只能留一个')
  })

  it('上次组装读过的一章被删了：重新组装，照常报错点名文件', async () => {
    await reportPageLoader({ params: { report: 'sample' } }, site)
    await rm(path.join(siteDir, 'reports/sample/chapters/one/content.json'))
    await expect(reportPageLoader({ params: { report: 'sample' } }, site)).rejects.toThrow('chapters/one/content.json')
  })
})
