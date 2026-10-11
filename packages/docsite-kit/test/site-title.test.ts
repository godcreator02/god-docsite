import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { siteTitleOf } from '../src/server/files.js'

let siteDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'docsite-title-'))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true })
})

describe('站名', () => {
  it('是 content/meta.json 的 title；没有这个文件、没写 title 时为 null；不是 JSON 就报错', async () => {
    expect(siteTitleOf(siteDir)).toBeNull()
    await mkdir(path.join(siteDir, 'content'))
    const meta = path.join(siteDir, 'content', 'meta.json')
    await writeFile(meta, '{"pages":["a"]}')
    expect(siteTitleOf(siteDir)).toBeNull()
    await writeFile(meta, '{"title":"SST 样机","pages":["a"]}')
    expect(siteTitleOf(siteDir)).toBe('SST 样机')
    await writeFile(meta, '{title')
    expect(() => siteTitleOf(siteDir)).toThrow('不是 JSON')
  })
})
