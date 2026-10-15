import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord, readJsonFile } from './files.js'

const packageNamePattern = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/

export function assertPackageName(name: string): void {
  if (!packageNamePattern.test(name)) throw new Error(`${JSON.stringify(name)} 不是 npm 包名（形如 @godcreator/collab 或 collab）`)
}

export interface InstalledPackage {
  dir: string
  version: string
}

/** 读包目录里的 package.json，核对 name 是要找的包；version 必须有 */
export function installedPackageAt(dir: string, name: string): InstalledPackage {
  const manifest = readJsonFile(path.join(dir, 'package.json'))
  if (!isRecord(manifest) || manifest['name'] !== name) throw new Error(`${dir} 的 package.json 里 name 不是 ${name}`)
  const version = manifest['version']
  if (typeof version !== 'string' || version === '') throw new Error(`${dir} 的 package.json 没写 version`)
  return { dir, version }
}

/** 某个目录自己的 node_modules 里的包（不往上找）；没装返回 undefined */
export function packageInNodeModules(parentDir: string, name: string): InstalledPackage | undefined {
  const dir = path.join(parentDir, 'node_modules', ...name.split('/'))
  return existsSync(path.join(dir, 'package.json')) ? installedPackageAt(dir, name) : undefined
}

/** 按 Node 找包目录的顺序：从 fromDir 起，逐级往上看各级的 node_modules；不经 exports，所以没导出 package.json 的包也找得到 */
export function packageVisibleFrom(fromDir: string, name: string): InstalledPackage | undefined {
  for (let dir = path.resolve(fromDir); ; dir = path.dirname(dir)) {
    const found = packageInNodeModules(dir, name)
    if (found !== undefined) return found
    if (path.dirname(dir) === dir) return undefined
  }
}

export const platformPackageName = '@godcreator/god-docsite'

/** 平台包自己的根目录：从这个模块所在位置往上找 name 是 @godcreator/god-docsite 的 package.json（源码与构建产物的深度不同） */
export function platformPackageDir(): string {
  for (let dir = path.dirname(fileURLToPath(import.meta.url)); ; dir = path.dirname(dir)) {
    const manifestFile = path.join(dir, 'package.json')
    if (existsSync(manifestFile)) {
      const manifest = readJsonFile(manifestFile)
      if (isRecord(manifest) && manifest['name'] === platformPackageName) return dir
    }
    if (path.dirname(dir) === dir) throw new Error(`从 ${fileURLToPath(import.meta.url)} 往上找不到 ${platformPackageName} 的 package.json`)
  }
}
