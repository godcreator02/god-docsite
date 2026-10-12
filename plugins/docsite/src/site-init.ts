import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { writeSiteSkeleton } from '@godcreator/docsite-kit/init'
import { lastLinesOf, stopProcessTree } from './dev-server.js'
import { DocsiteRejected } from './errors.js'
import type { SiteStarted } from './site-host.js'

const kitPackageName = '@godcreator/docsite-kit'

/** 新站点等待装基础包的时间；再久多半是网络不通 */
const addKitTimeoutMilliseconds = 300_000
/** 装全部依赖的时间 */
const installTimeoutMilliseconds = 600_000

export type SiteInitOptions = {
  /** 站点用到的功能包与版本范围，如 { '@godcreator/collab-site': '^0.31.0' }；给了就换掉 docsite.features 与这几项依赖，不给照站点现有的（服务面给协作站用） */
  features?: Record<string, string>
  /** 新站点的开发端口；已有站点沿用自己 scripts.dev 里的，不能给 */
  port?: number
  /** 新站点的站名（写进 content/meta.json）；已有站点不能给 */
  title?: string
}

/** 测试里换成假的：跑 pnpm 的三样、起服务检查的两样、首页探活、登记表查询 */
export type SiteInitDeps = {
  addKit(dir: string): Promise<void>
  install(dir: string): Promise<void>
  /** 站点登记在工作台设置 sites 里（init 结束时保持运行） */
  isRegistered(dir: string): boolean
  start(dir: string): Promise<SiteStarted>
  stop(dir: string): Promise<{ url: string }>
  /** 起服务检查的探活：回首页的 HTTP 状态码。进程活着不等于站能用（缺依赖时 vite 起得来、页面 500） */
  pageStatus(url: string): Promise<number>
}

export type SiteInitResult = { created: boolean; features: string[] }

type Manifest = Record<string, unknown> & { scripts?: Record<string, string>; dependencies?: Record<string, string>; docsite?: { features?: unknown } }

function readManifest(file: string): Manifest {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Manifest
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

const writeJson = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

/** package.json 的 docsite.features 是不是本插件建的站点的样子（与基础包 init 的校验同一口径） */
function hasSiteFeatures(manifest: Manifest): boolean {
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

/** 装基础包（registry 里已发布的最新版）；装不上多半是网络或 registry 不可达 */
export function pnpmAddKit(dir: string): Promise<void> {
  return pnpmIn(dir, ['add', kitPackageName], addKitTimeoutMilliseconds, `在 ${dir} 里 pnpm add ${kitPackageName}（registry 里装不上这一版，多半是网络不通或 registry 不可达）`)
}

/** 在站点目录里 pnpm install */
export function pnpmInstall(dir: string): Promise<void> {
  return pnpmIn(dir, ['install'], installTimeoutMilliseconds, `${dir} 里 pnpm install`)
}

/**
 * 初始化站点：新站点（目录是空的，或里面只有 package.json）装基础包、写最少的 package.json 等几样，
 * 照装好的基础包与功能包的模板写骨架（./init 的 writeSiteSkeleton），装全部依赖，起服务检查（L-01：得到能直接启动的项目），
 * 检查通过后没登记的站停掉、登记着的保持运行。已有站点做骨架更新：不重装基础包，模板带来新依赖就再装一次。
 * content/、comments/、people.json 已有的不动。调用方负责先停在运行的站点
 */
export async function initSite(dir: string, options: SiteInitOptions, deps: SiteInitDeps): Promise<SiteInitResult> {
  const manifestFile = path.join(dir, 'package.json')
  const existingSite = existsSync(manifestFile) && hasSiteFeatures(readManifest(manifestFile))
  const created = !existingSite
  let features: Record<string, string> | undefined
  if (created) {
    const entries = entriesOf(dir).filter((entry) => entry !== 'package.json')
    if (entries.length > 0) throw new DocsiteRejected(`${dir} 不是空目录，里面已经有别的文件：${entries.join('、')}。初始化只从空目录（或只有 package.json 的目录）建站`)
    if (options.port === undefined || options.title === undefined) throw new DocsiteRejected(`${dir} 是新站点：要给 port（开发端口）与 title（站名）`)
    features = options.features
  } else {
    if (options.port !== undefined || options.title !== undefined) throw new DocsiteRejected(`${dir} 已经是站点：端口照 package.json 的 scripts.dev、站名照 content/meta.json，不能给 port 与 title`)
    features = options.features
  }

  let written
  if (created) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      path.join(dir, 'pnpm-workspace.yaml'),
      "allowBuilds:\n  esbuild: true\nonlyBuiltDependencies:\n  - esbuild\n# 团队的包刚发就要用：@godcreator 的包不受「发布不满一天不装」的限制\nminimumReleaseAgeExclude:\n  - '@godcreator/*'\n",
    )
    await deps.addKit(dir)
    const manifest = existsSync(manifestFile) ? readManifest(manifestFile) : {}
    writeJson(manifestFile, {
      ...manifest,
      private: true,
      type: 'module',
      scripts: { ...manifest.scripts, dev: `react-router dev --port ${options.port} --host 127.0.0.1 --strictPort` },
      dependencies: { ...manifest.dependencies, ...(features ?? {}) },
      docsite: { features: Object.keys(features ?? {}) },
    })
    mkdirSync(path.join(dir, 'content'), { recursive: true })
    writeJson(path.join(dir, 'content', 'meta.json'), { title: options.title, pages: [] })
    writeFileSync(
      path.join(dir, 'content', 'index.mdx'),
      `---\ntitle: ${options.title}\ndescription: 用 docsite.site.init 建的站，从这页开始写\n---\n\n这一页是建站时写的起始页，改掉它或删掉它都行。\n`,
    )
    // 写骨架要读各功能包的 template/：有功能包就先装上（没有时基础包已在 addKit 装好，直接写骨架）
    if (Object.keys(features ?? {}).length > 0) await deps.install(dir)
    written = writeSiteSkeleton(dir)
    await deps.install(dir)
  } else {
    if (features !== undefined) {
      const manifest = readManifest(manifestFile)
      writeJson(manifestFile, { ...manifest, dependencies: { ...manifest.dependencies, ...features }, docsite: { features: Object.keys(features) } })
    }
    written = writeSiteSkeleton(dir)
    if (written.manifestChanged) await deps.install(dir)
  }

  const registered = deps.isRegistered(dir)
  if (created) {
    const started = await deps.start(dir)
    const status = await deps.pageStatus(started.url)
    if (status !== 200) {
      throw new DocsiteRejected(
        `新站点起服务检查没过：首页（${started.url}）返回 ${status}。站点还开着，开发服务的报错在浏览器里看；多半是模板的依赖声明漏了包，修在基础包`,
      )
    }
    if (!registered) await deps.stop(dir)
  } else if (registered) {
    await deps.start(dir)
  }
  return { created, features: written.features }
}
