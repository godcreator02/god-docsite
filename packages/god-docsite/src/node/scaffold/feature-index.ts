import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { scanExports } from './exported-names.js'
import { isRecord, readJsonFile } from './files.js'
import { packageInNodeModules } from './installed-packages.js'

/** 站点里放功能目录的地方，相对站点根 */
export const featuresDirInSite = 'app/features'

/** 功能目录里建站器认的文件：含其中任一个的子目录就算功能（只有 styles.css 的功能只进样式汇总） */
const featureFiles = { routes: 'routes.ts', runtime: 'feature.tsx', layoutServer: 'layout.server.ts', mdx: 'mdx.ts', styles: 'styles.css' } as const

/** 汇总文件，都在 app/features/ 下，每次重写；站点模板固定 import 它们 */
export const featureIndexFiles = {
  routes: 'routes.generated.ts',
  runtime: 'runtime.generated.ts',
  layoutServer: 'layout.generated.server.ts',
  mdx: 'mdx.generated.ts',
  collections: 'collections.generated.ts',
  styles: 'styles.generated.css',
} as const

/** 站点的全站 remark / rehype 插件（模板文件）：集合汇总把它传给各功能的集合工厂 */
const siteMdxPluginsModule = '../lib/mdx-plugins.ts'

const featureNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const collectionNamePattern = /^[A-Za-z_$][\w$]*$/

interface SiteFeature {
  name: string
  /** 生成代码里的变量名前缀：功能名转成驼峰 */
  identifier: string
  hasRoutes: boolean
  hasRuntime: boolean
  hasLayoutServer: boolean
  hasMdx: boolean
  hasStyles: boolean
  /** 功能包 package.json 的 godDocsite.collections：mdx.ts 的 collections 里各工厂的名字，也是站点里的集合名 */
  collections: string[]
}

export function assertFeatureName(name: string): void {
  if (!featureNamePattern.test(name)) throw new Error(`功能名 ${JSON.stringify(name)} 要是小写字母开头、由小写字母数字与单个 - 组成（如 code-pin）`)
}

/** 功能名：包名去掉作用域（@godcreator/code-pin → code-pin） */
export function featureNameOf(packageName: string): string {
  return packageName.slice(packageName.indexOf('/') + 1)
}

function identifierOf(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
}

/** 功能包 package.json 里的 "godDocsite": { "collections": [...] }；没写就是没有集合。同一对象里的 dataDirs 由 vite 插件读 */
function declaredCollectionsOf(manifestFile: string): string[] {
  const manifest = readJsonFile(manifestFile)
  if (!isRecord(manifest) || manifest['godDocsite'] === undefined) return []
  const declared = manifest['godDocsite']
  if (!isRecord(declared)) throw new Error(`${manifestFile} 的 godDocsite 要是对象`)
  const collections = declared['collections']
  if (collections === undefined) return []
  if (!Array.isArray(collections) || !collections.every((name) => typeof name === 'string' && collectionNamePattern.test(name))) {
    throw new Error(`${manifestFile} 的 godDocsite 要写成 { "collections": ["集合名", …] }，集合名是 JS 标识符`)
  }
  return collections as string[]
}

/** 站点 package.json 的依赖里功能名是 feature 的那个包：功能目录由 addFeature 从它的 template/ 补出来 */
function featurePackageNameOf(siteDir: string, feature: string): string {
  const manifestFile = path.join(siteDir, 'package.json')
  const manifest = readJsonFile(manifestFile)
  const names = isRecord(manifest) ? [manifest['dependencies'], manifest['devDependencies']].flatMap((deps) => (isRecord(deps) ? Object.keys(deps) : [])) : []
  const matches = [...new Set(names.filter((name) => featureNameOf(name) === feature))]
  if (matches.length !== 1) {
    throw new Error(`功能目录 ${feature} 有 ${featureFiles.mdx}，要从功能包的 package.json 读集合名单，但 ${manifestFile} 的依赖里功能名是 ${feature} 的包有 ${matches.length} 个${matches.length > 0 ? `（${matches.join('、')}）` : ''}`)
  }
  return matches[0]!
}

function collectionsOfFeature(siteDir: string, feature: string): string[] {
  const packageName = featurePackageNameOf(siteDir, feature)
  const installed = packageInNodeModules(siteDir, packageName)
  if (installed === undefined) throw new Error(`${siteDir}/node_modules 里没有 ${packageName}：先 pnpm install`)
  return declaredCollectionsOf(path.join(installed.dir, 'package.json'))
}

