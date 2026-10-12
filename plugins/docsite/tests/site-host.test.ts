import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commentFormOf } from '../src/comments.js'
import { devPortOf, localUrlOf, type DevServer } from '../src/dev-server.js'
import { isIdentityCode, joinPeople, newIdentityCode } from '../src/people-file.js'
import { SiteHost } from '../src/site-host.js'

let siteDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'gwb-docsite-'))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true })
})

/** 站点目录里放上 package.json 与一版够新的基础包：start 前的版本核对能过 */
async function siteWithSupportedKit(): Promise<void> {
  await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"dev":"react-router dev --port 4430"}}')
  const kitDir = path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit')
  await mkdir(kitDir, { recursive: true })
  await writeFile(path.join(kitDir, 'package.json'), '{"name":"@godcreator/docsite-kit","version":"0.2.1"}')
}

/** 假的开发服务：记下推来的数据，能让它退出 */
function fakeServers() {
  const launched: Array<{ code: string; pushed: Array<[string, unknown]>; exit: (reason: string) => void; stopped: boolean }> = []
  const launch = async (_dir: string, code: string): Promise<DevServer> => {
    const record = { code, pushed: [] as Array<[string, unknown]>, exit: (_reason: string) => {}, stopped: false }
    launched.push(record)
    return {
      url: `http://127.0.0.1:${4000 + launched.length}`,
      pid: launched.length,
      onExit: (listener) => (record.exit = listener),
      stop: async () => {
        record.stopped = true
      },
      push: async (channel, data) => {
        record.pushed.push([channel, data])
      },
    }
  }
  return { launched, launch }
}

function hostWith(launch: (dir: string, code: string) => Promise<DevServer>) {
  const logs: string[] = []
  const host = new SiteHost({
    log: { info: (message) => logs.push(message), warn: (message) => logs.push(message) },
    launchDevServer: launch,
    identityCode: () => 'mycode000001',
  })
  return { host, logs }
}

describe('站点状态机', () => {
  it('start 启动并交给开发服务身份码，状态转 running', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    expect(await host.start(siteDir)).toEqual({ url: 'http://127.0.0.1:4001', pid: 1, alreadyRunning: false })
    expect(launched[0]!.code).toBe('mycode000001')
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'running', url: 'http://127.0.0.1:4001', expectedUrl: 'http://127.0.0.1:4430', error: null })
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
    const hangingLaunch = async (dir: string, code: string): Promise<DevServer> => {
      const server = await hanging.launch(dir, code)
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

  it('进程退出只标 failed、记下原因，不自动重启；再 start 清掉错误', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host, logs } = hostWith(launch)
    await host.start(siteDir)
    launched[0]!.exit('开发服务退出了（退出码 1），最后的输出：\nError: boom')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'failed', url: null, error: '开发服务退出了（退出码 1），最后的输出：\nError: boom' })
    expect(logs.join('\n')).toContain('退出了')
    expect(launched).toHaveLength(1)
    await host.start(siteDir)
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'running', error: null })
  })

  it('启动失败也标 failed、记下原因', async () => {
    await siteWithSupportedKit()
    const { host } = hostWith(async () => {
      throw new Error('开发服务 60 秒内没有报出地址，已停掉')
    })
    await expect(host.start(siteDir)).rejects.toThrow('没有报出地址')
    expect(host.statusOf(siteDir)).toMatchObject({ state: 'failed', error: '开发服务 60 秒内没有报出地址，已停掉' })
  })

  it('站点没装够版本的基础包、不是站点目录，start 直接拒绝且不 spawn', async () => {
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await expect(host.start(siteDir)).rejects.toThrow('不是站点目录')
    await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"dev":"react-router dev --port 4430"}}')
    await expect(host.start(siteDir)).rejects.toThrow('在站点目录里运行 pnpm install')
    const kitDir = path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit')
    await mkdir(kitDir, { recursive: true })
    await writeFile(path.join(kitDir, 'package.json'), '{"name":"@godcreator/docsite-kit","version":"0.1.9"}')
    await expect(host.start(siteDir)).rejects.toThrow('低于插件支持的最低版')
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

  it('stopAll 停掉全部（插件卸载）', async () => {
    await siteWithSupportedKit()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await host.start(siteDir)
    await host.stopAll()
    expect(launched[0]!.stopped).toBe(true)
    expect(host.statusOf(siteDir).state).toBe('stopped')
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
    expect(devPortOf('react-router dev --port 4430 --host 127.0.0.1')).toBe(4430)
  })

  it('批整页、批页面元素，表单字段和网页的 action 一样', () => {
    const fields = (form: FormData) => Object.fromEntries(form.entries())
    expect(fields(commentFormOf({ op: 'create', page: '/a', anchor: 'some-heading', body: 'x', as: 'claude' }))).toEqual({ intent: 'create-thread', as: 'claude', body: 'x', page: '/a', anchor: 'some-heading' })
    expect(fields(commentFormOf({ op: 'create', page: '/a', body: 'x' }))).toEqual({ intent: 'create-thread', body: 'x', page: '/a' })
    expect(fields(commentFormOf({ op: 'reply', thread: 't', body: 'x' }))).toEqual({ intent: 'reply', threadId: 't', body: 'x' })
  })
})
