import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DocsiteRejected } from './errors.js'
import { platformPackageName } from './scaffold/platform.js'

/**
 * 托管前核对站点建在平台包上：启动方式（scripts.dev 不写端口，平台的 vite 插件定端口）、身份与推送的环境变量、评论写入路由都是平台模板定的。
 * 旧地基 @godcreator/docsite-kit 的站评论接口不同，本插件不托管
 */
export function checkPlatformInstalled(siteDir: string): void {
  if (existsSync(path.join(siteDir, 'node_modules', ...platformPackageName.split('/'), 'package.json'))) return
  if (existsSync(path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit', 'package.json'))) {
    throw new DocsiteRejected(`${siteDir} 建在旧地基 @godcreator/docsite-kit 上：本插件只托管建在 ${platformPackageName} 上的站，先把站点迁到新平台`)
  }
  throw new DocsiteRejected(`${siteDir} 的 node_modules 里没有 ${platformPackageName}：不是平台建的站，或者还没在站点目录里运行 pnpm install`)
}

/** dev 脚本里写了 --port（含 --port=N）：启动时还要再带一个 --port，两个端口同时在，站点会认错自己的地址 */
export function devScriptHasFixedPort(devScript: string): boolean {
  return /(?:^|\s)--port(?:=|\s|$)/.test(devScript)
}

/** 站点 package.json 要有 scripts.dev，且不写死端口：端口由 gwb-docsite 启动时给，或由平台的 vite 插件随机挑 */
export function checkDevScript(siteDir: string): void {
  const file = path.join(siteDir, 'package.json')
  let manifest: unknown
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new DocsiteRejected(`${file} 读不出 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  const scripts = typeof manifest === 'object' && manifest !== null ? (manifest as Record<string, unknown>)['scripts'] : undefined
  const dev = typeof scripts === 'object' && scripts !== null ? (scripts as Record<string, unknown>)['dev'] : undefined
  if (typeof dev !== 'string') throw new DocsiteRejected(`${file} 没有 scripts.dev`)
  if (devScriptHasFixedPort(dev)) throw new DocsiteRejected(`${file} 的 scripts.dev 写死了 --port：端口由 gwb-docsite 启动时挑，把 --port 和端口号从 scripts.dev 里去掉`)
}
