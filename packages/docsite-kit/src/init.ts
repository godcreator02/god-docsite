import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { FeatureRoute, FeatureRoutes } from './feature.js'
import { installedPackageDirOf } from './package-dirs.js'

/**
 * 站点初始化：把站点装着的基础包与各功能包的 template/ 写进站点目录，生成 app/site/。
 * 只在 Node 里用（gwb-docsite 的初始化、骨架的 routes.ts）；装依赖不在这里，由调用方在前后各装一次
 */

const kitPackageName = '@godcreator/docsite-kit'

/** 每份模板里：skeleton/ 每次整份覆盖（app/ 先整个删掉），initial/ 只在站点里还没有时写 */
const skeletonDirName = 'skeleton'
const initialDirName = 'initial'
/** 发布到源上的包不带 .gitignore，模板里写成 gitignore，写进站点时改回来 */
const gitignoreInTemplate = 'gitignore'
/** 初始化生成的文件放在这里，骨架只读它们 */
const generatedDir = 'app/site'

type SiteManifest = { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; docsite?: unknown; [key: string]: unknown }

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** package.json 的 docsite.features：站点用到的功能包的包名 */
export function siteFeaturesOf(manifest: unknown, manifestFile: string): string[] {
  const features = isRecord(manifest) && isRecord(manifest['docsite']) ? manifest['docsite']['features'] : undefined
  if (!Array.isArray(features) || !features.every((each) => typeof each === 'string' && each !== '')) {
    throw new Error(`${manifestFile} 要有 docsite.features：站点用到的功能包的包名列表，没有功能包写 []`)
  }
  return features
}

const devPortPattern = /(--port(?:=|\s+))(\d+)/

/** 模板的 dev 脚本换上站点自己的端口 */
function devScriptWithPort(templateDev: string, siteDev: string | undefined, manifestFile: string): string {
  const port = siteDev === undefined ? undefined : devPortPattern.exec(siteDev)?.[2]
  if (port === undefined) throw new Error(`${manifestFile} 的 scripts.dev 要写 --port <端口>：初始化保留站点自己的端口`)
  return templateDev.replace(devPortPattern, `$1${port}`)
}

/** 模板 package.json 里的脚本与依赖写进站点的：同名的照模板，别的照站点 */
function mergedManifest(site: SiteManifest, template: SiteManifest, manifestFile: string): SiteManifest {
  const scripts = { ...site.scripts, ...template.scripts }
  if (template.scripts?.['dev'] !== undefined) scripts['dev'] = devScriptWithPort(template.scripts['dev'], site.scripts?.['dev'], manifestFile)
  return {
    ...site,
    scripts,
    dependencies: { ...site.dependencies, ...template.dependencies },
    devDependencies: { ...site.devDependencies, ...template.devDependencies },
  }
}

/** 目录下的全部文件，相对这个目录、用正斜杠 */
function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    const relative = prefix === '' ? entry : `${prefix}/${entry}`
    return statSync(full).isDirectory() ? filesUnder(full, relative) : [relative]
  })
}

const siteFileOf = (relative: string) => (relative === gitignoreInTemplate ? '.gitignore' : relative)

/** import 名：包名换成合法的标识符 */
const importNameOf = (index: number) => `feature${index}`

function generatedFiles(features: readonly string[]): Record<string, string> {
  const header = '// 初始化按 package.json 的 docsite.features 生成，不要手改\n'
  const imports = (entry: string) => features.map((name, index) => `import ${importNameOf(index)} from '${name}/${entry}'\n`).join('')
  const list = (exported: string, type: string) =>
    `export const ${exported}: ReadonlyArray<{ name: string } & ${type}> = [${features.map((name, index) => `{ name: '${name}', ...${importNameOf(index)} }`).join(', ')}]\n`
  return {
    'features.ts': `${header}export const siteFeatures: string[] = [${features.map((name) => `'${name}'`).join(', ')}]\n`,
    'routes.ts': `${header}import type { FeatureRoutes } from '@godcreator/docsite-kit/feature'\n${imports('routes')}\n${list('featureRoutes', 'FeatureRoutes')}`,
    'ui.ts': `${header}import type { FeatureSite } from '@godcreator/docsite-kit/feature'\n${imports('site')}\n${list('featureSites', 'FeatureSite')}`,
    'data.server.ts': `${header}import type { FeatureSiteServer } from '@godcreator/docsite-kit/feature'\n${imports('site-server')}\n${list('featureServers', 'FeatureSiteServer')}`,
    'styles.css': `/* 初始化按 package.json 的 docsite.features 生成，不要手改 */\n${features.map((name) => `@import '${name}/styles.css';\n`).join('')}`,
  }
}

