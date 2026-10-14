import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'

/** 这几个端口上跑着别人托管的站，e2e 不碰 */
const reservedPorts = new Set([4340, 4430, 4450, 4451])

/** 向系统要一个空闲端口（绑 0 再放掉），避开托管站的端口 */
export async function freePort() {
  for (;;) {
    const port = await new Promise((resolve, reject) => {
      const probe = createServer()
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', () => {
        const { port: assigned } = probe.address()
        probe.close(() => resolve(assigned))
      })
    })
    if (!reservedPorts.has(port)) return port
  }
}

/** 命令的输出整份写进日志文件；退出码不为 0 时报错并指出日志 */
export function runLogged(command, args, { cwd, env = {}, logFile, timeoutMs }) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: process.platform === 'win32' && command !== process.execPath,
    maxBuffer: 256 * 1024 * 1024,
  })
  writeFileSync(logFile, `$ ${command} ${args.join(' ')}\n(cwd ${cwd})\n\n${result.stdout ?? ''}\n--- stderr ---\n${result.stderr ?? ''}\n--- exit ${result.status} signal ${result.signal} ${result.error?.message ?? ''}\n`)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 失败（exit ${result.status}${result.error ? `，${result.error.message}` : ''}），日志 ${logFile}`)
}

/** 停掉整棵进程树：Windows 上 node 还会再起子进程（esbuild 等），只停父进程会留下占着端口的孩子 */
function stopTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

const runningServers = new Set()
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const server of runningServers) stopTree(server.child)
    process.exit(130)
  })
}
process.on('exit', () => {
  for (const server of runningServers) stopTree(server.child)
})

/** 在站点目录里用当前的 node 起服务，输出整份写进日志 */
export function startServer({ name, cwd, args, env, logFile }) {
  const log = createWriteStream(logFile)
  log.write(`$ node ${args.join(' ')}\n(cwd ${cwd})\n\n`)
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  const collect = (chunk) => {
    output += chunk.toString()
    log.write(chunk)
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })))
  const server = {
    name,
    child,
    logFile,
    output: () => output,
    async stop() {
      stopTree(child)
      await exited
      runningServers.delete(server)
      await new Promise((resolve) => log.end(resolve))
    },
  }
  runningServers.add(server)
  return server
}

/** 每 0.5 秒请求一次，回了任何 HTTP 响应就算就绪；服务先退出或超时报错 */
export async function waitForHttp(url, { timeoutMs, server }) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) throw new Error(`${server.name} 在就绪前退出（exit ${server.child.exitCode}），日志 ${server.logFile}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      await response.arrayBuffer()
      return response.status
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error(`等 ${url} 就绪超时（${timeoutMs} ms），日志 ${server.logFile}`)
}
