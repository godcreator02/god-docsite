import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { HostContext } from '@godcreator/god-docsite'
import { listComments, writeComment } from '../src/comments.js'
import { devServerLauncher } from '../src/dev-server.js'
import { joinPeople } from '../src/people-file.js'
import { runPnpm } from '../src/pnpm.js'
import { addSiteFeature } from '../src/scaffold/add-feature.js'
import { createDocsite } from '../src/scaffold/create.js'
import type { HomePageCheckDeps } from '../src/scaffold/home-page-check.js'
import { loadPlatformScaffold } from '../src/scaffold/platform.js'
import { SiteHost } from '../src/site-host.js'
import { SitePorts } from '../src/site-ports.js'
import { longTempDir, pluginDir, repoDir } from './site-fixtures.js'

const identityCode = 'realsitetest01'
const root = longTempDir('gwb-docsite-real-')
const siteDir = path.join(root, 'site')
/** 端口记在内存里，空不空用平台包的真检查 */
const portDocs = new Map<string, unknown>()
const ports = new SitePorts({ readDoc: async (doc) => portDocs.get(doc), writeDoc: async (doc, value) => void portDocs.set(doc, value) }, async (port) => (await loadPlatformScaffold()).isPortFree(port))
/** 开发服务的输出：stdout 与 stderr 各记在哪一边 */
const devOutput = { debug: [] as string[], warn: [] as string[] }
/** 托管方上下文：和 gwb-docsite 推的一样，正文设成更纱等宽，页面的 <head> 里要有对应的变量 */
const hostContext: HostContext = { format: 1, identityCode, dirs: {}, readerFonts: { body: 'Sarasa Mono SC', heading: null, mono: null } }
const launchDevServer = devServerLauncher({ debug: (message) => devOutput.debug.push(message), warn: (message) => devOutput.warn.push(message) })
const host = new SiteHost({ log: { info: () => {}, warn: () => {} }, launchDevServer, hostContextOf: () => hostContext, ports })
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
  it('建站（端口随机挑）→ 加入身份 → 写评论与回复 → 推送 → 重启沿用上次的端口 → 加轨迹卡功能 → pnpm build', { timeout: 900_000 }, async () => {
    const keepRunning: HomePageCheckDeps = { isRegistered: async () => true, start: (dir) => host.start(dir), stop: (dir) => host.stop(dir), pageStatus }
    await createDocsite(siteDir, { title: '真站', kind: 'base', audience: 'personal' }, { ...keepRunning, scaffold, packageSource: { kind: 'link', repoDir }, pnpm: runPnpm })
    const status = host.statusOf(siteDir)
    expect(status.state).toBe('running')
    const url = status.url!
    const port = Number(new URL(url).port)
    expect(port).toBeGreaterThanOrEqual(10_000)
    expect(port).toBeLessThanOrEqual(49_151)
    expect(devOutput.debug.some((entry) => entry.startsWith(`${siteDir}\n`) && entry.includes(url))).toBe(true)
    expect(await (await fetch(new URL('/', url))).text()).toContain('--font-sans: "Sarasa Mono SC", ui-sans-serif')

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
    expect((await host.start(siteDir)).url).toBe(url)
    await host.stop(siteDir)
    const stopAfterCheck: HomePageCheckDeps = { ...keepRunning, isRegistered: async () => false }
    const added = await addSiteFeature(
      siteDir,
      { packageName: '@godcreator/trajectory', specifier: `link:${path.join(repoDir, 'packages', 'trajectory').replaceAll('\\', '/')}` },
      { ...stopAfterCheck, scaffold, pnpm: runPnpm, isRunning: (dir) => host.statusOf(dir).state === 'running', versionsFrom: pluginDir },
    )
    expect(added.features).toEqual(['comments', 'identity', 'trajectory'])
    expect(host.statusOf(siteDir).state).toBe('stopped')

    await runPnpm(siteDir, ['build'], `${siteDir} 里 pnpm build`)
    expect(existsSync(path.join(siteDir, 'build', 'server', 'index.js'))).toBe(true)

    // 工作台退出时的同步停止：返回时整棵进程树已停，端口放开
    await host.start(siteDir)
    host.stopAllNow()
    expect(host.statusOf(siteDir).state).toBe('stopped')
    expect(await (await loadPlatformScaffold()).isPortFree(port)).toBe(true)
  })
})
