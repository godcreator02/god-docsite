import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkReports, convertReportToMdx, readReport, reportEntryIn, reportIdsOf } from '../src/node/index.ts'
import { reportAssetLoader, reportListLoader, reportPageLoader, type WordReportSite } from '../src/site/loaders.server.ts'

/** 1×1 的 PNG */
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const index = (chapters = '[c1.mdx]') => `---\ntitle: MDX 样例\nlanguage: zh-CN\nrevision: B\nchapters: ${chapters}\n---\n`
const chapterOne = '# 第一章 [#c1]\n\n见 <Ref to="fig-plot" />。\n\n<Figure id="fig-plot" src="assets/plot.png">曲线图</Figure>\n'

let siteDir: string
async function save(file: string, value: string | Buffer) {
  const absolute = path.join(siteDir, file)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, value)
}
async function saveMdxReport(id = 'mdx') {
  await save(`reports/${id}/index.mdx`, index())
  await save(`reports/${id}/c1.mdx`, chapterOne)
  await save(`reports/${id}/assets/plot.png`, png)
}

beforeEach(async () => { siteDir = await mkdtemp(path.join(tmpdir(), 'word-report-mdx-')) })
afterEach(async () => { await rm(siteDir, { recursive: true, force: true }) })

describe('认 MDX 报告', () => {
  it('reports/ 下有 index.mdx 的目录也是报告，入口按磁盘上的文件定；两种入口都有报错', async () => {
    await saveMdxReport()
    await save('reports/json/content.json', '{}')
    expect(await reportIdsOf(siteDir)).toEqual(['json', 'mdx'])
    expect(await reportEntryIn(siteDir, 'mdx')).toBe('reports/mdx/index.mdx')
    expect(await reportEntryIn(siteDir, 'json')).toBe('reports/json/content.json')
    await expect(reportEntryIn(siteDir, 'none')).rejects.toThrow('既没有 content.json 也没有 index.mdx')
    await save('reports/mdx/content.json', '{}')
    await expect(reportIdsOf(siteDir)).rejects.toThrow('只能留一个')
  })
})

describe('MDX 报告的快照', () => {
  it('入口、各章、文献列表与图片都进快照；章没写进 chapters 的文件不读', async () => {
    await saveMdxReport()
    await save('reports/mdx/references.mdx', '<Reference id="ref-a">文献</Reference>\n')
    await save('reports/mdx/draft.mdx', '没列进 chapters')
    const result = await readReport(path.join(siteDir, 'reports/mdx/index.mdx'), { root: siteDir, mode: 'complete' })
    expect(result.snapshot.map((entry) => entry.path)).toEqual(['reports/mdx/assets/plot.png', 'reports/mdx/c1.mdx', 'reports/mdx/index.mdx', 'reports/mdx/references.mdx'])
    expect(result.index['fig-plot']).toMatchObject({ label: '图 1-1' })
    expect(result.document.references).toEqual([{ id: 'ref-a', text: '文献' }])
    expect(Object.keys(result.assetBytes)).toEqual(['assets/mdx/plot.png'])
    await save('reports/mdx/c1.mdx', chapterOne.replace('曲线图', '改过的图题'))
    expect((await readReport(path.join(siteDir, 'reports/mdx/index.mdx'), { root: siteDir })).fingerprint).not.toBe(result.fingerprint)
  })
  it('chapters 列的章不存在时报出那个文件', async () => {
    await save('reports/mdx/index.mdx', index('[c1.mdx, missing.mdx]'))
    await save('reports/mdx/c1.mdx', '# 章\n\n正文')
    await expect(readReport(path.join(siteDir, 'reports/mdx/index.mdx'), { root: siteDir })).rejects.toThrow('reports/mdx/missing.mdx')
  })
})

describe('检查 MDX 报告', () => {
  it('只整份检查一次，问题报在 MDX 的文件与行列上', async () => {
    await saveMdxReport()
    await save('reports/bad/index.mdx', index())
    await save('reports/bad/c1.mdx', '# 章\n\n见 <Ref to="nowhere" />')
    const result = await checkReports(siteDir)
    expect(result.runs).toEqual([{ file: 'reports/bad/index.mdx', mode: 'complete', passed: false }, { file: 'reports/mdx/index.mdx', mode: 'complete', passed: true }])
    expect(result.problems).toMatchObject([{ file: 'reports/bad/c1.mdx', pointer: '3:3', entry: 'reports/bad/index.mdx' }])
  })
})

