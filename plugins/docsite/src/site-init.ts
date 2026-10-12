import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleSite, type FeatureTemplate } from './scaffold/assemble.js'
import { scaffoldKitVersions } from './scaffold/versions.js'
import { writeSiteFiles } from './scaffold/write.js'
import { lastLinesOf, stopProcessTree } from './dev-server.js'
import { DocsiteRejected } from './errors.js'
import type { SiteStarted } from './site-host.js'

/** 插件自带的骨架模板目录：从自述站派生（scripts/sync-template.mjs），随插件发布 */
export const kitTemplateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template')

/** 装全部依赖的时间 */
const installTimeoutMilliseconds = 600_000

export type SiteInitOptions = {
  /** 站点用到的功能包与版本范围，如 { '@godcreator/collab-site': '^0.31.0' }（服务面给协作站、docfirst 用）；不给就是没有功能包的站 */
  features?: Record<string, string>
  /** 开发端口，写进 scripts.dev；必给 */
  port: number
  /** 站名（写进 content/meta.json）；必给 */
  title: string
}

/** 测试里换成假的：拉功能包模板、跑 pnpm、起服务检查、首页探活、登记表查询 */
export type SiteInitDeps = {
  fetchFeatureTemplate(name: string, versionRange: string): Promise<FeatureTemplate & { rootDir: string }>
  install(dir: string): Promise<void>
  /** 站点登记在工作台设置 sites 里（探活通过后保持运行） */
  isRegistered(dir: string): boolean
  start(dir: string): Promise<SiteStarted>
  stop(dir: string): Promise<{ url: string }>
  /** 起服务检查的探活：回首页的 HTTP 状态码。进程活着不等于站能用（缺依赖时 vite 起得来、页面 500） */
  pageStatus(url: string): Promise<number>
}

export type SiteInitResult = { created: boolean; features: string[] }

type Manifest = Record<string, unknown> & { name?: string; docsite?: { features?: unknown } }

function readManifest(file: string): Manifest {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Manifest
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** package.json 的 docsite.features 是不是本插件建的站点的样子：是就把 init 拒掉（骨架归站点，重建删目录再来） */
function isExistingSite(manifest: Manifest): boolean {
  const features = manifest.docsite?.features
  return Array.isArray(features) && features.every((each) => typeof each === 'string' && each !== '')
}

/** 目录里的条目，目录不在算空 */
function entriesOf(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** 在站点目录里跑一条 pnpm 命令，等它退出；超时就停掉整棵进程，失败把最后的输出原样报出来 */
function pnpmIn(dir: string, args: string[], timeoutMilliseconds: number, doing: string): Promise<void> {
  const child = spawn('pnpm', args, { cwd: dir, shell: true, windowsHide: true })
  let output = ''
  const collect = (chunk: string) => (output = (output + chunk).slice(-4000))
  child.stdout.setEncoding('utf8').on('data', collect)
  child.stderr.setEncoding('utf8').on('data', collect)
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const fail = (error: DocsiteRejected) => {
      if (timer !== undefined) clearTimeout(timer)
      reject(error)
    }
    timer = setTimeout(() => {
      stopProcessTree(child).then(
        () => fail(new DocsiteRejected(`${doing} ${timeoutMilliseconds / 1000} 秒没做完，已停掉。输出：\n${lastLinesOf(output, 30)}`)),
        (stopError: unknown) => fail(new DocsiteRejected(`${doing} ${timeoutMilliseconds / 1000} 秒没做完，停掉时又出错（${String(stopError)}）。输出：\n${lastLinesOf(output, 30)}`)),
      )
    }, timeoutMilliseconds)
    child.on('error', (error) => fail(new DocsiteRejected(`pnpm 启动不了：${error.message}`)))
    child.on('exit', (code) => {
      if (code === 0) {
        if (timer !== undefined) clearTimeout(timer)
        resolve()
        return
      }
      fail(new DocsiteRejected(`${doing}失败（退出码 ${String(code)}）。输出：\n${lastLinesOf(output, 30)}`))
    })
  })
}

/** 在站点目录里 pnpm install */
export function pnpmInstall(dir: string): Promise<void> {
  return pnpmIn(dir, ['install'], installTimeoutMilliseconds, `${dir} 里 pnpm install`)
}

/**
 * 从零建站（L-01：得到能直接启动的项目）：拉功能包模板 → 在内存里组装整棵站点树（骨架模板 + 功能包模板 +
 * 按 docsite.features 生成的 app/site/ + workspace 替换成精确版本的 package.json）→ 一次写盘 → 一次
 * pnpm install → 起服务检查首页。检查通过后登记进设置 sites 的站保持运行、没登记的停掉。
 * 骨架写完就归站点，没有更新已有站骨架的通道：要重建删掉目录再来
 */
export async function initSite(dir: string, options: SiteInitOptions, deps: SiteInitDeps): Promise<SiteInitResult> {
  const manifestFile = path.join(dir, 'package.json')
  if (existsSync(manifestFile) && isExistingSite(readManifest(manifestFile))) {
    throw new DocsiteRejected(`${dir} 已经是站点：骨架建完就归站点，没有重写它的命令。要重建就删掉目录再来（content/、comments/、people.json 想留先拷走）`)
  }
  const entries = entriesOf(dir).filter((entry) => entry !== 'package.json')
  if (entries.length > 0) throw new DocsiteRejected(`${dir} 不是空目录，里面已经有别的文件：${entries.join('、')}。建站只从空目录（或只有 package.json 的目录）开始`)
  if (options.port === undefined || options.title === undefined) throw new DocsiteRejected(`${dir} 是新站点：要给 port（开发端口）与 title（站名）`)

  const features = options.features ?? {}
  const fetched: Array<FeatureTemplate & { rootDir: string }> = []
  try {
    for (const [name, versionRange] of Object.entries(features)) fetched.push(await deps.fetchFeatureTemplate(name, versionRange))
    const existingManifest = existsSync(manifestFile) ? readManifest(manifestFile) : {}
    const planned = assembleSite({
      kitTemplateDir,
      features: fetched,
      siteName: typeof existingManifest.name === 'string' && existingManifest.name !== '' ? existingManifest.name : path.basename(dir),
      port: options.port,
      title: options.title,
      versions: scaffoldKitVersions,
    })
    writeSiteFiles(dir, planned)
    await deps.install(dir)
  } finally {
    for (const each of fetched) rmSync(each.rootDir, { recursive: true, force: true })
  }

  const started = await deps.start(dir)
  const status = await deps.pageStatus(started.url)
  if (status !== 200) {
    throw new DocsiteRejected(
      `新站点起服务检查没过：首页（${started.url}）返回 ${status}。站点还开着，开发服务的报错在浏览器里看；多半是骨架模板的依赖声明漏了包，修在自述站（骨架的正本）`,
    )
  }
  if (!deps.isRegistered(dir)) await deps.stop(dir)
  return { created: true, features: fetched.map((each) => each.name) }
}
