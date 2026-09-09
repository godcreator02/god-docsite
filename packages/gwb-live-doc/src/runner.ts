import { spawn, type ChildProcess } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'
import type { Log, Proc, RunnerDeps } from './manager.js'

/**
 * 起进程、探端口、杀进程树。真机器的那半，自 vscode-docs-site 的 runner.ts 搬来。
 *
 * 用 child_process 不用终端：要能杀、要能拿退出码。Windows 上 pnpm 是 .cmd，得 shell:true，
 * 于是子进程的 pid 是 cmd.exe——只 kill 它会留一个占着端口的 node 孤儿，所以关必须杀整棵树
 * （taskkill /T）。**命令拼成单条字符串**再交给 shell：args 数组 + shell:true 会吃 DEP0190 告警。
 */

/** 让系统挑一个空闲端口：listen(0) 拿到号就关 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0
      server.close(() => (port > 0 ? resolve(port) : reject(new Error('拿不到空闲端口'))))
    })
  })
}

/** 这个端口上有 HTTP 在应答吗（任何状态码都算） */
export function portResponds(port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: timeoutMs }, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

/** pid 还活着吗 */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function pipeLogs(child: ChildProcess, log: Log): void {
  const feed = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) if (line !== '') log(line)
  }
  child.stdout?.on('data', feed)
  child.stderr?.on('data', feed)
}

function spawnPnpm(commandLine: string, cwd: string): ChildProcess {
  return spawn(commandLine, {
    cwd,
    shell: true,
    windowsHide: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** `pnpm run build`，跑完（退出码 0）才算成 */
export function runBuild(siteDir: string, log: Log): { child: ChildProcess; done: Promise<void> } {
  const child = spawnPnpm('pnpm run build', siteDir)
  pipeLogs(child, log)
  const done = new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build 退出码 ${String(code)}`))))
  })
  return { child, done }
}

/**
 * `pnpm exec next start -p <port>`：不走 `pnpm run start`，那条脚本里多半写死了 -p。
 * ready 在端口开始应答时兑现；进程先退了就拒绝；60 秒没应答也拒绝。
 */
export function startServer(siteDir: string, port: number, log: Log): { child: ChildProcess; ready: Promise<void> } {
  const child = spawnPnpm(`pnpm exec next start -p ${String(port)}`, siteDir)
  pipeLogs(child, log)
  const ready = new Promise<void>((resolve, reject) => {
    let settled = false
    child.once('error', (err) => {
      settled = true
      reject(err)
    })
    child.once('exit', (code) => {
      if (!settled) {
        settled = true
        reject(new Error(`next start 还没就绪就退了（退出码 ${String(code)}）`))
      }
    })
    const started = Date.now()
    const poll = (): void => {
      if (settled) return
      void portResponds(port, 800).then((ok) => {
        if (settled) return
        if (ok) {
          settled = true
          resolve()
        } else if (Date.now() - started > 60_000) {
          settled = true
          reject(new Error('60 秒内端口没应答'))
        } else setTimeout(poll, 500)
      })
    }
    setTimeout(poll, 500)
  })
  return { child, ready }
}

/** 杀整棵进程树。Windows 走 taskkill /T /F；其余平台先 TERM 组再 KILL */
export function killTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      k.once('exit', () => resolve())
      k.once('error', () => resolve())
      return
    }
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // 已经不在了
      }
    }
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // 已经不在了
      }
      resolve()
    }, 1500)
  })
}

function procOf(child: ChildProcess): Proc {
  return {
    pid: child.pid,
    exited: new Promise((resolve) => {
      child.once('exit', (code) => resolve(code))
      child.once('error', () => resolve(null))
    }),
  }
}

/** 状态机要的那五样，真机版 */
export function realRunnerDeps(): RunnerDeps {
  return {
    freePort,
    build: (dir, log) => {
      const { child, done } = runBuild(dir, log)
      return { proc: procOf(child), done }
    },
    serve: (dir, port, log) => {
      const { child, ready } = startServer(dir, port, log)
      return { proc: procOf(child), ready }
    },
    killTree,
    now: () => Date.now(),
  }
}
