import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { DocsiteRejected } from '../errors.js'

/**
 * 建站组装器：把骨架模板（插件自带，从自述站派生）与各功能包的模板在内存里合成一棵站点文件树，
 * 交 writeSiteFiles 一次写盘。纯函数，不碰磁盘上的站点目录
 */

/** 派生好的骨架模板目录（插件自带的 template/，布局与站点根一致：app/、根目录的配置、gitignore、package.json、initial/） */
export type KitTemplateDir = string

/** 从 registry 拉来的功能包模板：tarball 解出的包根（内含 template/ 与 package.json）与解析出的精确版本 */
export type FeatureTemplate = {
  name: string
  version: string
  /** tarball 解出的包根 */
  dir: string
  /** 功能包的 package.json：看 exports 里有没有 ./content */
  manifest: unknown
}

export type PlannedFile = {
  /** 写进站点的相对路径，正斜杠，.gitignore 已是最终名 */
  relativePath: string
  content: string
}

type Manifest = {
  name?: string
  version?: string
  description?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  exports?: unknown
  [key: string]: unknown
}

function readJson(file: string): Manifest {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Manifest
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 目录下的全部文件，相对这个目录、用正斜杠 */
function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    const relative = prefix === '' ? entry : `${prefix}/${entry}`
    return statSync(full).isDirectory() ? filesUnder(full, relative) : [relative]
  })
}

const generatedDir = 'app/site'
const initialDirName = 'initial'
/** 模板里的 gitignore 写进站点时改回 .gitignore（npm 发布不带点开头的文件） */
const gitignoreInTemplate = 'gitignore'
const siteFileOf = (relative: string) => (relative === gitignoreInTemplate ? '.gitignore' : relative)

const devPortPattern = /(--port(?:=|\s+))(\d+)/

/** import 名：包名换成合法的标识符 */
const importNameOf = (index: number) => `feature${index}`

/** 功能包可以没有的出口 */
const contentExport = './content'

/** 功能包的 package.json 的 exports 里有没有 ./content */
function exportsContent(manifest: unknown): boolean {
  return isRecord(manifest) && isRecord(manifest['exports']) && contentExport in manifest['exports']
}

/** 按 docsite.features 生成的 app/site/：骨架只读这几个文件，功能包不改骨架任何文件 */
function generatedFiles(features: readonly string[], contentFeatures: readonly string[]): Record<string, string> {
  const header = '// 建站时按 package.json 的 docsite.features 生成，不要手改\n'
  const imports = (entry: string, names = features) => names.map((name, index) => `import ${importNameOf(index)} from '${name}/${entry}'\n`).join('')
  const list = (exported: string, type: string, names = features) =>
    `export const ${exported}: ReadonlyArray<{ name: string } & ${type}> = [${names.map((name, index) => `{ name: '${name}', ...${importNameOf(index)} }`).join(', ')}]\n`
  return {
    'content.ts': `${header}import type { FeatureContent } from '@godcreator/docsite-kit/feature'\n${imports('content', contentFeatures)}\n${list('featureContents', 'FeatureContent', contentFeatures)}`,
    'features.ts': `${header}export const siteFeatures: string[] = [${features.map((name) => `'${name}'`).join(', ')}]\n`,
    'routes.ts': `${header}import type { FeatureRoutes } from '@godcreator/docsite-kit/feature'\n${imports('routes')}\n${list('featureRoutes', 'FeatureRoutes')}`,
    'ui.ts': `${header}import type { FeatureSite } from '@godcreator/docsite-kit/feature'\n${imports('site')}\n${list('featureSites', 'FeatureSite')}`,
    'data.server.ts': `${header}import type { FeatureSiteServer } from '@godcreator/docsite-kit/feature'\n${imports('site-server')}\n${list('featureServers', 'FeatureSiteServer')}`,
    'styles.css': `/* 建站时按 package.json 的 docsite.features 生成，不要手改 */\n${features.map((name) => `@import '${name}/styles.css';\n`).join('')}`,
  }
}

/** 模板 package.json 里的 workspace:* 换成版本表里的精确版本；表里没有就报错（发插件时版本表漏了一项） */
function resolvedDependencies(deps: Record<string, string> | undefined, versions: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const [name, range] of Object.entries(deps ?? {})) {
    if (range.startsWith('workspace:')) {
      const version = versions[name]
      if (version === undefined) throw new DocsiteRejected(`骨架模板的依赖 ${name} 写着 ${range}，版本表里没有它：发插件前把它的精确版本补进 scaffoldKitVersions`)
      resolved[name] = version
    } else {
      resolved[name] = range
    }
  }
  return resolved
}

export type AssembleInput = {
  /** 插件自带的骨架模板目录 */
  kitTemplateDir: KitTemplateDir
  /** 已从 registry 拉来的功能包模板 */
  features: readonly FeatureTemplate[]
  /** 站点名（package.json 的 name；目标目录里已有 package.json 时用它的） */
  siteName: string
  /** 开发端口，写进 scripts.dev */
  port: number
  /** 站名，写进 content/meta.json 与起始页 */
  title: string
  /** @godcreator 系包的精确版本表（scaffoldKitVersions） */
  versions: Record<string, string>
}

