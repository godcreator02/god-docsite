/**
 * 样本的 HTTP 驱动：把 Node 的请求转成 Web Request 调资源路由（loader/action），
 * 再把 Response 写回——React Router 框架模式下这层由它的适配器做，样本自己实现最小版。
 * 身份码、people 目录、可信 origin（就是监听地址）都在启动时确定，不由请求决定
 */
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { identityCodeEnvName } from '@probe/identity/server'
import { createSampleRoutes, type SampleHost } from './routes.js'

const require = createRequire(import.meta.url)

export type StartedSampleServer = { server: Server; origin: string; port: number; host: string }

async function requestOfNode(req: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item)
  }
  const method = req.method ?? 'GET'
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = chunks.length > 0 && method !== 'GET' && method !== 'HEAD' ? Buffer.concat(chunks) : undefined
  return new Request(`${origin}${req.url ?? '/'}`, { method, headers, body })
}

async function respondOfNode(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(new Uint8Array(await response.arrayBuffer()))
}

function cssResponse(css: string): Response {
  return new Response(css, { headers: { 'content-type': 'text/css; charset=utf-8' } })
}

async function handle(req: IncomingMessage, res: ServerResponse, origin: string, routes: ReturnType<typeof createSampleRoutes>, siteDir: string): Promise<void> {
  const url = new URL(req.url ?? '/', origin)
  const request = await requestOfNode(req, origin)
  if (req.method === 'GET' && url.pathname === '/') return await respondOfNode(res, await routes.loader({ request }))
  if (req.method === 'POST' && url.pathname === '/comments') return await respondOfNode(res, await routes.action({ request }))
  if (req.method === 'GET' && url.pathname === '/identity.css') return await respondOfNode(res, cssResponse(await readFile(require.resolve('@probe/identity/styles.css'), 'utf8')))
  if (req.method === 'GET' && url.pathname === '/sample.css') return await respondOfNode(res, cssResponse(await readFile(path.join(siteDir, 'extra.css'), 'utf8')))
  return await respondOfNode(res, new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }))
}

/**
 * 起一个样本服务：identityCode 给了就是可写宿主，不给就是只读宿主。
 * port 传 0（或不传）时由系统分配，实际地址看返回值的 origin
 */
export async function startIdentitySampleServer(options: { port?: number; host?: string; identityCode?: string; siteDir?: string }): Promise<StartedSampleServer> {
  const host = options.host ?? '127.0.0.1'
  const siteDir = options.siteDir ?? defaultSampleDir()
  const server = createServer()
  const port = await new Promise<number>((resolve, reject) => {
    server.once('listening', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') return reject(new Error(`监听 ${host}:${options.port ?? 0} 拿不到端口：${String(address)}`))
      resolve(address.port)
    })
    server.once('error', reject)
    server.listen(options.port ?? 0, host)
  })
  const origin = `http://${host}:${port}`
  const state: SampleHost = { siteDir, trustedOrigin: origin, identityCode: options.identityCode, comments: [] }
  const routes = createSampleRoutes(state)
  server.on('request', (req, res) => {
    void handle(req, res, origin, routes, siteDir).catch(() => {
      // 路由已把身份与业务错误转成 Response；到这里的是服务端错误，只回状态不回细节
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('server error')
    })
  })
  return { server, origin, port, host }
}

/** 样本根目录（people.json、extra.css 所在）：构建产物在 sample/dist，根是它的上一级 */
function defaultSampleDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}

function cliArgValue(name: string): string | undefined {
  const argv = process.argv.slice(2)
  const at = argv.indexOf(`--${name}`)
  return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : undefined
}

const isCliMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isCliMain) {
  const identityCode = cliArgValue('identity-code') ?? process.env[identityCodeEnvName]
  const port = Number(cliArgValue('port') ?? 5490)
  const host = cliArgValue('host') ?? '127.0.0.1'
  const started = await startIdentitySampleServer({ port, host, identityCode })
  console.log(`身份边界样本：${started.origin}（${identityCode ? '有身份码，可写' : '没有身份码，只读'}）`)
}
