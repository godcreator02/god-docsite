import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commentFormOf, decodeFlatTurboStream } from '../src/comments.js'
import { devOutputEntryOf, localUrlOf, type DevServer } from '../src/dev-server.js'
import { isIdentityCode, joinPeople, newIdentityCode } from '../src/people-file.js'
import { devScriptHasFixedPort } from '../src/site-contract.js'
import { SiteHost, type CrashRestartPolicy, type SitePortMemory } from '../src/site-host.js'

let siteDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'gwb-docsite-'))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true })
})

/** 站点目录里放上 package.json、身份文件与平台包：start 前的核对能过 */
async function siteWithSupportedKit(): Promise<void> {
  await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"dev":"react-router dev --host 127.0.0.1 --strictPort"}}')
  await writeFile(path.join(siteDir, 'docsite.json'), '{"kind":"base","format":1}')
  await installPackage('@godcreator/god-docsite', '0.1.0')
}

async function installPackage(name: string, version: string): Promise<void> {
  const dir = path.join(siteDir, 'node_modules', ...name.split('/'))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version }))
}

/** 假的开发服务：记下推来的数据，能让它退出 */
function fakeServers() {
  const launched: Array<{ code: string; port: number | null; pushed: Array<[string, unknown]>; exit: (reason: string) => void; stopped: boolean; stoppedNow: boolean }> = []
  const launch = async (_dir: string, code: string, port: number | null): Promise<DevServer> => {
    const record = { code, port, pushed: [] as Array<[string, unknown]>, exit: (_reason: string) => {}, stopped: false, stoppedNow: false }
    launched.push(record)
    return {
      url: `http://127.0.0.1:${port ?? 14000 + launched.length}`,
      pid: launched.length,
      onExit: (listener) => (record.exit = listener),
      stop: async () => {
        record.stopped = true
      },
      stopNow: () => {
        record.stoppedNow = true
      },
      push: async (channel, data) => {
        record.pushed.push([channel, data])
      },
    }
  }
  return { launched, launch }
}

/** 假的端口记录：记过的端口照 free 判断空不空，记下的都留在 remembered 里 */
function fakePorts(free = true): SitePortMemory & { remembered: Map<string, number> } {
  const remembered = new Map<string, number>()
  return {
    remembered,
    preferredPortOf: async (dir) => {
      const port = remembered.get(path.resolve(dir).toLowerCase())
      return port !== undefined && free ? port : null
    },
    remember: async (dir, port) => void remembered.set(path.resolve(dir).toLowerCase(), port),
  }
}

/** 测试用的崩溃重启规矩：间隔短到几十毫秒，两次用完 */
const quickRestart: CrashRestartPolicy = { delaysMs: [20, 40], stableAfterMs: 60_000 }

function hostWith(launch: (dir: string, code: string, port: number | null) => Promise<DevServer>, ports: SitePortMemory = fakePorts(), crashRestart: CrashRestartPolicy = quickRestart) {
  const logs: string[] = []
  const host = new SiteHost({
    log: { info: (message) => logs.push(message), warn: (message) => logs.push(message) },
    launchDevServer: launch,
    identityCode: () => 'mycode000001',
    ports,
    crashRestart,
  })
  return { host, logs }
}

