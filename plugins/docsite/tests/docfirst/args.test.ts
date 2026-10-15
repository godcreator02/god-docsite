import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCreateArgs } from '../../src/docfirst/args.js'

/** docfirst.create 的参数 `{ dir, title? }` 是外部输入：形状不对、不认识的键都直接报错 */

let repo: string
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-args-'))
})
afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true })
})

describe('parseCreateArgs', () => {
  it('只给 dir：站目录与仓目录都解析出来，别的键不出现', () => {
    const dir = path.join(repo, 'docs-site')
    expect(parseCreateArgs('x.create', { dir })).toEqual({ ok: true, args: { siteDir: dir, repoDir: repo } })
  })

  it('title 去掉首尾空白', () => {
    const dir = path.join(repo, 'docs-site')
    expect(parseCreateArgs('x.create', { dir, title: ' 站 ' })).toEqual({ ok: true, args: { siteDir: dir, repoDir: repo, title: '站' } })
  })

  it('错误里带命令名，说清错在哪', () => {
    const dir = path.join(repo, 'docs-site')
    const errorOf = (raw: unknown): string => {
      const parsed = parseCreateArgs('x.create', raw)
      if (parsed.ok) throw new Error('应当报错')
      return parsed.error
    }
    expect(errorOf(undefined)).toMatch(/^x\.create 要 .*给的不是对象/)
    expect(errorOf({})).toMatch(/dir 是站目录的绝对路径/)
    expect(errorOf({ dir, neighborhood: repo, dryRun: true })).toMatch(/不认识的参数：neighborhood、dryRun/)
    expect(errorOf({ dir: 'docs-site' })).toMatch(/dir 要是绝对路径/)
    expect(errorOf({ dir: path.join(repo, 'nope', 'docs-site') })).toMatch(/上一级要是已经存在的仓目录/)
    expect(errorOf({ dir, title: '  ' })).toMatch(/title/)
    expect(errorOf({ dir, port: 4310 })).toMatch(/不认识的参数：port/)
  })
})
