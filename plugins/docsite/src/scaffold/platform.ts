import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type * as Scaffold from '@godcreator/god-docsite/scaffold'
import { DocsiteRejected } from '../errors.js'

export type PlatformScaffold = Pick<typeof Scaffold, 'createSite' | 'addFeature'>
export type { PackageSource } from '@godcreator/god-docsite/scaffold'

export const platformPackageName = '@godcreator/god-docsite'

/** 插件包根：源码在 src/scaffold/、产物打包成 dist/index.js，按 package.json 往上找 */
export const pluginDir = pluginRootOf(path.dirname(fileURLToPath(import.meta.url)))

function pluginRootOf(startDir: string): string {
  for (let dir = startDir; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
    if (path.dirname(dir) === dir) throw new Error(`从 ${startDir} 往上找不到插件的 package.json`)
  }
}

/**
 * 加载装在插件旁边的平台建站器。必须从平台包自己的目录加载、不能打包进插件：建站器按自己模块的位置找平台包的 template/。
 * 地址是算出来的、经 import(变量) 加载，发版检查才不把它当成产物里的包名 import（插件产物只许 import peer 里的包）
 */
export async function loadPlatformScaffold(fromDir = pluginDir): Promise<PlatformScaffold> {
  let entry: string
  try {
    entry = createRequire(path.join(fromDir, 'package.json')).resolve(`${platformPackageName}/scaffold`)
  } catch (error) {
    throw new DocsiteRejected(`从 ${fromDir} 找不到 ${platformPackageName}/scaffold：插件的 dependencies 里有它，重装插件（${error instanceof Error ? error.message : String(error)}）`)
  }
  return (await import(pathToFileURL(entry).href)) as PlatformScaffold
}

export type VisiblePackage = { dir: string; version: string }

function versionIn(manifestFile: string, name: string): string {
  let manifest: unknown
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  } catch (error) {
    throw new DocsiteRejected(`${manifestFile} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  const record = typeof manifest === 'object' && manifest !== null ? (manifest as Record<string, unknown>) : {}
  if (record['name'] !== name) throw new DocsiteRejected(`${manifestFile} 的 name 不是 ${name}`)
  const version = record['version']
  if (typeof version !== 'string' || version === '') throw new DocsiteRejected(`${manifestFile} 没写 version`)
  return version
}

/** 按 Node 找包的顺序：从 fromDir 起逐级往上看各级 node_modules 里有没有这个包；不经 exports，没导出 package.json 的包也找得到 */
export function packageVisibleFrom(fromDir: string, name: string): VisiblePackage | undefined {
  for (let dir = path.resolve(fromDir); ; dir = path.dirname(dir)) {
    const packageDir = path.join(dir, 'node_modules', ...name.split('/'))
    const manifestFile = path.join(packageDir, 'package.json')
    if (existsSync(manifestFile)) return { dir: packageDir, version: versionIn(manifestFile, name) }
    if (path.dirname(dir) === dir) return undefined
  }
}
