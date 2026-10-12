import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hostedSitesDoc, parseHostedSitesDoc, startPortOf } from '../src/hosted-sites.js'
import { parseRestartArgs, parseSiteDirArgs } from '../src/site-args.js'
import { HOSTED_SITE_LIFETIME_MS, SiteHost, SiteHostRejected, type HostClock } from '../src/site-host.js'
import type { RunningServer, SiteRunner } from '../src/site-process.js'

/** 托管逻辑用假的子进程测：记下 build 与 start 的先后，端口占用、构建失败由用例指定 */
class FakeRunner implements SiteRunner {
  readonly calls: string[] = []
  readonly occupied = new Set<number>()
  failBuild: string | null = null
  private nextPid = 100
  private readonly exitListeners: ((reason: string) => void)[] = []

  async build(dir: string): Promise<void> {
    this.calls.push(`build ${path.basename(dir)}`)
    if (this.failBuild !== null) throw new Error(this.failBuild)
    fs.mkdirSync(path.join(dir, '.next'), { recursive: true })
    fs.writeFileSync(path.join(dir, '.next', 'BUILD_ID'), 'x')
  }

  async start(dir: string, port: number): Promise<RunningServer> {
    this.calls.push(`start ${path.basename(dir)}:${String(port)}`)
    this.occupied.add(port)
    const pid = this.nextPid++
    return {
      pid,
      stop: async () => {
        this.calls.push(`stop ${String(pid)}`)
        this.occupied.delete(port)
      },
      onUnexpectedExit: (listener) => {
        this.exitListeners.push(listener)
      },
    }
  }

  async portInUse(port: number): Promise<boolean> {
    return this.occupied.has(port)
  }

  crash(reason: string): void {
    for (const listener of this.exitListeners) listener(reason)
  }
}

/** 手动拨的时钟：advance 到点就调排着的回调 */
class ManualClock implements HostClock {
  private time = Date.UTC(2026, 9, 9, 4, 0, 0)
  private timers: { at: number; run: () => void }[] = []

  now(): number {
    return this.time
  }

  schedule(ms: number, run: () => void): () => void {
    const timer = { at: this.time + ms, run }
    this.timers.push(timer)
    return () => {
      this.timers = this.timers.filter((other) => other !== timer)
    }
  }

  advance(ms: number): void {
    this.time += ms
    const due = this.timers.filter((timer) => timer.at <= this.time)
    this.timers = this.timers.filter((timer) => timer.at > this.time)
    for (const timer of due) timer.run()
  }
}

class MemoryStore {
  value: unknown = undefined
  async read(): Promise<unknown> {
    return this.value
  }
  async write(value: unknown): Promise<void> {
    this.value = value
  }
}

const silent = { info: () => undefined, warn: () => undefined }
let root: string

function makeSite(name: string, port: number, built = true): string {
  const dir = path.join(root, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { start: `next start -p ${String(port)} -H 127.0.0.1` } }))
  if (built) {
    fs.mkdirSync(path.join(dir, '.next'))
    fs.writeFileSync(path.join(dir, '.next', 'BUILD_ID'), 'x')
  }
  return dir
}