/** 合成整棵站点文件树：骨架 + 功能包模板 + 生成的 app/site/ + 起始内容 + package.json */
export function assembleSite(input: AssembleInput): PlannedFile[] {
  const files: PlannedFile[] = []
  const writtenBy = new Map<string, string>()
  const addFile = (owner: string, relativePath: string, content: string): void => {
    const earlier = writtenBy.get(relativePath)
    if (earlier !== undefined) throw new DocsiteRejected(`${relativePath} 在 ${earlier} 与 ${owner} 的模板里都有：功能包只能添加文件，不能替换`)
    if (relativePath.startsWith(`${generatedDir}/`)) throw new DocsiteRejected(`${owner} 的模板里有 ${relativePath}：${generatedDir}/ 由建站时生成`)
    writtenBy.set(relativePath, owner)
    files.push({ relativePath, content })
  }
  const addFilesUnder = (owner: string, dir: string, targetPrefix: string): void => {
    for (const relative of filesUnder(dir)) {
      const target = targetPrefix === '' ? siteFileOf(relative) : `${targetPrefix}/${relative}`
      addFile(owner, target, readFileSync(path.join(dir, relative), 'utf8'))
    }
  }

  // 骨架模板：app/ 与根目录的配置；package.json 单独合成，initial/ 是起始物
  const kitManifest = readJson(path.join(input.kitTemplateDir, 'package.json'))
  for (const relative of filesUnder(input.kitTemplateDir)) {
    if (relative === 'package.json' || relative.startsWith(`${initialDirName}/`)) continue
    addFile('骨架模板', siteFileOf(relative), readFileSync(path.join(input.kitTemplateDir, relative), 'utf8'))
  }
  // 起始物：骨架的（people.json、glossary.terms.ts）与各功能包的 initial/，无条件写（建站目标是空目录）
  const kitInitialDir = path.join(input.kitTemplateDir, initialDirName)
  addFilesUnder('骨架模板', kitInitialDir, '')
  for (const feature of input.features) {
    const skeletonDir = path.join(feature.dir, 'template', 'skeleton')
    if (statOrNull(skeletonDir)?.isDirectory()) addFilesUnder(feature.name, skeletonDir, '')
    const featureInitialDir = path.join(feature.dir, 'template', initialDirName)
    if (statOrNull(featureInitialDir)?.isDirectory()) addFilesUnder(feature.name, featureInitialDir, '')
  }

  // 生成的 app/site/：按 docsite.features 现算
  const contentFeatures = input.features.filter((feature) => exportsContent(feature.manifest)).map((feature) => feature.name)
  for (const [file, text] of Object.entries(generatedFiles(input.features.map((feature) => feature.name), contentFeatures))) {
    files.push({ relativePath: `${generatedDir}/${file}`, content: text })
  }

  // 起始内容与本机约定
  files.push({ relativePath: 'content/meta.json', content: `${JSON.stringify({ title: input.title, pages: [] }, null, 2)}\n` })
  files.push({
    relativePath: 'content/index.mdx',
    content: `---\ntitle: ${input.title}\ndescription: 用 docsite.site.init 建的站，从这页开始写\n---\n\n这一页是建站时写的起始页，改掉它或删掉它都行。\n`,
  })
  files.push({
    relativePath: 'pnpm-workspace.yaml',
    content: "allowBuilds:\n  esbuild: true\nonlyBuiltDependencies:\n  - esbuild\n# 团队的包刚发就要用：@godcreator 的包不受「发布不满一天不装」的限制\nminimumReleaseAgeExclude:\n  - '@godcreator/*'\n",
  })

  // package.json：骨架模板的依赖（workspace:* 换精确版本）打底，功能包模板的脚本与依赖合并进来（依赖同名照骨架的），功能包自身写精确版本
  const manifest: Manifest = { name: input.siteName, private: true, type: 'module' }
  const scripts: Record<string, string> = { ...kitManifest.scripts }
  let dependencies = resolvedDependencies(kitManifest.dependencies, input.versions)
  let devDependencies = resolvedDependencies(kitManifest.devDependencies, input.versions)
  for (const feature of input.features) {
    const featureManifest = readJson(path.join(feature.dir, 'package.json'))
    // 功能包的脚本只能新增：骨架的 dev/build 这类同名脚本归骨架，功能包覆盖它们没有正当场景
    for (const [name, script] of Object.entries(featureManifest.scripts ?? {})) if (!(name in scripts)) scripts[name] = script
    dependencies = { ...resolvedDependencies(featureManifest.dependencies, input.versions), ...dependencies }
    devDependencies = { ...resolvedDependencies(featureManifest.devDependencies, input.versions), ...devDependencies }
  }
  for (const feature of input.features) dependencies[feature.name] = feature.version
  if (scripts['dev'] !== undefined) scripts['dev'] = scripts['dev'].replace(devPortPattern, `$1${input.port}`)
  manifest.scripts = scripts
  manifest.dependencies = dependencies
  manifest.devDependencies = devDependencies
  manifest.docsite = { features: input.features.map((feature) => feature.name) }
  files.push({ relativePath: 'package.json', content: `${JSON.stringify(manifest, null, 2)}\n` })

  return files
}

function statOrNull(file: string) {
  try {
    return statSync(file)
  } catch {
    return null
  }
}