/** app/features/ 下含 routes.ts、feature.tsx、layout.server.ts、mdx.ts 或 styles.css 的子目录，按名字排序 */
function siteFeaturesIn(siteDir: string): SiteFeature[] {
  const featuresDir = path.join(siteDir, featuresDirInSite)
  const features: SiteFeature[] = []
  const nameOfIdentifier = new Map<string, string>()
  for (const name of readdirSync(featuresDir).sort()) {
    const dir = path.join(featuresDir, name)
    if (!statSync(dir).isDirectory()) continue
    const has = (file: string) => existsSync(path.join(dir, file))
    if (!Object.values(featureFiles).some(has)) continue
    assertFeatureName(name)
    const identifier = identifierOf(name)
    const clash = nameOfIdentifier.get(identifier)
    if (clash !== undefined) throw new Error(`功能目录 ${clash} 与 ${name} 转成变量名都是 ${identifier}：改掉其中一个目录名`)
    nameOfIdentifier.set(identifier, name)
    features.push({
      name,
      identifier,
      hasRoutes: has(featureFiles.routes),
      hasRuntime: has(featureFiles.runtime),
      hasLayoutServer: has(featureFiles.layoutServer),
      hasMdx: has(featureFiles.mdx),
      hasStyles: has(featureFiles.styles),
      collections: has(featureFiles.mdx) ? collectionsOfFeature(siteDir, name) : [],
    })
  }
  return features
}

/** 集合名在全站唯一：source.config.ts 自己的集合与各功能的集合都不能重名（重名时 export * 的那个会被悄悄挡掉） */
function assertUniqueCollections(features: readonly SiteFeature[], siteCollections: readonly string[]): void {
  const ownerOf = new Map<string, string>(siteCollections.map((name) => [name, 'source.config.ts']))
  for (const feature of features) {
    for (const collection of feature.collections) {
      const owner = ownerOf.get(collection)
      if (owner !== undefined) throw new Error(`集合名 ${collection} 在 ${owner} 与功能 ${feature.name} 里都有：集合名要全站唯一`)
      ownerOf.set(collection, `功能 ${feature.name}`)
    }
  }
}

const generatedNotice = '建站器生成，勿手改：addFeature / regenerateFeatureIndex 每次都重写。功能清单是 app/features/ 下含 routes.ts、feature.tsx、layout.server.ts、mdx.ts 或 styles.css 的子目录'
const tsHeader = `// ${generatedNotice}\n`

function routesIndexOf(features: readonly SiteFeature[]): string {
  const withRoutes = features.filter((feature) => feature.hasRoutes)
  return [
    tsHeader,
    `import type { RouteConfigEntry } from '@react-router/dev/routes'\n`,
    ...withRoutes.map((feature) => `import * as ${feature.identifier}Routes from './${feature.name}/${featureFiles.routes}'\n`),
    `\n/** 各功能 routes.ts 可以导出的：默认导出嵌在布局路由里，standaloneRoutes 在布局路由之外（占满窗口、不带侧栏） */\n`,
    `interface FeatureRoutesModule {\n  default?: RouteConfigEntry[]\n  standaloneRoutes?: RouteConfigEntry[]\n}\n`,
    `\nconst featureRoutesModules: FeatureRoutesModule[] = [${withRoutes.map((feature) => `${feature.identifier}Routes`).join(', ')}]\n`,
    `\nexport const featureRoutes: RouteConfigEntry[] = featureRoutesModules.flatMap((routes) => routes.default ?? [])\n`,
    `export const featureStandaloneRoutes: RouteConfigEntry[] = featureRoutesModules.flatMap((routes) => routes.standaloneRoutes ?? [])\n`,
  ].join('')
}

function runtimeIndexOf(features: readonly SiteFeature[]): string {
  const withRuntime = features.filter((feature) => feature.hasRuntime)
  return [
    tsHeader,
    `import { siteFeatureRuntime } from '@godcreator/god-docsite/react'\n`,
    ...withRuntime.map((feature) => `import * as ${feature.identifier}Feature from './${feature.name}/${featureFiles.runtime}'\n`),
    `\nexport const featureRuntime = siteFeatureRuntime({${withRuntime.map((feature) => ` '${feature.name}': ${feature.identifier}Feature`).join(',')}${withRuntime.length > 0 ? ' ' : ''}})\n`,
  ].join('')
}

function layoutServerIndexOf(features: readonly SiteFeature[]): string {
  const withLayoutServer = features.filter((feature) => feature.hasLayoutServer)
  return [
    tsHeader,
    `import { siteFeatureLayoutServer } from '@godcreator/god-docsite/server'\n`,
    ...withLayoutServer.map((feature) => `import * as ${feature.identifier}LayoutServer from './${feature.name}/${featureFiles.layoutServer}'\n`),
    `\nexport const featureLayoutServer = siteFeatureLayoutServer({${withLayoutServer.map((feature) => ` '${feature.name}': ${feature.identifier}LayoutServer`).join(',')}${withLayoutServer.length > 0 ? ' ' : ''}})\n`,
  ].join('')
}

