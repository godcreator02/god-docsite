import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commentFormOf } from '../src/comments.js'
import { devPortOf, localUrlOf } from '../src/dev-server.js'
import type { DevServer } from '../src/dev-server.js'
import { isIdentityCode, joinPeople, newIdentityCode } from '../src/people-file.js'
import { SiteHost } from '../src/site-host.js'

let siteDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'gwb-docsite-'))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true })
})

/** 假的开发服务：记下推来的数据，能让它意外退出 */
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

function hostWith(launch: (dir: string, code: string) => Promise<DevServer>, problems: string[] = []) {
  const warnings: string[] = []
  const host = new SiteHost({
    log: { info: () => {}, warn: (message) => warnings.push(message) },
    launchDevServer: launch,
    identityCode: () => 'mycode000001',
    siteProblems: async () => problems,
    now: () => Date.now(),
    restartDelayMilliseconds: 1,
  })
  return { host, warnings }
}

async function siteWithDependencies() {
  await writeFile(path.join(siteDir, 'package.json'), '{"scripts":{"dev":"react-router dev --port 4430"}}')
  await mkdir(path.join(siteDir, 'node_modules'))
}

describe('托管站点', () => {
  it('启动时交给开发服务身份码；推送在站点没运行时记着，启动后补推最新的一份', async () => {
    await siteWithDependencies()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    host.push(siteDir, 'collab', { n: 1 })
    host.push(siteDir, 'collab', { n: 2 })
    await host.keep(siteDir)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(launched[0]!.code).toBe('mycode000001')
    expect(launched[0]!.pushed).toEqual([['collab', { n: 2 }]])
    expect(host.statusOf(siteDir)).toMatchObject({ running: true, kept: true, url: 'http://127.0.0.1:4001', error: null })
  })

  it('没装依赖、站点检查不过时不启动，原因记在 error 里', async () => {
    await writeFile(path.join(siteDir, 'package.json'), '{}')
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch, ['a/index.mdx 的 author wang 不在 people.json 里'])
    await host.keep(siteDir)
    expect(host.statusOf(siteDir).error).toContain('还没有装依赖')
    await mkdir(path.join(siteDir, 'node_modules'))
    await expect(host.start(siteDir)).rejects.toThrow('站点检查不过，照原话改好再启动：\na/index.mdx 的 author wang 不在 people.json 里')
    expect(launched).toEqual([])
  })

  it('意外退出就重启；人为停止后不自动启动，start 再启动', async () => {
    await siteWithDependencies()
    const { launched, launch } = fakeServers()
    const { host } = hostWith(launch)
    await host.keep(siteDir)
    launched[0]!.exit('退出码 1')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(launched).toHaveLength(2)
    await host.stop(siteDir)
    expect(launched[1]!.stopped).toBe(true)
    await host.keep(siteDir)
    expect(launched).toHaveLength(2)
    expect((await host.start(siteDir)).alreadyRunning).toBe(false)
    expect(launched).toHaveLength(3)
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

  it('批一页上的字、批整页、不挂在页面上，表单字段和网页一样', () => {
    const fields = (form: FormData) => Object.fromEntries(form.entries())
    expect(fields(commentFormOf({ op: 'create', page: '/a', quote: '原文', occurrence: 2, body: 'x', as: 'claude' }))).toEqual({ op: 'create', as: 'claude', body: 'x', page: '/a', anchor: '{"quote":"原文","occurrence":2}' })
    expect(fields(commentFormOf({ op: 'create', page: '/a', body: 'x' }))).toEqual({ op: 'create', body: 'x', page: '/a', anchor: '{}' })
    expect(fields(commentFormOf({ op: 'create', body: 'x' }))).toEqual({ op: 'create', body: 'x' })
    expect(fields(commentFormOf({ op: 'resolve', thread: 't' }))).toEqual({ op: 'resolve', thread: 't' })
  })
})
