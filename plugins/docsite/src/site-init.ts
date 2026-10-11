import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { writeSiteSkeleton } from '@godcreator/docsite-kit/init'
import { lastLinesOf } from './dev-server.js'
import { DocsiteRejected } from './errors.js'

const kitPackageName = '@godcreator/docsite-kit'

export type SiteInitOptions = {
  /** 站点用到的功能包与版本范围，如 { '@godcreator/collab-site': '^0.31.0' }；给了就换掉 docsite.features 与这几项依赖，不给就照站点现有的 */
  features?: Record<string, string>
  /** 新站点的开发端口；已有站点沿用自己 scripts.dev 里的，不能给 */
  port?: number
  /** 新站点的站名（写进 content/meta.json）；已有站点不能给 */
  title?: string
}

export type SiteInitDeps = {
  /** gwb-docsite 打包时带的基础包版本：站点的基础包依赖写成 ^这一版，装上的一定带模板 */
  kitVersion: string
  install: (dir: string) => Promise<void>
}

export type SiteInitResult = { created: boolean; features: string[] }

type Manifest = Record<string, unknown> & { dependencies?: Record<string, string>; docsite?: { features: string[] } }

function readManifest(file: string): Manifest {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Manifest
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

const writeJson = (file: string, value: unknown) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

/** 新站点要的最少几样：带端口的 dev 脚本、基础包与功能包的依赖、docsite.features，团队的包刚发就能装，站名 */
function createSite(dir: string, features: Record<string, string>, port: number, title: string, kitVersion: string) {
  mkdirSync(dir, { recursive: true })
  writeJson(path.join(dir, 'package.json'), {
    private: true,
    type: 'module',
    scripts: { dev: `react-router dev --port ${port} --host 127.0.0.1 --strictPort` },
    dependencies: { [kitPackageName]: `^${kitVersion}`, ...features },
    docsite: { features: Object.keys(features) },
  })
  writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), "allowBuilds:\n  esbuild: true\nonlyBuiltDependencies:\n  - esbuild\n# 团队的包刚发就要用：@godcreator 的包不受「发布不满一天不装」的限制\nminimumReleaseAgeExclude:\n  - '@godcreator/*'\n")
  mkdirSync(path.join(dir, 'content'), { recursive: true })
  writeJson(path.join(dir, 'content', 'meta.json'), { title, pages: [] })
}

/** 已有站点：基础包依赖写成 ^插件带的那一版，给了功能包就换掉 docsite.features 与那几项依赖 */
function updateSite(manifestFile: string, features: Record<string, string> | undefined, kitVersion: string) {
  const manifest = readManifest(manifestFile)
  const dependencies = { ...manifest.dependencies, [kitPackageName]: `^${kitVersion}`, ...features }
  const docsite = features === undefined ? manifest.docsite : { features: Object.keys(features) }
  writeJson(manifestFile, { ...manifest, dependencies, docsite })
}

/**
 * 初始化站点：新站点先写最少的 package.json 等几样；装依赖，照装好的基础包与功能包的模板写骨架（./init 的 writeSiteSkeleton），
 * 模板带来了新依赖就再装一次。已有站点也是这样更新骨架，content/、comments/、people.json 不动。站点在运行就先停、做完再启动
 */
export async function initSite(dir: string, options: SiteInitOptions, deps: SiteInitDeps, whileStopped: <T>(dir: string, work: () => Promise<T>) => Promise<{ result: T }>): Promise<SiteInitResult> {
  const manifestFile = path.join(dir, 'package.json')
  const created = !existsSync(manifestFile)
  if (created) {
    if (options.port === undefined || options.title === undefined) throw new DocsiteRejected(`${dir} 下没有 package.json，是新站点：要给 port 与 title`)
    createSite(dir, options.features ?? {}, options.port, options.title, deps.kitVersion)
  } else {
    if (options.port !== undefined || options.title !== undefined) throw new DocsiteRejected(`${dir} 已经是站点：端口照 package.json 的 scripts.dev、站名照 content/meta.json，不能给 port 与 title`)
    updateSite(manifestFile, options.features, deps.kitVersion)
  }
  const { result } = await whileStopped(dir, async () => {
    await deps.install(dir)
    let written
    try {
      written = writeSiteSkeleton(dir)
    } catch (error) {
      throw new DocsiteRejected(error instanceof Error ? error.message : String(error))
    }
    if (written.manifestChanged) await deps.install(dir)
    return written.features
  })
  return { created, features: result }
}

/** 在站点目录里 pnpm install；失败就把最后的输出报出来 */
export function pnpmInstall(dir: string): Promise<void> {
  const child = spawn('pnpm', ['install'], { cwd: dir, shell: true, windowsHide: true })
  let output = ''
  const collect = (chunk: string) => (output = (output + chunk).slice(-4000))
  child.stdout.setEncoding('utf8').on('data', collect)
  child.stderr.setEncoding('utf8').on('data', collect)
  return new Promise((resolve, reject) => {
    child.on('error', (error) => reject(new DocsiteRejected(`pnpm 启动不了：${error.message}`)))
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new DocsiteRejected(`${dir} 里 pnpm install 失败（退出码 ${String(code)}）：\n${lastLinesOf(output, 30)}`))))
  })
}
