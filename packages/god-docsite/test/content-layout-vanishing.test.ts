import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

// 让「列完父目录、还没进子目录时子目录被删」这个时机每次都发生：列内容目录本身时，顺手删掉 directoryToRemoveAfterListing
const removal = vi.hoisted(() => ({ listedDirectory: '', directoryToRemoveAfterListing: '' }))
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>()
  const readdirSync = ((dir: string, options?: unknown) => {
    const entries = fs.readdirSync(dir, options as never)
    if (path.resolve(dir) === removal.listedDirectory && removal.directoryToRemoveAfterListing !== '') {
      fs.rmSync(removal.directoryToRemoveAfterListing, { recursive: true, force: true })
      removal.directoryToRemoveAfterListing = ''
    }
    return entries
  }) as typeof fs.readdirSync
  return { ...fs, default: { ...fs, readdirSync }, readdirSync }
})

const { misplacedContentFilesOf } = await import('../src/node/content-layout.js')

const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function contentDirWith(files: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'content-layout-vanishing-'))
  roots.push(root)
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), '')
  }
  return root
}

describe('内容目录在检查途中变了', () => {
  it('列出来的子组在进去之前被删掉（git 改名、挪目录时常见）：不报错，照删掉以后的样子检查', () => {
    const dir = contentDirWith(['meta.json', 'platform/meta.json', 'platform/fpga-lab.mdx', 'platform/Comparison.tsx', 'sst/meta.json', 'sst/Stray.tsx'])
    removal.listedDirectory = path.resolve(dir)
    removal.directoryToRemoveAfterListing = path.join(dir, 'platform')
    expect(misplacedContentFilesOf(dir).map((problem) => problem.split('：')[0])).toEqual(['sst/Stray.tsx'])
  })

  it('页面的同名文件夹在进去之前被删掉：同样不报错', () => {
    const dir = contentDirWith(['meta.json', 'fpga.mdx', 'fpga/Comparison.tsx', 'fpga/media/board.png'])
    removal.listedDirectory = path.resolve(dir)
    removal.directoryToRemoveAfterListing = path.join(dir, 'fpga')
    expect(misplacedContentFilesOf(dir)).toEqual([])
  })

  it('内容目录本身不在：照旧报错', () => {
    const dir = path.join(contentDirWith([]), 'missing-content')
    expect(() => misplacedContentFilesOf(dir)).toThrow(/ENOENT/)
  })
})
