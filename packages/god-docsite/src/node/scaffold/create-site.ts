import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { regenerateFeatureIndex } from './feature-index.js'
import { filesUnder, isRecord, readJsonFile, toPosixPath } from './files.js'
import { installedPackageAt, packageVisibleFrom, platformPackageDir } from './installed-packages.js'

/**
 * 模板 package.json 里写成 {{version}} 的本仓包换成什么：
 * - registry：发版后从 registry 装，写 ^<版本>，版本取各包自己 package.json 的 version——从 resolveFrom 起往上的 node_modules 里找到这个包
 * - link：link:<repoDir>/packages/<去掉作用域的包名>，直接用仓里的包
 * - file：file:<tarball>（pnpm pack 的产物），再写进 pnpm-workspace.yaml 的 overrides，包之间的依赖也指向 tarball
 */
export type PackageSource =
  | { kind: 'registry'; resolveFrom: string }
  | { kind: 'link'; repoDir: string }
  | { kind: 'file'; tarballs: Readonly<Record<string, string>> }

/** people.json 的一项：形状由 identity 包校验（站点启动后读它时），这里只要求 id 与 name */
export type SitePeopleEntry = { id: string; name: string; codes?: readonly string[]; gitea?: string; agent?: boolean }

export interface CreateSiteOptions {
  /** 站点目录：不存在或是空目录 */
  dir: string
  /** 站名：侧栏标题，写进 content/meta.json 的 title */
  siteName: string
  /** 开发端口：写进 scripts.dev 的 --port */
  port: number
  /** 写进 people.json */
  people: readonly SitePeopleEntry[]
  packageSource: PackageSource
}

export interface CreatedSite {
  dir: string
  /** 模板里 {{version}} 换成的依赖说明，键是包名 */
  platformDependencies: Record<string, string>
}

const versionPlaceholder = '{{version}}'
/** npm 发布时不带 .gitignore：模板里存成 gitignore，写进站点时改回来 */
const gitignoreInTemplate = 'gitignore'

function assertCreateSiteOptions({ dir, siteName, port, people }: CreateSiteOptions): void {
  if (!path.isAbsolute(dir)) throw new Error(`站点目录要是绝对路径，收到 ${dir}`)
  if (siteName.trim() === '') throw new Error('siteName（站名）不能是空的')
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`port 要是 1–65535 的整数，收到 ${port}`)
  people.forEach((person, index) => {
    if (!isRecord(person) || typeof person.id !== 'string' || typeof person.name !== 'string') throw new Error(`people 第 ${index + 1} 项要有字符串的 id 与 name`)
  })
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} 已经存在且不是空目录：建站只往空目录里写`)
}

function unscopedNameOf(name: string): string {
  return name.slice(name.indexOf('/') + 1)
}

function specifierOf(name: string, source: PackageSource): string {
  if (source.kind === 'registry') {
    const found = packageVisibleFrom(source.resolveFrom, name)
    if (found === undefined) throw new Error(`从 ${source.resolveFrom} 往上的 node_modules 里找不到 ${name}：registry 装法按各包自己 package.json 的 version 写范围，先在那里装上它`)
    return `^${found.version}`
  }
  if (source.kind === 'link') {
    const dir = path.join(source.repoDir, 'packages', unscopedNameOf(name))
    installedPackageAt(dir, name)
    return `link:${toPosixPath(dir)}`
  }
  const tarball = source.tarballs[name]
  if (tarball === undefined) throw new Error(`file 装法没给 ${name} 的 tarball：tarballs 要有模板里每个写 ${versionPlaceholder} 的包`)
  if (!existsSync(tarball)) throw new Error(`${name} 的 tarball ${tarball} 不存在`)
  return `file:${toPosixPath(path.resolve(tarball))}`
}

type SiteManifest = Record<string, unknown> & { dependencies: Record<string, string>; scripts: Record<string, string> }

function siteManifestOf(templateManifestFile: string): SiteManifest {
  const manifest = readJsonFile(templateManifestFile)
  if (!isRecord(manifest) || !isRecord(manifest['dependencies']) || !isRecord(manifest['scripts'])) throw new Error(`${templateManifestFile} 要有 dependencies 与 scripts`)
  return manifest as SiteManifest
}

/** 模板 package.json：{{version}} 换成依赖说明，dev 脚本带上端口 */
function writeSiteManifest(dir: string, port: number, source: PackageSource): Record<string, string> {
  const file = path.join(dir, 'package.json')
  const manifest = siteManifestOf(file)
  const platformDependencies: Record<string, string> = {}
  for (const [name, range] of Object.entries(manifest.dependencies)) {
    if (range !== versionPlaceholder) continue
    platformDependencies[name] = specifierOf(name, source)
    manifest.dependencies[name] = platformDependencies[name]
  }
  if (JSON.stringify(manifest).includes('{{')) throw new Error(`模板 package.json 里还有 ${versionPlaceholder} 以外没换掉的占位`)
  const dev = manifest.scripts['dev']
  if (dev === undefined || dev.includes('--port')) throw new Error('模板 package.json 的 scripts.dev 要有、且不写 --port（端口由建站时给）')
  manifest.scripts['dev'] = `${dev} --port ${port}`
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return platformDependencies
}

/** esbuild 要跑安装脚本；@godcreator 的包刚发就要用，不受 pnpm「发布不满一天不装」的限制 */
function workspaceYamlOf(source: PackageSource, platformDependencies: Record<string, string>): string {
  const lines = ['allowBuilds:', '  esbuild: true', 'minimumReleaseAgeExclude:', "  - '@godcreator/*'"]
  if (source.kind === 'file') {
    lines.push('overrides:', ...Object.entries(platformDependencies).map(([name, specifier]) => `  '${name}': '${specifier}'`))
  }
  return `${lines.join('\n')}\n`
}

function writeSiteName(dir: string, siteName: string): void {
  const file = path.join(dir, 'content', 'meta.json')
  const meta = readJsonFile(file)
  if (!isRecord(meta)) throw new Error(`${file} 要是一个对象`)
  writeFileSync(file, `${JSON.stringify({ ...meta, title: siteName }, null, 2)}\n`)
}

/**
 * 从平台包的 template/ 建一个新站：复制模板，{{version}} 换成 packageSource 给的依赖说明，写 dev 端口、站名、people.json、
 * pnpm-workspace.yaml 与 .gitignore，再写空的功能汇总文件。不装依赖、不起服务；之后 pnpm install，要功能就装上功能包再 addFeature
 */
export function createSite(options: CreateSiteOptions): CreatedSite {
  assertCreateSiteOptions(options)
  const { dir, siteName, port, people, packageSource } = options
  const templateDir = path.join(platformPackageDir(), 'template')
  for (const relative of filesUnder(templateDir)) {
    const target = path.join(dir, relative === gitignoreInTemplate ? '.gitignore' : relative)
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(path.join(templateDir, relative), target)
  }
  const platformDependencies = writeSiteManifest(dir, port, packageSource)
  writeSiteName(dir, siteName)
  writeFileSync(path.join(dir, 'people.json'), `${JSON.stringify(people, null, 2)}\n`)
  writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), workspaceYamlOf(packageSource, platformDependencies))
  regenerateFeatureIndex(dir)
  return { dir, platformDependencies }
}
