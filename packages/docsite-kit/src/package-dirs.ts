import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'

export type Manifest = { name?: string; version?: string; dependencies?: Record<string, string>; exports?: unknown; [key: string]: unknown }

export const readManifest = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Manifest

/** 照 Node 的找法，从 fromDir 往上找 node_modules/<name>/package.json；找不到为 null */
export function manifestFileOf(fromDir: string, name: string): string | null {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) return candidate
    if (path.dirname(dir) === dir) return null
  }
}

/** 站点装着的那个包的包根（真实路径：pnpm 的 node_modules/<包> 是符号链接）；没装就报错 */
export function installedPackageDirOf(siteDir: string, name: string): string {
  const manifestFile = manifestFileOf(siteDir, name)
  if (manifestFile === null) throw new Error(`站点的 node_modules 里没有 ${name}：在站点目录运行 pnpm install`)
  return path.dirname(realpathSync(manifestFile))
}
