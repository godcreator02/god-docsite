import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DocsiteRejected } from './errors.js'

const kitPackageName = '@godcreator/docsite-kit'

/**
 * 插件托管的最低基础包版本：契约 v1（启动方式、身份与推送的环境变量、people.json 与 comments/ 的读写约定）
 * 从这一版起成形，低于它的站点按 v1 硬读会错，所以启动前核对、不够就拒绝
 */
export const MIN_KIT_VERSION = '0.2.0'

/** 三段数字比大小：a 小于 b 回负数、相等 0、大于回正数；不是三段数字就报错 */
export function compareVersions(a: string, b: string): number {
  const numbersOf = (version: string): number[] => {
    const parts = version.split('.')
    const numbers = parts.map(Number)
    if (parts.length !== 3 || numbers.some((each) => !Number.isInteger(each) || each < 0)) {
      throw new DocsiteRejected(`版本号要是三段数字（如 0.1.9），读到 ${version}`)
    }
    return numbers
  }
  const [aMajor, aMinor, aPatch] = numbersOf(a)
  const [bMajor, bMinor, bPatch] = numbersOf(b)
  return aMajor! - bMajor! || aMinor! - bMinor! || aPatch! - bPatch!
}

/** 站点装着的基础包版本；没装就报错（先装好依赖再启动） */
export function installedKitVersionOf(siteDir: string): string {
  const manifestFile = path.join(siteDir, 'node_modules', kitPackageName, 'package.json')
  if (!existsSync(manifestFile)) throw new DocsiteRejected(`${siteDir} 的 node_modules 里没有 ${kitPackageName}：在站点目录里运行 pnpm install`)
  let version: unknown
  try {
    version = (JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, unknown>)['version']
  } catch (error) {
    throw new DocsiteRejected(`${manifestFile} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof version !== 'string') throw new DocsiteRejected(`${manifestFile} 没有写 version`)
  return version
}

/** 启动站点前核对契约：站点装的基础包低于 MIN_KIT_VERSION 就拒绝，写明要升到哪版 */
export function checkKitVersion(siteDir: string): void {
  const installed = installedKitVersionOf(siteDir)
  if (compareVersions(installed, MIN_KIT_VERSION) >= 0) return
  throw new DocsiteRejected(
    `${siteDir} 装的 ${kitPackageName} ${installed} 低于插件支持的最低版 ${MIN_KIT_VERSION}（契约 v1）：把站点的这一项依赖升到 ${MIN_KIT_VERSION} 以上（package.json 里改成 "^${MIN_KIT_VERSION}" 再在站点目录里 pnpm install）`,
  )
}