/** startAll 只等登记表读进来；各站在自己的队列里启动，排在后面的命令会等它 */
const settle = (host: SiteHost) => host.list()

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-host-'))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('托管站点', () => {
  it('add 登记并启动；端口从 start 脚本读，登记表只记目录', async () => {
    const runner = new FakeRunner()
    const store = new MemoryStore()
    const host = new SiteHost(runner, store, silent)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    const state = await host.add(site)
    expect(state).toMatchObject({ dir: site, port: 4339, status: 'running', pid: 100, url: 'http://127.0.0.1:4339', error: null, added: true })
    expect(runner.calls).toEqual(['start docs-site:4339'])
    expect(store.value).toEqual({ sites: [{ dir: site }] })
    expect((await host.add(site)).added, '登记过的只回它此刻的样子').toBe(false)
  })

  it('没构建过的站 add 时先 build', async () => {
    const runner = new FakeRunner()
    const host = new SiteHost(runner, new MemoryStore(), silent)
    await host.startAll()
    await host.add(makeSite('fresh', 4340, false))
    expect(runner.calls).toEqual(['build fresh', 'start fresh:4340'])
  })

  it('插件加载时启动登记表里的站，不构建；没构建过的记下原因', async () => {
    const runner = new FakeRunner()
    const store = new MemoryStore()
    const built = makeSite('built', 4341)
    const unbuilt = makeSite('unbuilt', 4342, false)
    store.value = hostedSitesDoc([built, unbuilt])
    const host = new SiteHost(runner, store, silent)
    await host.startAll()
    await host.restart(built, { build: false })
    await host.restart(unbuilt, { build: false })
    const states = settle(host)
    expect(states.find((state) => state.dir === built)).toMatchObject({ status: 'running' })
    const unbuiltState = states.find((state) => state.dir === unbuilt)
    expect(unbuiltState?.status).toBe('failed')
    expect(unbuiltState?.error).toContain('docfirst.site.restart')
    expect(runner.calls).not.toContain('build unbuilt')
  })

  it('restart：停掉 → build → 启动，顺序不乱', async () => {
    const runner = new FakeRunner()
    const host = new SiteHost(runner, new MemoryStore(), silent)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    await host.add(site)
    const state = await host.restart(site, { build: true })
    expect(runner.calls).toEqual(['start docs-site:4339', 'stop 100', 'build docs-site', 'start docs-site:4339'])
    expect(state).toMatchObject({ status: 'running', pid: 101, built: true })
  })

  it('构建失败时站保持停着，原因写进 error，回执照常回', async () => {
    const runner = new FakeRunner()
    const host = new SiteHost(runner, new MemoryStore(), silent)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    await host.add(site)
    runner.failBuild = 'pnpm build 失败（退出码 1）'
    const state = await host.restart(site, { build: true })
    expect(state).toMatchObject({ status: 'failed', pid: null, url: null, error: 'pnpm build 失败（退出码 1）', built: false })
    expect(runner.occupied.has(4339)).toBe(false)
  })

  it('端口被别的进程占着就不启动，写明怎么办', async () => {
    const runner = new FakeRunner()
    runner.occupied.add(4339)
    const host = new SiteHost(runner, new MemoryStore(), silent)
    await host.startAll()
    const state = await host.add(makeSite('docs-site', 4339))
    expect(state.status).toBe('failed')
    expect(state.error).toContain('已经被别的进程占着')
    expect(runner.calls).toEqual([])
  })

  it('意外退出只记下原因，不自动重启', async () => {
    const runner = new FakeRunner()
    const host = new SiteHost(runner, new MemoryStore(), silent)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    await host.add(site)
    runner.crash('pnpm start 退出了（退出码 1）')
    expect(host.list()[0]).toMatchObject({ status: 'failed', pid: null, error: 'pnpm start 退出了（退出码 1）' })
    expect(runner.calls).toEqual(['start docs-site:4339'])
  })

  it('每次启动开 12 小时，到点停掉、记成 expired；restart 重新计时', async () => {
    const runner = new FakeRunner()
    const clock = new ManualClock()
    const host = new SiteHost(runner, new MemoryStore(), silent, clock)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    const started = await host.add(site)
    expect(started.expiresAt).toBe(new Date(clock.now() + HOSTED_SITE_LIFETIME_MS).toISOString())

    clock.advance(HOSTED_SITE_LIFETIME_MS - 60_000)
    const restarted = await host.restart(site, { build: false })
    expect(restarted.expiresAt, 'restart 从现在重新算 12 小时').toBe(new Date(clock.now() + HOSTED_SITE_LIFETIME_MS).toISOString())

    clock.advance(60_000)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.list()[0], '第一次的计时被 restart 取消了，到它的时刻也不停').toMatchObject({ status: 'running', pid: 101 })
  })

  it('到点停掉的站状态是 expired，没有地址与到期时刻', async () => {
    const runner = new FakeRunner()
    const clock = new ManualClock()
    const host = new SiteHost(runner, new MemoryStore(), silent, clock)
    await host.startAll()
    await host.add(makeSite('docs-site', 4339))
    clock.advance(HOSTED_SITE_LIFETIME_MS)
    // 到点的停止排在这个站的队列里：等它跑完
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.list()[0]).toMatchObject({ status: 'expired', pid: null, url: null, expiresAt: null, error: null })
    expect(runner.calls).toEqual(['start docs-site:4339', 'stop 100'])
  })

  it('remove 停掉并从登记表里去掉；没托管的 restart、remove 都拒绝', async () => {
    const runner = new FakeRunner()
    const store = new MemoryStore()
    const host = new SiteHost(runner, store, silent)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    await host.add(site)
    expect(await host.remove(site)).toEqual({ dir: site, removed: true })
    expect(store.value).toEqual({ sites: [] })
    expect(runner.calls.at(-1)).toBe('stop 100')
    await expect(host.restart(site, { build: true })).rejects.toBeInstanceOf(SiteHostRejected)
    await expect(host.remove(site)).rejects.toThrow('docfirst.site.add')
  })

  it('同一个目录换个大小写写法也认成同一个站（Windows）', async () => {
    if (process.platform !== 'win32') return
    const host = new SiteHost(new FakeRunner(), new MemoryStore(), silent)
    await host.startAll()
    const site = makeSite('docs-site', 4339)
    await host.add(site)
    expect((await host.add(site.toUpperCase())).added).toBe(false)
  })

  it('stopAll 停掉全部，之后不再启动', async () => {
    const runner = new FakeRunner()
    const host = new SiteHost(runner, new MemoryStore(), silent)
    await host.startAll()
    await host.add(makeSite('a', 4339))
    await host.stopAll()
    expect(runner.occupied.size).toBe(0)
  })

  it('start 脚本没写端口的不能登记', async () => {
    const host = new SiteHost(new FakeRunner(), new MemoryStore(), silent)
    await host.startAll()
    const dir = path.join(root, 'no-port')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { start: 'next start' } }))
    await expect(host.add(dir)).rejects.toThrow('写死一个端口')
  })
})

