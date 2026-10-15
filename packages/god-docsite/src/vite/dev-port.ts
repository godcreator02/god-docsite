import type { AddressInfo } from 'node:net'
import type { Plugin } from 'vite'
import { browserHostOf, devOriginEnvName } from '../core/site-origin.js'
import { randomFreePort } from '../node/free-port.js'

/** 这个进程里已经随机挑过的端口：React Router 启动时会不止一次解析 Vite 配置，每次都要是同一个端口 */
let randomPortOfProcess: number | undefined

/**
 * 开发服务的端口：启动时给了 --port 就用它，没给就随机挑一个空闲的五位数端口；都加 strictPort，端口被占就报错、不悄悄换一个。
 * 开发服务开始监听时，把它的地址写进环境变量 DOCSITE_DEV_ORIGIN，站点按它认写入请求的来源（服务端代码与 Vite 在同一个进程里）。
 * 只在真正监听的那个服务上写：React Router 另外解析配置时建的服务不监听，它们的主机名可能没带上 --host。
 * build、预览、vitest 都不动
 */
export function devPort(randomPort: () => Promise<number> = randomFreePort): Plugin {
  return {
    name: 'god-docsite:dev-port',
    async config(config, env) {
      if (env.command !== 'serve' || env.isPreview === true || env.mode === 'test') return
      const port = config.server?.port ?? (randomPortOfProcess ??= await randomPort())
      return { server: { port, strictPort: true } }
    },
    configureServer(server) {
      const httpServer = server.httpServer
      if (httpServer === null) return
      httpServer.once('listening', () => {
        const { port } = httpServer.address() as AddressInfo
        process.env[devOriginEnvName] = `http://${browserHostOf(server.config.server.host)}:${port}`
      })
    },
  }
}
