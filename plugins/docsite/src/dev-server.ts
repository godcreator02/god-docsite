import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { identityCodeEnvName } from '@godcreator/docsite-identity/server'
import { feedEndpointPrefix, feedTokenEnvName, feedTokenHeader } from '@godcreator/docsite-feed'
import { DocsiteRejected } from './errors.js'

const ansiEscapePattern = /\x1b\[[0-9;]*[A-Za-z]/g

/** 从开发服务的输出里读出本机地址（`Local:` 那一行）；还没打出来时为 null */
export function localUrlOf(output: string): string | null {
  return /Local:\s+(https?:\/\/\S+)/.exec(output.replace(ansiEscapePattern, ''))?.[1] ?? null
}

/** dev 脚本里写的 --port；没写为 null */
export function devPortOf(devScript: string): number | null {
  const match = /(?:^|\s)--port(?:=|\s+)(\d+)(?=\s|$)/.exec(devScript)
  return match === null ? null : Number(match[1])
}

/** 输出的最后几行，去掉颜色控制符与空行 */
export function lastLinesOf(output: string, lineCount = 10): string {
  return output
    .replace(ansiEscapePattern, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(-lineCount)
    .join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJsonFile(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 站点没在运行时预期的地址：package.json 的 scripts.dev 里写的端口；没有这个文件、没有 dev 脚本或没写端口时为 null */
export function expectedSiteUrlOf(siteDir: string): string | null {
  const file = path.join(siteDir, 'package.json')
  if (!existsSync(file)) return null
  const manifest = readJsonFile(file)
  const dev = isRecord(manifest) && isRecord(manifest['scripts']) ? manifest['scripts']['dev'] : undefined
  if (typeof dev !== 'string') return null
  const port = devPortOf(dev)
  return port === null ? null : `http://127.0.0.1:${port}`
}

/** 一个在运行的开发服务 */
export type DevServer = {
  url: string
  pid: number
  /** 进程退出时调用一次（包括被 stop 停掉），reason 写明退出码与最后几行输出；注册时已经退出了就马上调用 */
  onExit(listener: (reason: string) => void): void
  /** 连同子进程一起停掉 */
  stop(): Promise<void>
  /** 往开发服务的推送通道推一份数据；开发服务回的不是 2xx 就把它的原话报出来 */
  push(channel: string, data: unknown): Promise<void>
}

/** 启动开发服务、交给它身份码，等它报出地址；先退出或超时就抛 DocsiteRejected，写明开发服务的输出。测试里换成假的 */
export type LaunchDevServer = (siteDir: string, identityCode: string) => Promise<DevServer>

/** 等开发服务报出地址的时间：pnpm 启动加上 Vite 第一次预构建依赖 */
const startTimeoutMilliseconds = 60_000
/** 开发服务的输出只留最后这么多字，启动失败或退出时原样报出来 */
const keptOutputLength = 4000
/** taskkill 报了失败之后，再等进程自己退出这么久 */
const exitAfterFailedKillMilliseconds = 3000

/**
 * Windows 上 pnpm 经 cmd 启动，底下还有 node：只停父进程会留下占着端口的开发服务，所以连同子进程一起停。
 * taskkill 逐个停子进程时，有的子进程恰好自己先退出了，它就报「没有运行的实例」、退出码不为 0，其实整棵树已经停了；
 * 所以它报失败时再等一会儿，启动的那个进程退出了就算停掉，没退出才报错
 */
function stopProcessTree(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return Promise.resolve()
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
  return new Promise<void>((resolve, reject) => {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
    let output = ''
    killer.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
    killer.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
    killer.on('error', reject)
    killer.on('close', (code) => {
      if (code === 0) {
        resolve(exited)
        return
      }
      const timer = setTimeout(() => reject(new Error(`taskkill 没能停掉 pid ${String(child.pid)}：${output.trim()}`)), exitAfterFailedKillMilliseconds)
      void exited.then(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  })
}

async function postFeed(siteUrl: string, token: string, channel: string, data: unknown): Promise<void> {
  const response = await fetch(new URL(`${feedEndpointPrefix}/${channel}`, siteUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [feedTokenHeader]: token },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(`开发服务回 ${response.status}：${await response.text()}`)
}

/**
 * 在站点目录里运行 pnpm dev，环境变量交给它身份码与这次启动专用的推送口令，等它在输出里报出地址。
 * 先退出或超时都抛 DocsiteRejected，写明开发服务的输出
 */
export const launchDevServer: LaunchDevServer = (siteDir, identityCode) => {
  const token = randomUUID()
  const child = spawn('pnpm', ['dev'], {
    cwd: siteDir,
    shell: true,
    windowsHide: true,
    env: { ...process.env, [identityCodeEnvName]: identityCode, [feedTokenEnvName]: token },
  })
  let output = ''
  let reportedUrl = false
  return new Promise<DevServer>((resolve, reject) => {
    const fail = (reason: string) => {
      clearTimeout(timer)
      reject(new DocsiteRejected(`${reason}，开发服务的输出：\n${lastLinesOf(output, 30)}`))
    }
    const timer = setTimeout(() => {
      stopProcessTree(child).then(
        () => fail(`开发服务 ${startTimeoutMilliseconds / 1000} 秒内没有报出地址，已停掉`),
        (error: unknown) => fail(`开发服务 ${startTimeoutMilliseconds / 1000} 秒内没有报出地址，停掉时又出错（${String(error)}）`),
      )
    }, startTimeoutMilliseconds)
    const exitReasonOf = () => `开发服务退出了（退出码 ${String(child.exitCode ?? child.signalCode)}），最后的输出：\n${lastLinesOf(output)}`
    const collect = (chunk: string) => {
      output = (output + chunk).slice(-keptOutputLength)
      if (reportedUrl) return
      const url = localUrlOf(output)
      if (url === null) return
      reportedUrl = true
      clearTimeout(timer)
      child.off('exit', onEarlyExit)
      resolve({
        url,
        pid: child.pid!,
        onExit: (listener) => {
          if (child.exitCode !== null || child.signalCode !== null) listener(exitReasonOf())
          else child.once('exit', () => listener(exitReasonOf()))
        },
        stop: () => stopProcessTree(child),
        push: (channel, data) => postFeed(url, token, channel, data),
      })
    }
    const onEarlyExit = (code: number | null) => fail(`开发服务启动后就退出了（退出码 ${String(code)}）`)
    child.stdout.setEncoding('utf8').on('data', collect)
    child.stderr.setEncoding('utf8').on('data', collect)
    child.on('exit', onEarlyExit)
    child.on('error', (error) => fail(`pnpm 启动不了：${error.message}`))
  })
}
