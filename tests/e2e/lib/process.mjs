import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'

/** 这几个端口上跑着 gwb-docsite 托管的站（docs-site 4340、collab-test 4450 等），e2e 不碰 */
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

const shellOf = (command) => process.platform === 'win32' && command !== process.execPath

function writeCommandLog(logFile, { command, args, cwd, stdout, stderr, exit }) {
  writeFileSync(logFile, `$ ${command} ${args.join(' ')}\n(cwd ${cwd})\n\n${stdout}\n--- stderr ---\n${stderr}\n--- ${exit}\n`)
}

/** 命令的输出整份写进日志文件；退出码不为 0 时报错并指出日志。会挡住事件循环，只在没有服务在跑时用 */
export function runLogged(command, args, { cwd, env = {}, logFile, timeoutMs }) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: shellOf(command),
    maxBuffer: 256 * 1024 * 1024,
  })
  writeCommandLog(logFile, { command, args, cwd, stdout: result.stdout ?? '', stderr: result.stderr ?? '', exit: `exit ${result.status} signal ${result.signal} ${result.error?.message ?? ''}` })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 失败（exit ${result.status}${result.error ? `，${result.error.message}` : ''}），日志 ${logFile}`)
}

/** 同 runLogged，但不挡事件循环：Ctrl+C 能停掉它，超时停掉整棵进程树并报错 */
export function runLoggedAsync(command, args, { cwd, env = {}, logFile, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, shell: shellOf(command), stdio: ['ignore', 'pipe', 'pipe'] })
    liveChildren.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      stopTree(child)
    }, timeoutMs)
    let spawnError
    child.on('error', (error) => (spawnError = error))
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      liveChildren.delete(child)
      const reason = timedOut ? `超时 ${timeoutMs} ms` : spawnError?.message ?? ''
      writeCommandLog(logFile, { command, args, cwd, stdout, stderr, exit: `exit ${code} signal ${signal} ${reason}` })
      if (code === 0 && !timedOut) resolve()
      else reject(new Error(`${command} ${args.join(' ')} 失败（exit ${code}${reason ? `，${reason}` : ''}），日志 ${logFile}`))
    })
  })
}

/** 停掉整棵进程树：Windows 上 node 还会再起子进程（esbuild 等），只停父进程会留下占着端口的孩子 */
function stopTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

/** 还在跑的服务与命令：e2e 自己退出或被中断时一起停掉 */
const liveChildren = new Set()
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of liveChildren) stopTree(child)
    process.exit(130)
  })
}
process.on('exit', () => {
  for (const child of liveChildren) stopTree(child)
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
  liveChildren.add(child)
  return {
    name,
    child,
    logFile,
    output: () => output,
    async stop() {
      stopTree(child)
      await exited
      liveChildren.delete(child)
      await new Promise((resolve) => log.end(resolve))
    },
  }
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
