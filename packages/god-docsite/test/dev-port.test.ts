import { createServer, type Server } from 'node:net'
import { EventEmitter } from 'node:events'
import type { ConfigEnv, UserConfig, ViteDevServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { devOriginEnvName } from '../src/core/site-origin.js'
import { isPortFree, randomFreePort, randomPortRange } from '../src/node/free-port.js'
import { devPort } from '../src/vite/dev-port.js'

const serve: ConfigEnv = { command: 'serve', mode: 'development' }

async function configOf(config: UserConfig, env: ConfigEnv, randomPort: () => Promise<number>): Promise<UserConfig | null | void> {
  const hook = devPort(randomPort).config
  if (typeof hook !== 'function') throw new Error('devPort 的 config 钩子要是函数')
  return hook.call({} as never, config, env)
}

/** 占住这个端口；本机已经有别的程序占着它就不用再占，回 undefined */
function listenOn(port: number): Promise<Server | undefined> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', (error: NodeJS.ErrnoException) => (error.code === 'EADDRINUSE' ? resolve(undefined) : reject(error)))
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

let held: Server | undefined

afterEach(async () => {
  await new Promise<void>((resolve) => (held === undefined ? resolve() : held.close(() => resolve())))
  held = undefined
  delete process.env[devOriginEnvName]
})

describe('随机挑端口', () => {
  it('挑在五位数、49152 以下的范围里，挑到被占的就再挑', async () => {
    held = await listenOn(randomPortRange.from)
    expect(await isPortFree(randomPortRange.from)).toBe(false)
    const draws = [0, 0.5]
    const port = await randomFreePort(() => draws.shift() ?? 0.5)
    expect(port).not.toBe(randomPortRange.from)
    expect(port).toBeGreaterThanOrEqual(10_000)
    expect(port).toBeLessThanOrEqual(49_151)
  })
})

/** 假的开发服务：只有监听地址与解析好的 server 配置；httpServer 为 null 是不监听的服务（React Router 另外解析配置时建的） */
function fakeDevServer(host: string | boolean | undefined, port: number | null) {
  const httpServer = port === null ? null : Object.assign(new EventEmitter(), { address: () => ({ address: '127.0.0.1', family: 'IPv4', port }) })
  return { httpServer, config: { server: { host } } } as unknown as ViteDevServer
}

function configureServerOf(server: ViteDevServer): void {
  const hook = devPort().configureServer
  if (typeof hook !== 'function') throw new Error('devPort 的 configureServer 钩子要是函数')
  void hook.call({} as never, server)
}

describe('平台 vite 插件定开发端口', () => {
  it('启动时给了 --port 就用它，加上 strictPort', async () => {
    expect(await configOf({ server: { port: 23456, host: '127.0.0.1' } }, serve, () => Promise.reject(new Error('不该挑')))).toEqual({ server: { port: 23456, strictPort: true } })
  })

  it('没给就随机挑，同一个进程里再解析一次配置还是那个端口', async () => {
    expect(await configOf({}, serve, async () => 34567)).toEqual({ server: { port: 34567, strictPort: true } })
    expect(await configOf({}, serve, async () => 45678)).toEqual({ server: { port: 34567, strictPort: true } })
  })

  it('build、预览、vitest 不动', async () => {
    const neverPick = () => Promise.reject(new Error('不该挑'))
    expect(await configOf({}, { command: 'build', mode: 'production' }, neverPick)).toBeUndefined()
    expect(await configOf({}, { command: 'serve', mode: 'production', isPreview: true }, neverPick)).toBeUndefined()
    expect(await configOf({}, { command: 'serve', mode: 'test' }, neverPick)).toBeUndefined()
  })

  it('开始监听时按实际端口与 --host 写 DOCSITE_DEV_ORIGIN；没写主机是 localhost', () => {
    const server = fakeDevServer('127.0.0.1', 23456)
    configureServerOf(server)
    expect(process.env[devOriginEnvName]).toBeUndefined()
    server.httpServer!.emit('listening')
    expect(process.env[devOriginEnvName]).toBe('http://127.0.0.1:23456')
    const withoutHost = fakeDevServer(undefined, 34567)
    configureServerOf(withoutHost)
    withoutHost.httpServer!.emit('listening')
    expect(process.env[devOriginEnvName]).toBe('http://localhost:34567')
  })

  it('不监听的服务不写', () => {
    configureServerOf(fakeDevServer(undefined, null))
    expect(process.env[devOriginEnvName]).toBeUndefined()
  })
})