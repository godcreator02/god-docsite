import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { CollabRejected } from '../errors.js'
import type { Project } from '../project/project.js'
import { lastLinesOf } from './site-files.js'

/** 装完依赖回 pnpm 输出的最后几行 */
export type DependencyInstall = { outputTail: string }

/** 在 site/ 里装依赖；生产里是 pnpmInstall，测试里换成假的 */
export type InstallDependencies = (siteDir: string) => Promise<DependencyInstall>

/** 自动同步要停、要启动的站点；生产里是 CollabSites */
export type SiteControl = {
  /** 站点在运行就先停，做完 work 再按常驻的规矩启动；wasRunning 是装前在不在运行，relaunched 是做完由这一次启动了站点 */
  whileStopped<T>(project: Project, work: (wasRunning: boolean) => Promise<T>): Promise<{ result: T; relaunched: boolean }>
  /** site/ 换了内容之后：站点停着就启动（启动前的检查由 gwb-docsite 在启动时做），已在运行就不动，再把最新的数据推过去 */
  recheck(project: Project): Promise<void>
}

/** 失败时报给人看的 pnpm 输出行数 */
const failureOutputLines = 40

/** 在 siteDir 里运行一条 pnpm 命令；退出码不是 0 就把 pnpm 的原话报出来 */
function runPnpm(siteDir: string, args: string[]): Promise<DependencyInstall> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { cwd: siteDir, shell: true, windowsHide: true })
    let output = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk))
    child.on('error', (error) => reject(new CollabRejected(`pnpm 启动不了：${error.message}`)))
    child.on('close', (code) => {
      if (code === 0) resolve({ outputTail: lastLinesOf(output) })
      else reject(new CollabRejected(`在 ${siteDir} 里运行 pnpm ${args.join(' ')} 失败（退出码 ${String(code)}）：\n${lastLinesOf(output, failureOutputLines)}`))
    })
  })
}

/** 在 siteDir 里运行 pnpm install；退出码不是 0 就把 pnpm 的原话报出来 */
export function pnpmInstall(siteDir: string): Promise<DependencyInstall> {
  if (!existsSync(path.join(siteDir, 'package.json'))) return Promise.reject(new CollabRejected(`${siteDir} 下没有 package.json，装不了依赖`))
  return runPnpm(siteDir, ['install'])
}

/** 站点的类型检查：passed 跑过且通过；no-script 是站点的 package.json 没写 typecheck 脚本，没有跑 */
export type SiteTypecheck = 'passed' | 'no-script'

/** 提交前在 site/ 里跑类型检查；生产里是 pnpmTypecheck，测试里换成假的 */
export type TypecheckSite = (siteDir: string) => Promise<SiteTypecheck>

/** 站点写了 typecheck 脚本就在 site/ 里运行它，没通过就把输出报出来；没写就不跑 */
export async function pnpmTypecheck(siteDir: string): Promise<SiteTypecheck> {
  const packageJson = JSON.parse(await readFile(path.join(siteDir, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  if (packageJson.scripts?.typecheck === undefined) return 'no-script'
  await runPnpm(siteDir, ['run', 'typecheck'])
  return 'passed'
}

/** 在项目的 site/ 里装依赖：站点在运行就先停，装完按常驻的规矩启动；装失败时站点保持停着 */
export async function installSiteDependencies(project: Project, sites: Pick<SiteControl, 'whileStopped'>, install: InstallDependencies): Promise<DependencyInstall & { siteRestarted: boolean }> {
  const { result, relaunched } = await sites.whileStopped(project, async (wasRunning) => {
    try {
      return await install(project.siteDir)
    } catch (error) {
      if (!wasRunning || !(error instanceof CollabRejected)) throw error
      throw new CollabRejected(`${error.message}\n站点已经停了，没有重新启动：依赖装好后用 collab.site.start 再启动`)
    }
  })
  return { outputTail: result.outputTail, siteRestarted: relaunched }
}
