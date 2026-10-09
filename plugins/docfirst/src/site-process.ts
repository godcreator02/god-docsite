import { execFile, spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

/**
 * 托管站点用到的子进程：在站目录里运行 `pnpm build` 与 `pnpm start`，停的时候连同子进程一起停。
 * 子进程只在这个文件里启动（`tests/artifact.test.ts` 检查）
 */

const BUILD_TIMEOUT_MS = 10 * 60_000
const READY_TIMEOUT_MS = 60_000
const READY_POLL_MS = 500
const KILL_TIMEOUT_MS = 15_000
/** 报错里带上输出的最后这么多行 */
const OUTPUT_TAIL_LINES = 40

/** 一个在运行的 `pnpm start` */
export interface RunningServer {
  readonly pid: number
  /** 连同子进程一起停；等它退出再返回 */
  stop(): Promise<void>
  /** 不是 stop 停的退出（崩了、被别的程序杀了）时调一次 */
  onUnexpectedExit(listener: (reason: string) => void): void
}

/** 托管逻辑只认这两个动作；测试换成假的 */
export interface SiteRunner {
  build(dir: string): Promise<void>
  start(dir: string, port: number): Promise<RunningServer>
  portInUse(port: number): Promise<boolean>
}

/** Windows 上 pnpm 是 .cmd，不能直接当可执行文件启动，经 cmd.exe 启动 */
function pnpmCommand(script: string): [string, string[]] {
  return process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'pnpm', script]] : ['pnpm', [script]]
}

/** 只留输出的最后几行，报错时带上 */
class OutputTail {
  private lines: string[] = []

  push(chunk: Buffer | string): void {
    this.lines.push(...String(chunk).split(/\r?\n/).filter((line) => line.trim() !== ''))
    if (this.lines.length > OUTPUT_TAIL_LINES) this.lines = this.lines.slice(-OUTPUT_TAIL_LINES)
  }

  text(): string {
    return this.lines.length === 0 ? '（没有输出）' : this.lines.join('\n')
  }
}

function spawnPnpm(dir: string, script: string, tail: OutputTail): ChildProcess {
  const [file, args] = pnpmCommand(script)
  const child = spawn(file, args, { cwd: dir, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout?.on('data', (chunk: Buffer) => tail.push(chunk))
  child.stderr?.on('data', (chunk: Buffer) => tail.push(chunk))
  return child
}

/** 停掉整棵进程树：cmd.exe → pnpm → next，只杀最外层会留下占着端口的 next */
function killTree(child: ChildProcess): Promise<void> {
  const pid = child.pid
  if (pid === undefined || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: KILL_TIMEOUT_MS, windowsHide: true }, () => undefined)
  } else {
    process.kill(-pid, 'SIGTERM')
  }
  return Promise.race([
    exited,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error(`进程 ${String(pid)} 过了 ${String(KILL_TIMEOUT_MS / 1000)} 秒还没退出`)), KILL_TIMEOUT_MS)),
  ])
}

function connects(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

function build(dir: string): Promise<void> {
  const tail = new OutputTail()
  const child = spawnPnpm(dir, 'build', tail)
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const timedOut = `pnpm build 过了 ${String(BUILD_TIMEOUT_MS / 60_000)} 分钟没完成`
      killTree(child).then(
        () => reject(new Error(`${timedOut}，已停掉。输出的最后几行：\n${tail.text()}`)),
        (killError: unknown) => reject(new Error(`${timedOut}，也没能停掉：${killError instanceof Error ? killError.message : String(killError)}`)),
      )
    }, BUILD_TIMEOUT_MS)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(new Error(`pnpm build 没能启动：${error.message}`, { cause: error }))
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`pnpm build 失败（退出码 ${String(code)}）。输出的最后几行：\n${tail.text()}`))
    })
  })
}

/** 启动 `pnpm start`，等端口连得上才算起来；先退出或超时就停掉、报错带上输出 */
async function start(dir: string, port: number): Promise<RunningServer> {
  const tail = new OutputTail()
  const child = spawnPnpm(dir, 'start', tail)
  let stopping = false
  let exitReason: string | null = null
  const exitListeners: ((reason: string) => void)[] = []
  child.once('error', (error) => {
    exitReason = `pnpm start 没能启动：${error.message}`
  })
  child.once('exit', (code, signal) => {
    exitReason = `pnpm start 退出了（${signal === null ? `退出码 ${String(code)}` : `信号 ${signal}`}）。输出的最后几行：\n${tail.text()}`
    if (!stopping) for (const listener of exitListeners) listener(exitReason)
  })

  const deadline = Date.now() + READY_TIMEOUT_MS
  while (!(await connects(port))) {
    if (exitReason !== null) throw new Error(exitReason)
    if (Date.now() > deadline) {
      stopping = true
      await killTree(child)
      throw new Error(`pnpm start 过了 ${String(READY_TIMEOUT_MS / 1000)} 秒端口 ${String(port)} 还连不上，已停掉。输出的最后几行：\n${tail.text()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS))
  }

  return {
    pid: child.pid!,
    stop: async () => {
      stopping = true
      await killTree(child)
    },
    onUnexpectedExit: (listener) => {
      exitListeners.push(listener)
    },
  }
}

export const nodeSiteRunner: SiteRunner = { build, start, portInUse: connects }