const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('站点状态机', () => {
  it('start 启动并交给开发服务身份码，状态转 running', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    expect(await host.start(siteDir)).toEqual({ url: 'http://127.0.0.1:14001', pid: 1, alreadyRunning: false })
    expect(launched[0]!.code).toBe('mycode000001')
    expect(host.statusOf(siteDir)).toEqual({ dir: path.resolve(siteDir), state: 'running', url: 'http://127.0.0.1:14001', error: null })
  })

  it('已在运行再 start 回现状、不重复启动；正在启动的并发 start 复用同一次', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    expect((await host.start(siteDir)).alreadyRunning).toBe(false)
    expect((await host.start(siteDir)).alreadyRunning).toBe(true)
    expect(launched).toHaveLength(1)
    await host.stop(siteDir)

    // 第二轮：launch 挂起期间连发两次 start
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const hanging = fakeServers()
    const hangingLaunch = async (dir: string, code: string, port: number | null): Promise<DevServer> => {
      const server = await hanging.launch(dir, code, port)
      await gate
      return server
    }
    const { host: host2 } = hostWith(hangingLaunch)
    const first = host2.start(siteDir)
    const second = host2.start(siteDir)
    release!()
    await Promise.all([first, second])
    expect(hanging.launched).toHaveLength(1)
  })

  it('stop 转回 stopped；没在运行就报错', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await expect(host.stop(siteDir)).rejects.toThrow('的站点没在运行')
    await host.start(siteDir)
    await host.stop(siteDir)
    expect(launched[0]!.stopped).toBe(true)
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'stopped', url: null, error: null })
    await expect(host.stop(siteDir)).rejects.toThrow('的站点没在运行')
  })

  it('进程自己退出：标 failed、写明几秒后第几次重启，到时自动重启；连续崩溃次数用完就不再重启，再手动 start 清掉错误', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host, logs } = hostWith(launch)
    await host.start(siteDir)
    launched[0]!.exit('开发服务退出了（退出码 1），最后的输出：\nError: boom')
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'failed', url: null })
    expect(host.statusOf(siteDir).error).toBe('开发服务退出了（退出码 1），最后的输出：\nError: boom\n（0 秒后自动重启，第 1 次）')
    expect(logs.join('\n')).toContain('退出了')
    await waitMs(60)
    expect(launched).toHaveLength(2)
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'running', error: null })

    launched[1]!.exit('又退出了')
    expect(host.statusOf(siteDir).error).toContain('第 2 次')
    await waitMs(80)
    expect(launched).toHaveLength(3)

    launched[2]!.exit('第三次退出')
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'failed' })
    expect(host.statusOf(siteDir).error).toContain('连续崩溃 3 次，不再自动重启')
    await waitMs(80)
    expect(launched).toHaveLength(3)

    await host.start(siteDir)
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'running', error: null })
    launched[3]!.exit('手动启动以后重新计数')
    expect(host.statusOf(siteDir).error).toContain('第 1 次')
    await host.stop(siteDir)
  })

  it('等着重启时手动 stop：取消重启、回上次的地址，状态是 stopped；手动 start：取消等着的重启、马上启动', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch, fakePorts(), { delaysMs: [1_000], stableAfterMs: 60_000 })
    await host.start(siteDir)
    launched[0]!.exit('boom')
    expect(await host.stop(siteDir)).toEqual({ url: 'http://127.0.0.1:14001' })
    expect(host.statusOf(siteDir).state).toBe('stopped')
    await expect(host.stop(siteDir)).rejects.toThrow('的站点没在运行')

    await host.start(siteDir)
    launched[1]!.exit('boom')
    await host.start(siteDir)
    expect(launched).toHaveLength(3)
    expect(host.statusOf(siteDir).state).toBe('running')
    await host.stop(siteDir)
  })

  it('运行够久才退出的不算连续崩溃：每次都按第 1 次重启', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch, fakePorts(), { delaysMs: [20], stableAfterMs: 0 })
    await host.start(siteDir)
    for (let index = 0; index < 3; index += 1) {
      launched[index]!.exit('boom')
      expect(host.statusOf(siteDir).error).toContain('第 1 次')
      await waitMs(50)
    }
    expect(launched).toHaveLength(4)
    await host.stop(siteDir)
  })

  it('自动重启那一次没起来也算一次崩溃，接着按下一次的间隔重启', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    let launches = 0
    const flaky = async (dir: string, code: string, port: number | null) => {
      launches += 1
      if (launches === 2) throw new Error('开发服务启动后就退出了（退出码 1）')
      return launch(dir, code, port)
    }
    const { host } = hostWith(flaky)
    await host.start(siteDir)
    launched[0]!.exit('boom')
    await waitMs(30)
    expect(host.statusOf(siteDir).error).toBe('开发服务启动后就退出了（退出码 1）\n（0 秒后自动重启，第 2 次）')
    await waitMs(60)
    expect(launches).toBe(3)
    expect(host.statusOf(siteDir).state).toBe('running')
    await host.stop(siteDir)
  })

  it('启动失败也标 failed、记下原因', async () => {
    await siteWithSupportedKit()
    const { host } = hostWith(async () => {
      throw new Error('开发服务 60 秒内没有报出地址，已停掉')
    })
    await expect(host.start(siteDir)).rejects.toThrow('没有报出地址')
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'failed', error: '开发服务 60 秒内没有报出地址，已停掉' })
  })

  it('不是站点目录、没有身份文件、身份文件写坏了、没装平台包，start 直接拒绝且不 spawn；拒绝的原因记成 failed', async () => {
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await expect(host.start(siteDir)).rejects.toThrow('不是站点目录')
    expect(host.statusOf(siteDir).state).toBe('failed')
    expect(host.statusOf(siteDir).error).toContain('不是站点目录')
    await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"dev":"react-router dev --host 127.0.0.1 --strictPort"}}')
    await expect(host.start(siteDir)).rejects.toThrow('下没有身份文件 docsite.json')
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'failed', url: null })
    expect(host.statusOf(siteDir).error).toContain('下没有身份文件 docsite.json')
    await writeFile(path.join(siteDir, 'docsite.json'), '{"kind":"wiki","format":1}')
    await expect(host.start(siteDir)).rejects.toThrow('kind 要是 base / docs / collab 之一')
    await writeFile(path.join(siteDir, 'docsite.json'), '{"kind":"base","format":1}')
    await expect(host.start(siteDir)).rejects.toThrow('node_modules 里没有 @godcreator/god-docsite')
    expect(launched).toEqual([])
  })

  it('目录写法大小写与斜杠不同算同一个站', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    const otherSpelling = `${siteDir.toUpperCase()}${path.sep}`
    await host.start(siteDir)
    expect((await host.start(otherSpelling)).alreadyRunning).toBe(true)
    expect(host.statusOf(otherSpelling).state).toBe('running')
    expect(launched).toHaveLength(1)
    expect(host.list()).toHaveLength(1)
  })

  it('push：站点没在运行就报错，在运行就推给开发服务', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await expect(host.push(siteDir, 'collab', { n: 1 })).rejects.toThrow('的站点没在运行')
    await host.start(siteDir)
    await host.push(siteDir, 'collab', { n: 1 })
    expect(launched[0]!.pushed).toEqual([['collab', { n: 1 }]])
  })

  it('第一次不给端口、站点自己挑，记下来；下次先试上次的端口，被占了再让站点挑', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const ports = fakePorts()
    const { host } = hostWith(launch, ports)
    await host.start(siteDir)
    expect(launched[0]!.port).toBeNull()
    expect([...ports.remembered.values()]).toEqual([14001])
    await host.stop(siteDir)
    await host.start(siteDir)
    expect(launched[1]!.port).toBe(14001)
    const taken = hostWith(launch, { ...fakePorts(false), preferredPortOf: async () => null })
    await taken.host.start(siteDir)
    expect(launched[2]!.port).toBeNull()
  })

  it('dev 脚本写死了 --port：不启动，直接拒绝', async () => {
    await siteWithSupportedKit()
    await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"dev":"react-router dev --port 4430"}}')
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await expect(host.start(siteDir)).rejects.toThrow('scripts.dev 写死了 --port')
    expect(host.statusOf(siteDir).state).toBe('failed')
    expect(host.statusOf(siteDir).error).toContain('scripts.dev 写死了 --port')
    expect(launched).toEqual([])
  })

  it('stopAll 停掉全部（插件卸载）', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await host.start(siteDir)
    await host.stopAll()
    expect(launched[0]!.stopped).toBe(true)
    expect(host.statusOf(siteDir).state).toBe('stopped')
  })

  it('stopAllNow 同步停掉全部（工作台退出），之后不再启动', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await host.start(siteDir)
    host.stopAllNow()
    expect(launched[0]!.stoppedNow).toBe(true)
    expect(host.statusOf(siteDir).state).toBe('stopped')
    await expect(host.start(siteDir)).rejects.toThrow('插件正在卸载')
  })
})