function mdxIndexOf(features: readonly SiteFeature[]): string {
  const withMdx = features.filter((feature) => feature.hasMdx)
  return [
    tsHeader,
    `import type { DefaultMDXOptions } from 'fumadocs-mdx/config'\n`,
    ...withMdx.map((feature) => `import * as ${feature.identifier}Mdx from './${feature.name}/${featureFiles.mdx}'\n`),
    `\nexport type MdxPluginList = Extract<NonNullable<DefaultMDXOptions['remarkPlugins']>, unknown[]>\n`,
    `\n/** 集合工厂收到的全站插件：工厂把它们并进自己集合的 applyMdxPreset（集合写了 mdxOptions，全局的就不生效） */\n`,
    `export interface SiteMdxPlugins {\n  remarkPlugins: MdxPluginList\n  rehypePlugins: MdxPluginList\n}\n`,
    `\n/** 各功能 mdx.ts 可以导出的几样 */\n`,
    `interface FeatureMdxModule {\n  remarkPlugins?: MdxPluginList\n  rehypePlugins?: MdxPluginList\n  collections?: Readonly<Record<string, (sitePlugins: SiteMdxPlugins) => unknown>>\n}\n`,
    `\nconst featureMdxModules: FeatureMdxModule[] = [${withMdx.map((feature) => `${feature.identifier}Mdx`).join(', ')}]\n`,
    `\nexport const featureRemarkPlugins: MdxPluginList = featureMdxModules.flatMap((mdx) => mdx.remarkPlugins ?? [])\n`,
    `export const featureRehypePlugins: MdxPluginList = featureMdxModules.flatMap((mdx) => mdx.rehypePlugins ?? [])\n`,
  ].join('')
}

function collectionsIndexOf(features: readonly SiteFeature[]): string {
  const withCollections = features.filter((feature) => feature.collections.length > 0)
  if (withCollections.length === 0) return [tsHeader, `// source.config.ts 用 export * 再导出这里：fumadocs-mdx 要求那份文件只导出集合\nexport {}\n`].join('')
  return [
    tsHeader,
    `// source.config.ts 用 export * 再导出这里：fumadocs-mdx 要求那份文件只导出集合，所以这里只有集合是导出的\n`,
    `import { sitePlugins } from '${siteMdxPluginsModule}'\n`,
    ...withCollections.map((feature) => `import * as ${feature.identifier}Mdx from './${feature.name}/${featureFiles.mdx}'\n`),
    '\n',
    ...withCollections.flatMap((feature) => feature.collections.map((collection) => `export const ${collection} = ${feature.identifier}Mdx.collections.${collection}(sitePlugins)\n`)),
  ].join('')
}

function stylesIndexOf(features: readonly SiteFeature[]): string {
  return [`/* ${generatedNotice} */\n`, ...features.filter((feature) => feature.hasStyles).map((feature) => `@import './${feature.name}/${featureFiles.styles}';\n`)].join('')
}

/** source.config.ts 自己导出的集合名（不含 default 与 export * 再导出的） */
function siteCollectionsOf(siteDir: string): string[] {
  const file = path.join(siteDir, 'source.config.ts')
  return scanExports(readFileSync(file, 'utf8'), file).names
}

export interface FeatureIndex {
  /** 认出的功能，按名字排序 */
  features: string[]
  /** 重写的汇总文件，相对站点根 */
  files: string[]
}

/** 只重写 app/features/ 下的汇总文件：按现在的功能目录与功能包声明的集合名单现算 */
export function regenerateFeatureIndex(siteDir: string): FeatureIndex {
  mkdirSync(path.join(siteDir, featuresDirInSite), { recursive: true })
  const features = siteFeaturesIn(siteDir)
  assertUniqueCollections(features, siteCollectionsOf(siteDir))
  const contents: Record<keyof typeof featureIndexFiles, string> = {
    routes: routesIndexOf(features),
    runtime: runtimeIndexOf(features),
    layoutServer: layoutServerIndexOf(features),
    mdx: mdxIndexOf(features),
    collections: collectionsIndexOf(features),
    styles: stylesIndexOf(features),
  }
  const files: string[] = []
  for (const [kind, text] of Object.entries(contents) as Array<[keyof typeof featureIndexFiles, string]>) {
    writeFileSync(path.join(siteDir, featuresDirInSite, featureIndexFiles[kind]), text)
    files.push(`${featuresDirInSite}/${featureIndexFiles[kind]}`)
  }
  return { features: features.map((feature) => feature.name), files }
}
