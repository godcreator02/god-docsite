import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DOCFIRST_PACKAGE } from '../docfirst/docfirst-site.js'
import { DocsiteRejected, messageOf } from '../errors.js'
import type { RunPnpm } from '../pnpm.js'
import { unifiedDiffOf } from './line-diff.js'
import { packageVisibleFrom, platformPackageName, type PlatformScaffold } from './platform.js'

const godcreatorScope = '@godcreator/'
const versionRangePattern = /^[\^~]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
/** npm 发布时不带 .gitignore：平台模板里存成 gitignore，建站时改回来 */
const gitignoreInTemplate = 'gitignore'

export type UpgradedPackage = { name: string; from: string; to: string }
export type PackageLeftAlone = { name: string; specifier: string; reason: string }

/**
 * 模板写出的一个文件这次升级里的变化。template：新一版模板对上一版是新加的、去掉的还是改了；
 * site：站点里这个文件现在是没有（missing）、和上一版模板一字不差（old，站点没改过，可以直接换成新的）、已经和新一版一样（new），还是站点自己改过（own）
 */
export type TemplateFileChange = {
  /** 站点里的路径，相对站点根 */
  file: string
  template: 'added' | 'removed' | 'changed'
  site: 'missing' | 'old' | 'new' | 'own'
  /** template 为 changed 时：上一版模板到这一版的统一差异格式 */
  diff?: string
}

export type SiteUpgraded = {
  upgraded: UpgradedPackage[]
  notUpgraded: PackageLeftAlone[]
  /** 重写汇总文件后站点认出的全部功能 */
  features: string[]
  templateChanges: TemplateFileChange[]
  /** 站点根 docsite.json 原样读出的 kind、audience、format，没有这个文件为 null：人或 agent 照模板改完后自己补 audience、把 format 改成这一版平台认的 */
  identityFile: Record<string, unknown> | null
}

export type UpgradeSiteDeps = {
  scaffold: () => Promise<PlatformScaffold>
  pnpm: RunPnpm
  isRunning(dir: string): boolean
  /** 升到哪一版：插件包根，从它往上看旁边装着的包 */
  versionsFrom: string
}

type SiteManifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${messageOf(error)}`)
  }
}

/** 包的 template/ 下的文件对应站点里的哪个路径：平台包对站点根，功能包对 app/features/<功能名>/ */
function sitePathOfTemplateFile(packageName: string, relative: string): string {
  if (packageName === platformPackageName) return relative === gitignoreInTemplate ? '.gitignore' : relative
  return `app/features/${packageName.slice(packageName.indexOf('/') + 1)}/${relative}`
}

function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    return entry.isDirectory() ? filesUnder(path.join(dir, entry.name), relative) : [relative]
  })
}

/** 建站器只在建站时写一次、之后归站点自己维护的文件：内容、首页、评论、人员、术语、依赖清单 */
function isSiteOwned(sitePath: string): boolean {
  return ['app/routes/home.tsx', 'people.json', 'glossary.json', 'package.json', 'pnpm-workspace.yaml'].includes(sitePath) || sitePath.startsWith('content/') || sitePath.startsWith('comments/')
}

/** 站点里装着的这几个包的 template/：站点路径 → 文件内容。docfirst 的 template/ 是 docfirst.create 复制到站点根的起始文件，写完归站点，不比 */
function templateFilesOf(siteDir: string, packageNames: readonly string[]): Map<string, string> {
  const files = new Map<string, string>()
  for (const name of packageNames.filter((packageName) => packageName !== DOCFIRST_PACKAGE)) {
    const installed = packageVisibleFrom(siteDir, name)
    if (installed === undefined) throw new DocsiteRejected(`${siteDir} 的 node_modules 里没有 ${name}：先在站点目录里 pnpm install`)
    const templateDir = path.join(installed.dir, 'template')
    if (!existsSync(templateDir)) continue
    for (const relative of filesUnder(templateDir)) {
      const sitePath = sitePathOfTemplateFile(name, relative)
      if (!isSiteOwned(sitePath)) files.set(sitePath, readFileSync(path.join(templateDir, relative), 'utf8'))
    }
  }
  return files
}

const sameText = (a: string, b: string) => a.replaceAll('\r\n', '\n') === b.replaceAll('\r\n', '\n')

function siteStateOf(siteDir: string, file: string, oldTemplate: string | undefined, newTemplate: string | undefined): TemplateFileChange['site'] {
  const siteFile = path.join(siteDir, file)
  if (!existsSync(siteFile)) return 'missing'
  const text = readFileSync(siteFile, 'utf8')
  if (newTemplate !== undefined && sameText(text, newTemplate)) return 'new'
  if (oldTemplate !== undefined && sameText(text, oldTemplate)) return 'old'
  return 'own'
}

export function templateChangesOf(siteDir: string, before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): TemplateFileChange[] {
  const files = [...new Set([...before.keys(), ...after.keys()])].sort()
  return files.flatMap((file): TemplateFileChange[] => {
    const oldTemplate = before.get(file)
    const newTemplate = after.get(file)
    if (oldTemplate !== undefined && newTemplate !== undefined && sameText(oldTemplate, newTemplate)) return []
    const site = siteStateOf(siteDir, file, oldTemplate, newTemplate)
    if (oldTemplate === undefined) return [{ file, template: 'added', site }]
    if (newTemplate === undefined) return [{ file, template: 'removed', site }]
    return [{ file, template: 'changed', site, diff: unifiedDiffOf(oldTemplate, newTemplate) }]
  })
}

/**
 * 站点依赖里 @godcreator 的包：versions 里给了的升到给的版本，没给的升到插件旁边装着的那一版；
 * 不是从 registry 装的、没给版本插件旁边也没装的，原样留着并写明原因
 */
function upgradePlanOf(
  siteDir: string,
  versionsFrom: string,
  versions: Readonly<Record<string, string>>,
): { upgrades: Array<{ name: string; from: string; specifier: string }>; leftAlone: PackageLeftAlone[] } {
  const manifest = readJson(path.join(siteDir, 'package.json')) as SiteManifest
  const declared = { ...manifest.devDependencies, ...manifest.dependencies }
  for (const [name, specifier] of Object.entries(versions)) {
    if (declared[name] === undefined) throw new DocsiteRejected(`versions 里的 ${name} 不在站点的依赖里：升级只升站点已经装着的包，要加功能用 docsite.feature.add`)
    if (!versionRangePattern.test(specifier)) throw new DocsiteRejected(`versions 里 ${name} 的版本要写成版本范围（^0.3.1、0.3.1、~0.3.1），收到 ${JSON.stringify(specifier)}`)
  }
  const upgrades: Array<{ name: string; from: string; specifier: string }> = []
  const leftAlone: PackageLeftAlone[] = []
  for (const [name, specifier] of Object.entries(declared).sort(([a], [b]) => a.localeCompare(b))) {
    if (!name.startsWith(godcreatorScope)) continue
    if (!versionRangePattern.test(specifier)) {
      leftAlone.push({ name, specifier, reason: '不是从 registry 装的版本范围（workspace: / link: / file: 这类），升级只管从 registry 装的包' })
      continue
    }
    const given = versions[name]
    const target = given === undefined ? packageVisibleFrom(versionsFrom, name) : undefined
    if (given === undefined && target === undefined) {
      leftAlone.push({ name, specifier, reason: 'gwb-docsite 旁边没装这个包，不知道升到哪一版：要升就在 versions 里给它的版本' })
      continue
    }
    const installed = packageVisibleFrom(siteDir, name)
    if (installed === undefined) throw new DocsiteRejected(`${siteDir} 的 node_modules 里没有 ${name}：先在站点目录里 pnpm install`)
    upgrades.push({ name, from: installed.version, specifier: given ?? `^${target!.version}` })
  }
  return { upgrades, leftAlone }
}

/**
 * 升级已有站点：站点依赖里的平台包与功能包升到 versions 给的、或插件旁边装着的那一版（pnpm add），重写 app/features/ 下的汇总文件，
 * 再把这些包新旧两版的 template/ 逐个比，列出模板变了的文件、站点里那个文件现在的样子与模板改了哪几行。
 * 不改模板写出的文件、不改 docsite.json：站点自己改过的地方只有人和 agent 分得清。站点在运行时拒绝
 */
export async function upgradeSite(dir: string, versions: Readonly<Record<string, string>>, deps: UpgradeSiteDeps): Promise<SiteUpgraded> {
  if (!existsSync(path.join(dir, 'package.json'))) throw new DocsiteRejected(`${dir} 下没有 package.json，不是站点目录`)
  if (deps.isRunning(dir)) throw new DocsiteRejected(`${dir} 的站点在运行：先 docsite.site.stop 停掉，升级完再启动`)
  if (packageVisibleFrom(dir, platformPackageName) === undefined) throw new DocsiteRejected(`${dir} 的 node_modules 里没有 ${platformPackageName}：先在站点目录里 pnpm install`)
  const { upgrades, leftAlone } = upgradePlanOf(dir, deps.versionsFrom, versions)
  const packageNames = upgrades.map((upgrade) => upgrade.name)
  const before = templateFilesOf(dir, packageNames)
  if (upgrades.length > 0) {
    const specs = upgrades.map((upgrade) => `${upgrade.name}@${upgrade.specifier}`)
    await deps.pnpm(dir, ['add', ...specs], `${dir} 里 pnpm add ${specs.join(' ')}`)
  }
  const after = templateFilesOf(dir, packageNames)
  const { regenerateFeatureIndex } = await deps.scaffold()
  let features: string[]
  try {
    features = regenerateFeatureIndex(dir).features
  } catch (error) {
    throw new DocsiteRejected(`包已经升好，重写功能汇总文件时出错：${messageOf(error)}`)
  }
  const identityFilePath = path.join(dir, 'docsite.json')
  return {
    upgraded: upgrades.map((upgrade) => ({ name: upgrade.name, from: upgrade.from, to: packageVisibleFrom(dir, upgrade.name)!.version })),
    notUpgraded: leftAlone,
    features,
    templateChanges: templateChangesOf(dir, before, after),
    identityFile: existsSync(identityFilePath) ? (readJson(identityFilePath) as Record<string, unknown>) : null,
  }
}