describe('身份码与人员列表', () => {
  it('新码是 12 个小写字母与数字', () => {
    const code = newIdentityCode()
    expect(code).toMatch(/^[a-z0-9]{12}$/)
    expect(isIdentityCode(code)).toBe(true)
    expect(isIdentityCode('ABC')).toBe(false)
  })

  it('把本 home 的码加进 people.json：一项一行写回；已经在就不改文件', async () => {
    const file = path.join(siteDir, 'people.json')
    await writeFile(file, '[{"id":"zhou","name":"小周"}]')
    expect(await joinPeople(siteDir, 'mycode000001', { id: 'zhou', name: '小周' })).toEqual({ changed: true })
    expect(await readFile(file, 'utf8')).toBe('[\n  {"id":"zhou","name":"小周","codes":["mycode000001"]}\n]\n')
    expect(await joinPeople(siteDir, 'mycode000001', { id: 'zhou', name: '小周' })).toEqual({ changed: false })
    await expect(joinPeople(siteDir, 'mycode000001', { id: 'li', name: '小李' })).rejects.toThrow('身份码 mycode000001 已经写在 zhou 名下')
  })
})

describe('开发服务的输出与评论表单', () => {
  it('读出地址与端口', () => {
    expect(localUrlOf('  ➜  \x1b[32mLocal\x1b[39m:   http://127.0.0.1:4430/\n')).toBe('http://127.0.0.1:4430/')
    expect(localUrlOf('starting')).toBeNull()
  })

  it('输出的一块写成一条日志：开头是站点目录，去掉颜色控制符与末尾空白，只有空白的不记', () => {
    expect(devOutputEntryOf('D:/site', '\x1b[31m[vite] Internal server error\x1b[39m\n    at a.ts:1\n\n')).toBe('D:/site\n[vite] Internal server error\n    at a.ts:1')
    expect(devOutputEntryOf('D:/site', '  \r\n')).toBeNull()
  })

  it('批整页、批页面元素，表单字段和网页的 action 一样', () => {
    const fields = (form: FormData) => Object.fromEntries(form.entries())
    expect(fields(commentFormOf({ op: 'create', page: '/a', anchor: 'some-heading', body: 'x', as: 'claude' }))).toEqual({ intent: 'create-thread', as: 'claude', body: 'x', page: '/a', anchor: 'some-heading' })
    expect(fields(commentFormOf({ op: 'create', page: '/a', body: 'x' }))).toEqual({ intent: 'create-thread', body: 'x', page: '/a' })
    expect(fields(commentFormOf({ op: 'reply', thread: 't', body: 'x' }))).toEqual({ intent: 'reply', threadId: 't', body: 'x' })
    expect(fields(commentFormOf({ op: 'resolve', thread: 't', as: 'claude' }))).toEqual({ intent: 'resolve-thread', threadId: 't', as: 'claude' })
    expect(fields(commentFormOf({ op: 'reopen', thread: 't' }))).toEqual({ intent: 'reopen-thread', threadId: 't' })
  })

  it('评论写入路由回的单次请求数据：扁平对象解成原样，数组与带类型标记的值报错', () => {
    expect(decodeFlatTurboStream('[{"_1":2},"data",{"_3":4,"_5":6,"_7":8},"ok",true,"intent","create-thread","threadId","20261015t110054-er8s"]\n')).toEqual({
      data: { ok: true, intent: 'create-thread', threadId: '20261015t110054-er8s' },
    })
    expect(decodeFlatTurboStream('[{"_1":2},"data",{"_3":4,"_5":6},"ok",false,"error","写入只接受来自 http://127.0.0.1:4571 的请求"]')).toEqual({
      data: { ok: false, error: '写入只接受来自 http://127.0.0.1:4571 的请求' },
    })
    expect(() => decodeFlatTurboStream('[{"_1":2},"data",["D",1]]')).toThrow('解不了数组')
    expect(() => decodeFlatTurboStream('[{"_1":-5},"data"]')).toThrow('下标 -5 不在值表里')
    expect(() => decodeFlatTurboStream('<!DOCTYPE html>')).toThrow()
  })

  it('认出 dev 脚本里写死的 --port', () => {
    expect(devScriptHasFixedPort('react-router dev --port 4430 --host 127.0.0.1')).toBe(true)
    expect(devScriptHasFixedPort('react-router dev --port=4430')).toBe(true)
    expect(devScriptHasFixedPort('react-router dev --host 127.0.0.1 --strictPort')).toBe(false)
  })
})
