import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { pageNameOf } from '../src/core/page-files.js'
import { misplacedContentFilesOf } from '../src/node/content-layout.js'

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

/** 按相对路径建一个内容目录，文件内容不重要 */
function contentDirWith(files: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'content-layout-'))
  roots.push(root)
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), '')
  }
  return root
}

describe('页面名', () => {
  it('mdx、TSX 页面、HTML 页面去掉后缀；下划线开头的 mdx 与别的文件不是页面', () => {
    expect(pageNameOf('waveform.mdx')).toBe('waveform')
    expect(pageNameOf('waveform.page.tsx')).toBe('waveform')
    expect(pageNameOf('waveform.html')).toBe('waveform')
    expect(pageNameOf('_report.mdx')).toBeNull()
    expect(pageNameOf('Comparison.tsx')).toBeNull()
    expect(pageNameOf('meta.json')).toBeNull()
  })
})

describe('内容目录的文件放对了没有', () => {
  it('同名文件夹、组里 _ 开头的文件夹、有子页面的组与它 index 页的文件夹，都放对了', () => {
    const dir = contentDirWith([
      'meta.json',
      'about.mdx',
      'research/meta.json',
      'research/survey.mdx',
      'research/fpga.mdx',
      'research/fpga/Comparison.tsx',
      'research/fpga/fpga.data.mjs',
      'research/fpga/_appendix.mdx',
      'research/fpga/media/board.png',
      'research/lab.page.tsx',
      'research/lab/solver.ts',
      'research/scope.html',
      'research/scope/fig.js',
      'research/_shared/Primitives.tsx',
      'guide/meta.json',
      'guide/index.mdx',
      'guide/index/Overview.tsx',
      'guide/setup.mdx',
      '(kit)/skeleton.mdx',
    ])
    expect(misplacedContentFilesOf(dir)).toEqual([])
  })

  it('组文件夹里散放的组件、图片、被 import 的正文都报出来', () => {
    const dir = contentDirWith(['research/meta.json', 'research/fpga.mdx', 'research/Comparison.tsx', 'research/board.png', 'research/_report.mdx'])
    const problems = misplacedContentFilesOf(dir)
    expect(problems.map((problem) => problem.split('：')[0]).sort()).toEqual(['research/Comparison.tsx', 'research/_report.mdx', 'research/board.png'].sort())
    for (const problem of problems) expect(problem).toContain('和页面同名的文件夹')
  })

  it('页面藏在文件夹里、组件放在旁边的写法：组件算散放在组里', () => {
    const dir = contentDirWith(['research/fpga/index.mdx', 'research/fpga/Comparison.tsx'])
    expect(misplacedContentFilesOf(dir).map((problem) => problem.split('：')[0])).toEqual(['research/fpga/Comparison.tsx'])
  })

  it('同名文件夹与 _ 开头的文件夹里放了页面或 meta.json，连子文件夹里的也报', () => {
    const dir = contentDirWith([
      'research/fpga.mdx',
      'research/fpga/notes.mdx',
      'research/fpga/deep/more.page.tsx',
      'research/fpga/old.html',
      'research/_shared/meta.json',
    ])
    expect(misplacedContentFilesOf(dir).map((problem) => problem.split('：')[0]).sort()).toEqual(
      ['research/_shared/meta.json', 'research/fpga/deep/more.page.tsx', 'research/fpga/notes.mdx', 'research/fpga/old.html'].sort(),
    )
  })
})
