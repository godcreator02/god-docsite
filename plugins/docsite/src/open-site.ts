import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { DocsiteRejected } from './errors.js'

/**
 * 设置 site-window 的取值：chrome-app 用 Chrome 的应用窗口打开（独立窗口，没有标签栏和地址栏，任务栏上单独一个图标）；
 * default-browser 在系统默认浏览器里开新标签页
 */
export const siteWindowModes = ['chrome-app', 'default-browser'] as const
export type SiteWindowMode = (typeof siteWindowModes)[number]

export function siteWindowModeOf(value: unknown): SiteWindowMode {
  const mode = siteWindowModes.find((each) => each === value)
  if (mode === undefined) throw new DocsiteRejected(`设置 site-window 只能是 ${siteWindowModes.join(' / ')}，读到 ${JSON.stringify(value)}`)
  return mode
}

/** Chrome 在 Windows 上的安装位置：给所有用户装的 64 位、32 位，只给当前用户装的 */
export function chromeCandidatesOf(env: NodeJS.ProcessEnv): string[] {
  return [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]
    .filter((dir): dir is string => dir !== undefined && dir !== '')
    .map((dir) => path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'))
}

export function findChrome(candidates: string[], exists: (file: string) => boolean = existsSync): string {
  const found = candidates.find((candidate) => exists(candidate))
  if (found === undefined) throw new DocsiteRejected(`没找到 Chrome（找过 ${candidates.join('、')}）：装上 Chrome，或在 gwb 设置里把 gwb-docsite 的 site-window 改成 default-browser`)
  return found
}

/** Chrome 已经开着时，新进程把地址交给已有的那个就退出，所以只等进程起来，不等它结束 */
function launchChromeApp(chrome: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, [`--app=${url}`], { detached: true, stdio: 'ignore' })
    child.once('error', (error) => reject(new DocsiteRejected(`用 ${chrome} 打开 ${url} 失败：${error.message}`)))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

const runFile = promisify(execFile)

/** Chrome 的应用窗口身份只带主机与路径、不带端口；同一主机上几个站点靠窗口标题里的站名分开 */
export function chromeAppIdOf(url: string): string {
  const parsed = new URL(url)
  return `Chrome.${parsed.hostname}_${parsed.pathname}`
}

/** 找这个站点已经开着的应用窗口，找到就恢复、切到前台。窗口按应用身份与标题里的站名认 */
async function focusChromeApp(chrome: string, url: string, siteTitle: string): Promise<boolean> {
  const { stdout } = await runFile(
    'pwsh',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('./chrome-window.ps1', import.meta.url)), '-ChromePath', path.resolve(chrome), '-SiteTitle', siteTitle, '-AppId', chromeAppIdOf(url)],
    { windowsHide: true, timeout: 20_000 },
  )
  const reply = JSON.parse(stdout) as { found: boolean; focused: boolean }
  if (reply.found && !reply.focused) throw new DocsiteRejected('站点窗口已经打开，但 Windows 没有允许切到前台；没有重复打开')
  return reply.found
}

/** 每个站点只用一个应用窗口：开着就切到前台（最小化的先恢复），没有才启动。同一站点同时点几次共用一次打开 */
export function chromeAppOpener(
  focus: (chrome: string, url: string, siteTitle: string) => Promise<boolean>,
  launch: (chrome: string, url: string) => Promise<void>,
): (chrome: string, url: string, siteTitle: string | null) => Promise<void> {
  const opening = new Map<string, Promise<void>>()
  return (chrome, url, siteTitle) => {
    const key = new URL(url).origin
    const pending = opening.get(key)
    if (pending !== undefined) return pending
    const result = (async () => {
      if (siteTitle !== null && (await focus(chrome, url, siteTitle))) return
      await launch(chrome, url)
    })().finally(() => opening.delete(key))
    opening.set(key, result)
    return result
  }
}

export const openInChromeApp = chromeAppOpener(focusChromeApp, launchChromeApp)