export type WrittenSkeleton = {
  /** 站点用到的功能包 */
  features: string[]
  /** package.json 改了（模板带来了新的依赖或版本）：调用方要再装一次依赖 */
  manifestChanged: boolean
}

/**
 * 把站点装着的基础包与 docsite.features 里各功能包的 template/ 写进站点目录：app/ 先整个删掉，
 * 各模板 skeleton/ 里的文件整份覆盖（同一个文件两份模板都有就报错），initial/ 里的顶层条目（文件或整个目录）只在站点里还没有时写；
 * 生成 app/site/；模板的 package.json 合并进站点的（dev 脚本保留站点自己的端口）。
 * 站点目录要有 package.json，里面有 docsite.features 与带 --port 的 scripts.dev，依赖已经装好
 */
export function writeSiteSkeleton(siteDir: string): WrittenSkeleton {
  const manifestFile = path.join(siteDir, 'package.json')
  if (!existsSync(manifestFile)) throw new Error(`${siteDir} 下没有 package.json`)
  const siteManifest = readJson(manifestFile) as SiteManifest
  const features = siteFeaturesOf(siteManifest, manifestFile)
  const templates = [kitPackageName, ...features].map((name) => ({ name, dir: path.join(installedPackageDirOf(siteDir, name), 'template') }))
  const kitTemplate = templates[0]!
  if (!existsSync(kitTemplate.dir)) throw new Error(`${kitPackageName} 里没有 template/：基础包要 0.1.5 以上`)

  rmSync(path.join(siteDir, 'app'), { recursive: true, force: true })
  const writtenBy = new Map<string, string>()
  let manifest = siteManifest
  for (const { name, dir } of templates) {
    const skeletonDir = path.join(dir, skeletonDirName)
    if (existsSync(skeletonDir)) {
      for (const relative of filesUnder(skeletonDir)) {
        if (relative === 'package.json') {
          manifest = mergedManifest(manifest, readJson(path.join(skeletonDir, relative)) as SiteManifest, manifestFile)
          continue
        }
        const target = siteFileOf(relative)
        if (target.startsWith(`${generatedDir}/`)) throw new Error(`${name} 的模板里有 ${target}：${generatedDir}/ 由初始化生成`)
        const earlier = writtenBy.get(target)
        if (earlier !== undefined) throw new Error(`${target} 在 ${earlier} 与 ${name} 的模板里都有：功能包只能添加文件，不能替换`)
        writtenBy.set(target, name)
        mkdirSync(path.dirname(path.join(siteDir, target)), { recursive: true })
        cpSync(path.join(skeletonDir, relative), path.join(siteDir, target))
      }
    }
    const initialDir = path.join(dir, initialDirName)
    if (existsSync(initialDir)) {
      for (const entry of readdirSync(initialDir)) {
        const target = path.join(siteDir, siteFileOf(entry))
        if (!existsSync(target)) cpSync(path.join(initialDir, entry), target, { recursive: true })
      }
    }
  }

  mkdirSync(path.join(siteDir, generatedDir), { recursive: true })
  for (const [file, text] of Object.entries(generatedFiles(features))) writeFileSync(path.join(siteDir, generatedDir, file), text)

  const manifestChanged = JSON.stringify(manifest) !== JSON.stringify(siteManifest)
  if (manifestChanged) writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  return { features, manifestChanged }
}

/**
 * 骨架的 routes.ts 用：功能包给的路由文件（相对包根）换成相对 app/ 的路径。
 * 要用真实路径：pnpm 的 node_modules/<包> 是符号链接，写链接路径时 react-router build 找不到打包出的文件，
 * 也认不出它是路由模块、不剥掉 loader 引用的服务端代码
 */
export function featureRouteFilesOf(appDir: string, features: ReadonlyArray<{ name: string } & FeatureRoutes>): FeatureRoute[] {
  const siteDir = path.dirname(appDir)
  const files = features.flatMap(({ name, routes }) => {
    const packageDir = installedPackageDirOf(siteDir, name)
    return routes.map((route) => {
      const file = path.join(packageDir, route.file)
      if (!existsSync(file)) throw new Error(`${name} 的路由文件 ${route.file} 不在包里`)
      return { ...route, file: path.relative(appDir, file).replaceAll('\\', '/') }
    })
  })
  const indexes = files.filter((each) => 'index' in each)
  if (indexes.length > 1) throw new Error(`首页只能有一个，功能包给了 ${indexes.length} 个：${indexes.map((each) => each.file).join('、')}`)
  return files
}
