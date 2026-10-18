import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { DocsiteRejected } from './errors.js'

/** Chrome 在 Windows 上的安装位置：给所有用户装的 64 位、32 位，只给当前用户装的 */
export function chromeCandidatesOf(env: NodeJS.ProcessEnv): string[] {
  return [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]
    .filter((dir): dir is string => dir !== undefined && dir !== '')
    .map((dir) => path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'))
}

export function findChrome(candidates: string[], exists: (file: string) => boolean = existsSync): string {
  const found = candidates.find((candidate) => exists(candidate))
  if (found === undefined) throw new DocsiteRejected(`没找到 Chrome（找过 ${candidates.join('、')}）：站点用 Chrome 的应用窗口打开，先装上 Chrome`)
  return found
}

/** Chrome 已经开着时，新进程把地址交给已有的那个就退出，所以只等进程起来，不等它结束；新开的窗口自己在前台 */
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

/**
 * 找这个站点已经开着的应用窗口，找到就恢复、切到前台。窗口按应用身份与标题（站名，或「页面名 · 站名」）认：
 * 标题在窗口外框上，窗口被别的窗口盖住、最小化时都读得到。页面还没加载出来时标题还不是站名，所以只用来找开着的窗口，不等刚启动的窗口
 */
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

/** focused：切到了已经开着的窗口；launched：新开了一个 */
export type SiteWindowOpened = 'focused' | 'launched'

/**
 * 每个站点只用一个应用窗口：开着就切到前台（最小化的先恢复），没有才启动。同一站点同时点几次共用一次打开。
 * 站点没写站名时认不出窗口，直接启动
 */
export function chromeAppOpener(
  focus: (chrome: string, url: string, siteTitle: string) => Promise<boolean>,
  launch: (chrome: string, url: string) => Promise<void>,
): (chrome: string, url: string, siteTitle: string | null) => Promise<SiteWindowOpened> {
  const opening = new Map<string, Promise<SiteWindowOpened>>()
  return (chrome, url, siteTitle) => {
    const key = new URL(url).origin
    const pending = opening.get(key)
    if (pending !== undefined) return pending
    const result = (async (): Promise<SiteWindowOpened> => {
      if (siteTitle !== null && (await focus(chrome, url, siteTitle))) return 'focused'
      await launch(chrome, url)
      return 'launched'
    })().finally(() => opening.delete(key))
    opening.set(key, result)
    return result
  }
}

export const openInChromeApp = chromeAppOpener(focusChromeApp, launchChromeApp)
