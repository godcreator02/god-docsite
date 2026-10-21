import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { contentLayoutIssuesOf, hotUpdateIssueOf, runtimeIssueOf } from '../src/site/dev-updates.js'
import { devContentLayoutReportOf, sameContentLayoutReport } from '../src/vite/content-layout.js'
import { dataDirsDeclaredBy } from '../src/node/data-dirs.js'
import { batchedCalls } from '../src/vite/data-dirs.js'

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function contentDirWith(files: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dev-updates-'))
  roots.push(root)
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), '')
  }
  return root
}

describe('dataDirsDeclaredBy', () => {
  it('没写 godDocsite 或没写 dataDirs 是没有；写了就原样交回', () => {
    expect(dataDirsDeclaredBy('a', {})).toEqual([])
    expect(dataDirsDeclaredBy('a', { godDocsite: { collections: ['journal'] } })).toEqual([])
    expect(dataDirsDeclaredBy('@godcreator/collab', { godDocsite: { collections: ['journal'], dataDirs: ['../collab', 'journal'] } })).toEqual(['../collab', 'journal'])
  })

  it('godDocsite 不是对象、dataDirs 不是非空字符串的数组都报错，写明是哪个包', () => {
    expect(() => dataDirsDeclaredBy('bad', { godDocsite: 'x' })).toThrow(/bad 的 package.json 里 godDocsite 要是对象/)
    expect(() => dataDirsDeclaredBy('bad', { godDocsite: { dataDirs: '../collab' } })).toThrow(/bad 的 package.json 里 godDocsite.dataDirs/)
    expect(() => dataDirsDeclaredBy('bad', { godDocsite: { dataDirs: [''] } })).toThrow(/godDocsite.dataDirs/)
  })
})

describe('batchedCalls', () => {
  it('一批调用只在最后一次之后过了间隔才运行一次', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const call = batchedCalls(300, run)
    call()
    vi.advanceTimersByTime(200)
    call()
    vi.advanceTimersByTime(299)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('devContentLayoutReportOf', () => {
  it('放对了没有问题，放错了逐条写明', () => {
    expect(devContentLayoutReportOf('content', contentDirWith(['meta.json', 'a.mdx']))).toEqual({ contentDir: 'content', problems: [], checkError: null })
    const report = devContentLayoutReportOf('content', contentDirWith(['meta.json', 'sst/meta.json', 'sst/Stray.tsx']))
    expect(report.checkError).toBeNull()
    expect(report.problems.map((problem) => problem.split('：')[0])).toEqual(['sst/Stray.tsx'])
  })

  it('读目录失败报成这次没查成，不抛出（抛在文件监视的回调里会让开发服务退出）', () => {
    const report = devContentLayoutReportOf('content', path.join(contentDirWith([]), 'missing-content'))
    expect(report.problems).toEqual([])
    expect(report.checkError).toMatch(/ENOENT/)
  })
})

describe('sameContentLayoutReport', () => {
  it('问题清单与没查成的原因都一样才算同一个结果', () => {
    const base = { contentDir: 'content', problems: ['a', 'b'], checkError: null }
    expect(sameContentLayoutReport(base, { ...base, problems: ['a', 'b'] })).toBe(true)
    expect(sameContentLayoutReport(base, { ...base, problems: ['a'] })).toBe(false)
    expect(sameContentLayoutReport(base, { ...base, problems: ['a', 'c'] })).toBe(false)
    expect(sameContentLayoutReport(base, { ...base, checkError: 'EPERM' })).toBe(false)
  })
})

describe('contentLayoutIssuesOf', () => {
  it('都放对了没有问题；放错的每个文件一条，标题是文件、点开是该怎么放', () => {
    expect(contentLayoutIssuesOf({ contentDir: 'content', problems: [], checkError: null })).toEqual([])
    expect(contentLayoutIssuesOf({ contentDir: 'content', problems: ['sst/Stray.tsx：组文件夹里只放页面'], checkError: null })).toEqual([{ title: 'content/sst/Stray.tsx', detail: '组文件夹里只放页面' }])
  })

  it('没查成是一条，点开是原因', () => {
    const issues = contentLayoutIssuesOf({ contentDir: 'content', problems: [], checkError: "EPERM: operation not permitted, scandir 'x'" })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.title).toMatch(/这次没查成/)
    expect(issues[0]?.detail).toBe("EPERM: operation not permitted, scandir 'x'")
  })
})

describe('hotUpdateIssueOf', () => {
  it('标题是报错第一行，点开依次是插件、文件与位置、代码片段、调用栈', () => {
    const issue = hotUpdateIssueOf({ message: 'Unexpected character\nmore', stack: 'at mdx', id: '/site/content/a.mdx', loc: { line: 3, column: 5 }, frame: '> 3 | <', plugin: 'fumadocs-mdx' })
    expect(issue.title).toBe('Unexpected character')
    expect(issue.detail).toBe('插件 fumadocs-mdx\n\n/site/content/a.mdx:3:5\n\n> 3 | <\n\nat mdx')
  })
})

describe('runtimeIssueOf', () => {
  it('Error 取原话与调用栈，别的值转成文字', () => {
    const error = new Error('boom')
    expect(runtimeIssueOf(error)).toEqual({ title: 'boom', detail: error.stack })
    expect(runtimeIssueOf('plain')).toEqual({ title: 'plain', detail: 'plain' })
    expect(runtimeIssueOf({ code: 1 })).toEqual({ title: '{"code":1}', detail: '{"code":1}' })
  })
})