describe('登记表与端口', () => {
  it('没有登记表是空表，形状不对直接报错', () => {
    expect(parseHostedSitesDoc(undefined)).toEqual([])
    expect(parseHostedSitesDoc({ sites: [{ dir: 'D:\\a\\docs-site' }] })).toEqual(['D:\\a\\docs-site'])
    expect(() => parseHostedSitesDoc({ sites: 'x' })).toThrow('{ sites: [{ dir }] }')
    expect(() => parseHostedSitesDoc({ sites: [{ dir: 'relative' }] })).toThrow('绝对路径')
  })

  it('端口只认 start 脚本里写死的一个', () => {
    expect(startPortOf({ scripts: { start: 'next start -p 4339 -H 127.0.0.1' } }, 'd')).toBe(4339)
    expect(() => startPortOf({ scripts: {} }, 'd')).toThrow('没有 start 脚本')
    expect(() => startPortOf({ scripts: { start: 'next start' } }, 'd')).toThrow('写死一个端口')
  })
})

describe('托管命令的参数', () => {
  it('dir 要绝对路径，多给的键报错，build 默认 true', () => {
    const relative = parseSiteDirArgs('docfirst.site.add', { dir: 'docs-site' })
    expect(!relative.ok && relative.error).toContain('绝对路径')
    const extraKey = parseSiteDirArgs('docfirst.site.add', { dir: root, port: 1 })
    expect(!extraKey.ok && extraKey.error).toContain('不认识的参数：port')
    expect(parseRestartArgs('docfirst.site.restart', { dir: root })).toEqual({ ok: true, args: { dir: root, build: true } })
    expect(parseRestartArgs('docfirst.site.restart', { dir: root, build: 'no' })).toMatchObject({ ok: false })
  })
})
