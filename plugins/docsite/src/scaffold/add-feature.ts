import path from 'node:path'
import { DocsiteRejected, messageOf } from '../errors.js'
import type { RunPnpm } from '../pnpm.js'
import { checkHomePage, type HomePageCheckDeps } from './home-page-check.js'
import { packageVisibleFrom, type PlatformScaffold } from './platform.js'

export type SiteFeatureOptions = {
  /** 功能包的包名，如 @godcreator/collab */
  packageName: string
  /**
   * 写在 pnpm add <包>@ 后面的依赖说明：版本范围（^0.3.1、0.3.1、~0.3.1），或 link: / file: 加绝对路径。
   * 不给就取本插件旁边装着的这个包的版本写 ^<版本>；本插件没装它就拒绝，要调用方给
   */
  specifier?: string
}

export type SiteFeatureAdded = {
  /** 功能名：包名去掉作用域，也是 app/features/ 下的目录名 */
  feature: string
  /** 这次 pnpm add 用的依赖说明 */
  specifier: string
  /** 从功能包 template/ 补进去的文件（相对功能目录）；已有的不覆盖，在 keptFiles 里 */
  addedFiles: string[]
  keptFiles: string[]
  /** 站点现在认出的全部功能 */
  features: string[]
}

export type AddSiteFeatureDeps = HomePageCheckDeps & {
  scaffold: () => Promise<PlatformScaffold>
  pnpm: RunPnpm
  /** 站点此刻有没有托管着的开发服务在运行 */
  isRunning(dir: string): boolean
  /** 不给 specifier 时从哪里找功能包的版本：插件包根 */
  versionsFrom: string
}

const packageNamePattern = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
const versionRangePattern = /^[\^~]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
/** link: / file: 后面的路径经 shell 交给 pnpm：不许空白、引号与 shell 元字符 */
const localSpecifierPattern = /^(?:link|file):[^\s"'`&|<>^%!;$()]+$/

function checkedSpecifier(specifier: string): string {
  if (versionRangePattern.test(specifier)) return specifier
  if (localSpecifierPattern.test(specifier) && path.isAbsolute(specifier.slice(specifier.indexOf(':') + 1))) return specifier
  throw new DocsiteRejected(`依赖说明 ${JSON.stringify(specifier)} 认不出：写版本范围（^0.3.1、0.3.1、~0.3.1），或 link: / file: 加绝对路径（路径里不能有空白与引号）`)
}

function specifierOf({ packageName, specifier }: SiteFeatureOptions, versionsFrom: string): string {
  if (specifier !== undefined) return checkedSpecifier(specifier)
  const installed = packageVisibleFrom(versionsFrom, packageName)
  if (installed === undefined) throw new DocsiteRejected(`gwb-docsite 旁边没装 ${packageName}，不知道该装哪一版：给 version（如 ^0.3.1）`)
  return `^${installed.version}`
}

/**
 * 给已有站点加一个功能：pnpm add <包>@<依赖说明> → 平台建站器把功能包的 template/ 补进 app/features/<功能名>/（已有的文件不覆盖）
 * 并重写功能汇总文件 → 起服务检查首页。对同一站点重复运行只补缺的；站点在运行时拒绝（Windows 上运行中的开发服务占着依赖里的文件）
 */
export async function addSiteFeature(dir: string, options: SiteFeatureOptions, deps: AddSiteFeatureDeps): Promise<SiteFeatureAdded> {
  if (!packageNamePattern.test(options.packageName)) throw new DocsiteRejected(`${JSON.stringify(options.packageName)} 不是 npm 包名（形如 @godcreator/collab）`)
  if (deps.isRunning(dir)) throw new DocsiteRejected(`${dir} 的站点在运行：先 docsite.site.stop 停掉，加完功能再启动`)
  const specifier = specifierOf(options, deps.versionsFrom)
  const { addFeature } = await deps.scaffold()
  await deps.pnpm(dir, ['add', `${options.packageName}@${specifier}`], `${dir} 里 pnpm add ${options.packageName}@${specifier}`)
  let added: ReturnType<PlatformScaffold['addFeature']>
  try {
    added = addFeature({ siteDir: dir, packageName: options.packageName })
  } catch (error) {
    throw new DocsiteRejected(`${options.packageName} 已经装进站点，补功能文件时出错：${messageOf(error)}`)
  }
  await checkHomePage(dir, `加上功能 ${added.feature}`, deps)
  return { feature: added.feature, specifier, addedFiles: added.addedFiles, keptFiles: added.keptFiles, features: added.features }
}
