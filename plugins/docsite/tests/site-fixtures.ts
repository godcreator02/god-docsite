import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HomePageCheckDeps } from '../src/scaffold/home-page-check.js'

export const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const repoDir = path.resolve(pluginDir, '..', '..')

/** 临时目录用长路径：%TEMP% 常是 8.3 短名，站点根与 Vite 解析出的模块路径对不上时 React Router 认不出路由模块 */
export function longTempDir(prefix: string): string {
  return mkdtempSync(path.join(realpathSync.native(tmpdir()), prefix))
}

export function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

/** 假的起服务检查：记下调用顺序，首页回 status */
export function fakeHomePageCheck(events: string[], options: { registered?: boolean; status?: number } = {}): HomePageCheckDeps {
  return {
    isRegistered: () => options.registered ?? false,
    start: async () => {
      events.push('start')
      return { url: 'http://127.0.0.1:4560', pid: 1, alreadyRunning: false }
    },
    stop: async () => {
      events.push('stop')
      return { url: 'http://127.0.0.1:4560' }
    },
    pageStatus: async () => {
      events.push('page-status')
      return options.status ?? 200
    },
  }
}

/** 站点 node_modules 里的包链到 link: 指的目录（Windows 上用目录联接）；别的写法不装 */
function linkPackage(dir: string, name: string, specifier: string): void {
  if (!specifier.startsWith('link:')) return
  const linkPath = path.join(dir, 'node_modules', ...name.split('/'))
  if (existsSync(linkPath)) return
  mkdirSync(path.dirname(linkPath), { recursive: true })
  symlinkSync(specifier.slice('link:'.length), linkPath, 'junction')
}

/**
 * 假的 pnpm：记下参数；`install` 把 dependencies 里写 link: 的包链进站点 node_modules；
 * `add <包>@link:<目录>` 照 pnpm 的样子写进站点 package.json 的 dependencies 并链进 node_modules
 */
export function fakePnpm(events: string[]) {
  return async (dir: string, args: readonly string[]) => {
    events.push(`pnpm ${args.join(' ')}`)
    const manifestFile = path.join(dir, 'package.json')
    const manifest = readJson(manifestFile) as { dependencies: Record<string, string> }
    if (args[0] === 'install') {
      for (const [name, specifier] of Object.entries(manifest.dependencies)) linkPackage(dir, name, specifier)
      return
    }
    if (args[0] !== 'add') return
    const spec = args[1]!
    const at = spec.indexOf('@', 1)
    const name = spec.slice(0, at)
    const specifier = spec.slice(at + 1)
    manifest.dependencies[name] = specifier
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    linkPackage(dir, name, specifier)
  }
}
