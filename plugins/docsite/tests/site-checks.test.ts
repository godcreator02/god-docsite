import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createReply, createThread } from '@godcreator/comments/node'
import { listComments, readComments } from '../src/comments.js'
import { loadPlatformNode } from '../src/scaffold/platform.js'
import { checkSite } from '../src/site-check.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'gwb-docsite-checks-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true })
})

async function write(relative: string, text: string): Promise<void> {
  await mkdir(path.dirname(path.join(dir, relative)), { recursive: true })
  await writeFile(path.join(dir, relative), text)
}

/** 站点 node_modules 里放一个假的平台包，bin 指向的脚本按给的退出码退出 */
async function siteWithCheck(script: string | null): Promise<void> {
  const packageDir = 'node_modules/@godcreator/god-docsite'
  await write(`${packageDir}/package.json`, JSON.stringify({ name: '@godcreator/god-docsite', version: '0.1.0', ...(script !== null ? { bin: { 'docsite-check': './check.mjs' } } : {}) }))
  if (script !== null) await write(`${packageDir}/check.mjs`, script)
}

describe('checkSite：运行站点自己那一版的 docsite-check', () => {
  it('退出码 0 通过、1 回问题原话，别的退出码报错', async () => {
    await siteWithCheck("console.log('docsite-check：通过')\n")
    expect(await checkSite(dir)).toEqual({ passed: true, report: 'docsite-check：通过' })
    await siteWithCheck("console.error('有 1 处引用不自包含')\nprocess.exit(1)\n")
    expect(await checkSite(dir)).toEqual({ passed: false, report: '有 1 处引用不自包含' })
    await siteWithCheck("console.error('坏了')\nprocess.exit(3)\n")
    await expect(checkSite(dir)).rejects.toThrow(/没跑起来（退出码 3）。输出：\n坏了/)
  })

  it('没装平台包、装的版本没有 docsite-check 时报错写明怎么办', async () => {
    await expect(checkSite(dir)).rejects.toThrow('先在站点目录里 pnpm install')
    await siteWithCheck(null)
    await expect(checkSite(dir)).rejects.toThrow('没有 docsite-check：先 docsite.site.upgrade 升级站点')
  })
})

describe('readComments：读一个评论目录', () => {
  it('目录不存在回空；有评论照文件原样回', async () => {
    const commentsDir = path.join(dir, 'comments')
    expect(await readComments(commentsDir)).toEqual([])
    const { id } = await createThread(commentsDir, { page: '/papers/abc/paper', authorId: 'tester', body: '这里@tester 看一下', now: new Date('2026-10-21T10:00:00.000Z') })
    await createReply(commentsDir, id, { authorId: 'tester', body: '好', now: new Date('2026-10-21T11:00:00.000Z') })
    expect(await readComments(commentsDir)).toEqual([
      {
        id,
        page: '/papers/abc/paper',
        author: 'tester',
        createdAt: '2026-10-21T10:00:00.000Z',
        status: 'open',
        body: '这里@tester 看一下',
        replies: [{ author: 'tester', createdAt: '2026-10-21T11:00:00.000Z', body: '好' }],
      },
    ])
  })
})

describe('listComments：page 也收页面地址', () => {
  it('内容页的路径与地址都认得出同一串；功能页按地址认', async () => {
    await write('people.json', JSON.stringify([{ id: 'tester', name: '测试员', codes: ['testcode0001'] }]))
    const commentsDir = path.join(dir, 'comments')
    await createThread(commentsDir, { page: '(guide)/setup/index.mdx', authorId: 'tester', body: '内容页', now: new Date('2026-10-21T10:00:00.000Z') })
    await createThread(commentsDir, { page: '/papers/abc/paper', authorId: 'tester', body: '论文页', now: new Date('2026-10-21T10:01:00.000Z') })
    const bodiesOf = async (page: string) => (await listComments(dir, { page })).map((thread) => thread.body)
    expect(await bodiesOf('(guide)/setup/index.mdx')).toEqual(['内容页'])
    expect(await bodiesOf('/setup')).toEqual(['内容页'])
    expect(await bodiesOf('/papers/abc/paper')).toEqual(['论文页'])
  })
})

describe('checkMdx：经插件旁边装的平台包编译一页外部 mdx', () => {
  it('编译过回 ok；写了 import 回编译器原话', async () => {
    const { checkMdx } = await loadPlatformNode()
    await write('page.mdx', '---\ntitle: 一页\n---\n\n正文 $x$\n')
    expect(await checkMdx(path.join(dir, 'page.mdx'), { rootDir: dir })).toEqual({ ok: true })
    await write('bad.mdx', "import X from './x'\n\n<X />\n")
    const result = await checkMdx(path.join(dir, 'bad.mdx'), { rootDir: dir })
    expect(result.ok).toBe(false)
  })
})
