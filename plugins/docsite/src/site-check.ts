import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { lastLinesOf, stopProcessTree } from './dev-server.js'
import { DocsiteRejected } from './errors.js'
import { packageVisibleFrom, platformPackageName } from './scaffold/platform.js'

/** passed 为 false 时 report 是 docsite-check 列出的每处问题，原话；通过时是它那一行结论 */
export type SiteCheck = { passed: boolean; report: string }

/** 引用扫描冷启动也只要几秒，一分钟没跑完就是卡住了 */
const siteCheckTimeoutMilliseconds = 60_000

const siteCheckBinName = 'docsite-check'

/** 站点自己装的平台包里 docsite-check 的入口文件：用站点那一版的检查，和它 build 时查的一致 */
export function siteCheckEntryOf(siteDir: string): string {
  const installed = packageVisibleFrom(siteDir, platformPackageName)
  if (installed === undefined) throw new DocsiteRejected(`${siteDir} 的 node_modules 里没有 ${platformPackageName}：先在站点目录里 pnpm install`)
  const manifest = JSON.parse(readFileSync(path.join(installed.dir, 'package.json'), 'utf8')) as { bin?: Record<string, unknown> }
  const entry = manifest.bin?.[siteCheckBinName]
  if (typeof entry !== 'string') throw new DocsiteRejected(`${siteDir} 装的 ${platformPackageName} ${installed.version} 没有 ${siteCheckBinName}：先 docsite.site.upgrade 升级站点`)
  return path.join(installed.dir, entry)
}

/**
 * 在站点目录里运行站点自己那一版的 docsite-check（内容放法、shared 站的自包含）。
 * 退出码 0 是通过、1 是有问题，都照常回；别的退出码是检查本身没跑起来，报错带上输出
 */
export async function checkSite(siteDir: string): Promise<SiteCheck> {
  const entry = siteCheckEntryOf(siteDir)
  const child = spawn('node', [entry], { cwd: siteDir, windowsHide: true })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const timedOut = `${siteDir} 的 ${siteCheckBinName} ${siteCheckTimeoutMilliseconds / 1000} 秒没跑完`
      stopProcessTree(child).then(
        () => reject(new DocsiteRejected(`${timedOut}，已停掉。输出：\n${lastLinesOf(stdout + stderr, 30)}`)),
        (error: unknown) => reject(new DocsiteRejected(`${timedOut}，停掉时又出错（${String(error)}）`)),
      )
    }, siteCheckTimeoutMilliseconds)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new DocsiteRejected(`node 启动不了：${error.message}`))
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve({ passed: true, report: stdout.trim() })
      else if (code === 1) resolve({ passed: false, report: stderr.trim() })
      else reject(new DocsiteRejected(`${siteDir} 的 ${siteCheckBinName} 没跑起来（退出码 ${String(code)}）。输出：\n${lastLinesOf(stdout + stderr, 30)}`))
    })
  })
}
