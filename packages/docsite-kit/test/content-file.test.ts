import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { contentFileResponse } from '../src/server/index.js'

let contentDir = ''

beforeAll(async () => {
  contentDir = path.join(await mkdtemp(path.join(tmpdir(), 'docsite-kit-content-')), 'content')
  await mkdir(path.join(contentDir, 'design'), { recursive: true })
  await writeFile(path.join(contentDir, 'design', 'topology.html'), '<title>拓扑</title>')
  await writeFile(path.join(contentDir, 'design', 'notes.mdx'), '# 不送')
})

afterAll(async () => {
  await rm(path.dirname(contentDir), { recursive: true, force: true })
})

describe('原样送出内容目录里的文件', () => {
  it('按扩展名带上类型，不让浏览器缓存', async () => {
    const response = await contentFileResponse('design/topology.html', contentDir)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(await response.text()).toBe('<title>拓扑</title>')
  })

  it('出了内容目录回 400，不认的扩展名回 415，没有这个文件回 404', async () => {
    expect((await contentFileResponse('../secret.txt', contentDir)).status).toBe(400)
    expect((await contentFileResponse('design/notes.mdx', contentDir)).status).toBe(415)
    expect((await contentFileResponse('design/missing.svg', contentDir)).status).toBe(404)
  })
})
