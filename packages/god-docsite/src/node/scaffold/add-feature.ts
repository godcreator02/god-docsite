import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { assertFeatureName, featureNameOf, featuresDirInSite, regenerateFeatureIndex } from './feature-index.js'
import { copyMissingFiles } from './files.js'
import { assertPackageName, packageInNodeModules } from './installed-packages.js'

export interface AddFeatureOptions {
  siteDir: string
  /** 功能包的包名，如 @godcreator/collab；要已经装进站点的 node_modules */
  packageName: string
}

export interface AddedFeature {
  /** 功能名：包名去掉作用域，也是 app/features/ 下的目录名 */
  feature: string
  /** 这次从功能包 template/ 补进去的文件（相对功能目录） */
  addedFiles: string[]
  /** 站点里已经有、没动的文件 */
  keptFiles: string[]
  /** 重写汇总文件后认出的全部功能 */
  features: string[]
}

/**
 * 把站点 node_modules 里功能包的 template/ 补进 app/features/<功能名>/（已有的文件不覆盖），再重写汇总文件。
 * 对同一站点重复运行只补缺的；功能包要先装进站点（pnpm add），建站器不装依赖
 */
export function addFeature({ siteDir, packageName }: AddFeatureOptions): AddedFeature {
  assertPackageName(packageName)
  const feature = featureNameOf(packageName)
  assertFeatureName(feature)
  if (!existsSync(path.join(siteDir, featuresDirInSite))) throw new Error(`${siteDir} 里没有 ${featuresDirInSite}/：不是 createSite 建的站`)
  const installed = packageInNodeModules(siteDir, packageName)
  if (installed === undefined) throw new Error(`${siteDir}/node_modules 里没有 ${packageName}：先在站点里装上它（pnpm add ${packageName}）再加功能`)
  const templateDir = path.join(installed.dir, 'template')
  if (!existsSync(templateDir) || !statSync(templateDir).isDirectory()) throw new Error(`${packageName}（${installed.dir}）没有 template/ 目录：不是带站点模板的功能包`)
  const copied = copyMissingFiles(templateDir, path.join(siteDir, featuresDirInSite, feature))
  const { features } = regenerateFeatureIndex(siteDir)
  return { feature, addedFiles: copied.added, keptFiles: copied.kept, features }
}