describe('网页 loader 读 MDX 报告', () => {
  const site = (): WordReportSite => ({ siteDir, siteName: '测试站', hrefBase: '/reports', pageComments: () => ({ threads: [], access: { kind: 'readonly', reasonCode: 'no-identity', reasonText: '只读' } }) })
  it('列表的章数取 chapters 的个数，报告页的 sources 指向 MDX 行列，图片照常给出', async () => {
    await saveMdxReport()
    const { reports } = await reportListLoader({ params: {} }, site())
    expect(reports).toEqual([{ id: 'mdx', title: 'MDX 样例', revision: 'B', date: null, authors: [], chapterCount: 1, warningCount: 0, problem: null }])
    const page = await reportPageLoader({ params: { report: 'mdx' } }, site())
    expect(page.report.sources['fig-plot']).toEqual({ file: 'reports/mdx/c1.mdx', pointer: '5:1' })
    expect(page.toc).toEqual([{ title: '1 第一章', url: '#c1', depth: 2 }])
    const image = await reportAssetLoader({ params: { report: 'mdx', '*': 'mdx/plot.png' } }, site())
    expect(image.headers.get('content-type')).toBe('image/png')
  })
  it('原文没变时结果照旧；改了一章，再打开就是新内容', async () => {
    await saveMdxReport('cached')
    const first = await reportPageLoader({ params: { report: 'cached' } }, site())
    const again = await reportPageLoader({ params: { report: 'cached' } }, site())
    expect(again.report.document).toEqual(first.report.document)
    await save('reports/cached/c1.mdx', chapterOne.replace('曲线图', '新图题'))
    const changed = await reportPageLoader({ params: { report: 'cached' } }, site())
    expect(JSON.stringify(changed.report.document)).toContain('新图题')
  })
})

describe('convert：JSON 报告转成 MDX 报告', () => {
  async function saveDemoJsonReport() {
    const demo = await readFile(new URL('./fixtures/word-demo.json', import.meta.url), 'utf8')
    await save('reports/demo/content.json', demo)
    for (const image of ['architecture.png', 'response.png']) await save(`reports/demo/assets/${image}`, png)
  }
  it('转出新目录，编译回来和原报告逐项一致；原报告不动', async () => {
    await saveDemoJsonReport()
    const before = await readFile(path.join(siteDir, 'reports/demo/content.json'), 'utf8')
    const result = await convertReportToMdx(siteDir, 'demo', 'demo-mdx')
    expect(result).toMatchObject({ converted: true })
    expect(await readFile(path.join(siteDir, 'reports/demo/content.json'), 'utf8')).toBe(before)
    const files = await readdir(path.join(siteDir, 'reports/demo-mdx'))
    expect(files).toContain('index.mdx')
    expect(files.filter((file) => file.endsWith('.mdx')).length).toBeGreaterThan(2)
    expect(await reportEntryIn(siteDir, 'demo-mdx')).toBe('reports/demo-mdx/index.mdx')
    expect((await checkReports(siteDir)).problems).toEqual([])
  })
  it('原报告里有 MDX 写不出的内容时一个文件都不写，列出位置', async () => {
    await save('reports/odd/content.json', JSON.stringify({
      format: 'docreport', schemaVersion: 1, id: 'odd', metadata: { title: '怪', language: 'zh-CN' },
      blocks: [{ type: 'section', id: 's', title: '章', numbering: 'decimal', children: [{ type: 'paragraph', id: 'p', content: [] }] }],
    }))
    const result = await convertReportToMdx(siteDir, 'odd', 'odd-mdx')
    expect(result).toMatchObject({ converted: false, problems: [expect.stringContaining('/blocks/0/children/0：没有内容的段落')] })
    expect(await readdir(path.join(siteDir, 'reports'))).toEqual(['odd'])
  })
  it('新目录已存在、源报告已经是 MDX 都直接报错', async () => {
    await saveDemoJsonReport()
    await saveMdxReport()
    await expect(convertReportToMdx(siteDir, 'demo', 'mdx')).rejects.toThrow('已经存在')
    await expect(convertReportToMdx(siteDir, 'mdx', 'other')).rejects.toThrow('已经是 MDX 报告')
  })
})
