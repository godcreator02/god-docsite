import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { listComments, writeComment } from '../src/comments.js'
import { launchDevServer } from '../src/dev-server.js'
import { joinPeople } from '../src/people-file.js'
import { runPnpm } from '../src/pnpm.js'
import { addSiteFeature } from '../src/scaffold/add-feature.js'
import { createDocsite } from '../src/scaffold/create.js'
import type { HomePageCheckDeps } from '../src/scaffold/home-page-check.js'
import { loadPlatformScaffold } from '../src/scaffold/platform.js'
import { SiteHost } from '../src/site-host.js'
import { longTempDir, pluginDir, repoDir } from './site-fixtures.js'

/** 系统挑一个空闲端口 */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => (typeof address === 'object' && address !== null ? resolve(address.port) : reject(new Error('读不出端口'))))
    })
  })
}

const identityCode = 'realsitetest01'
const root = longTempDir('gwb-docsite-real-')
const siteDir = path.join(root, 'site')
const host = new SiteHost({ log: { info: () => {}, warn: () => {} }, launchDevServer, identityCode: () => identityCode })
const scaffold = () => loadPlatformScaffold()
const pageStatus = async (url: string) => (await fetch(new URL('/', url))).status

afterAll(async () => {
  await host.stopAll()
  rmSync(root, { recursive: true, force: true, maxRetries: 5 })
}, 180_000)

/**
 * 真的建站：平台建站器按 link 装本仓的包（不依赖还没发版的版本号），真的 pnpm install、起开发服务、写评论、推送、
 * 加功能、pnpm build。本仓的包要先构建（仓根 pnpm build）
 */
describe('真的在临时目录建站', () => {
  it('建站 → 加入身份 → 写评论与回复 → 推送 → 加轨迹卡功能 → pnpm build', { timeout: 900_000 }, async () => {
    const port = await freePort()
    const keepRunning: HomePageCheckDeps = { isRegistered: () => true, start: (dir) => host.start(dir), stop: (dir) => host.stop(dir), pageStatus }
    await createDocsite(siteDir, { port, title: '真站' }, { ...keepRunning, scaffold, packageSource: { kind: 'link', repoDir }, pnpm: runPnpm })
    const status = host.statusOf(siteDir)
    expect(status.state).toBe('running')
    const url = status.url!
    expect(new URL(url).port).toBe(String(port))

    expect(await joinPeople(siteDir, identityCode, { id: 'tester', name: '测试员' })).toEqual({ changed: true })
    const created = await writeComment(url, { op: 'create', page: 'start.mdx', body: '真站上的评论' })
    expect(existsSync(path.join(siteDir, 'comments', created.thread, 'index.mdx'))).toBe(true)
    const replied = await writeComment(url, { op: 'reply', thread: created.thread, body: 'agent 的回复', as: 'claude' })
    expect(existsSync(path.join(siteDir, 'comments', created.thread, `${replied.reply}.mdx`))).toBe(true)
    await expect(writeComment(url, { op: 'reply', thread: created.thread, body: 'x', as: 'nobody' })).rejects.toThrow('people.json 里没有 nobody')
    const [thread] = await listComments(siteDir, { page: 'start.mdx' })
    expect(thread).toMatchObject({ id: created.thread, author: 'tester', status: 'open', body: '真站上的评论', replies: [{ author: 'claude', body: 'agent 的回复' }] })
    expect(await writeComment(url, { op: 'resolve', thread: created.thread, as: 'claude' })).toEqual({ thread: created.thread })
    expect((await listComments(siteDir, { page: 'start.mdx' }))[0]).toMatchObject({ status: 'resolved', resolvedBy: 'claude' })
    await expect(writeComment(url, { op: 'resolve', thread: created.thread })).rejects.toThrow('已经是已解决')
    await writeComment(url, { op: 'reopen', thread: created.thread })
    expect((await listComments(siteDir, { page: 'start.mdx' }))[0]!.status).toBe('open')

    await host.push(siteDir, 'probe', { note: '推送一' })
    expect(await (await fetch(new URL('/__docsite/feed/probe', url))).json()).toEqual({ note: '推送一' })

    await host.stop(siteDir)
    const stopAfterCheck: HomePageCheckDeps = { ...keepRunning, isRegistered: () => false }
    const added = await addSiteFeature(
      siteDir,
      { packageName: '@godcreator/trajectory', specifier: `link:${path.join(repoDir, 'packages', 'trajectory').replaceAll('\\', '/')}` },
      { ...stopAfterCheck, scaffold, pnpm: runPnpm, isRunning: (dir) => host.statusOf(dir).state === 'running', versionsFrom: pluginDir },
    )
    expect(added.features).toEqual(['comments', 'trajectory'])
    expect(host.statusOf(siteDir).state).toBe('stopped')

    await runPnpm(siteDir, ['build'], `${siteDir} 里 pnpm build`)
    expect(existsSync(path.join(siteDir, 'build', 'server', 'index.js'))).toBe(true)
  })
})
