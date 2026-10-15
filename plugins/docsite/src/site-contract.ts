import { existsSync } from 'node:fs'
import path from 'node:path'
import { DocsiteRejected } from './errors.js'
import { platformPackageName } from './scaffold/platform.js'

/**
 * 托管前核对站点建在平台包上：启动方式（scripts.dev 写 --port）、身份与推送的环境变量、评论写入路由都是平台模板定的。
 * 旧地基 @godcreator/docsite-kit 的站评论接口不同，本插件不托管
 */
export function checkPlatformInstalled(siteDir: string): void {
  if (existsSync(path.join(siteDir, 'node_modules', ...platformPackageName.split('/'), 'package.json'))) return
  if (existsSync(path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit', 'package.json'))) {
    throw new DocsiteRejected(`${siteDir} 建在旧地基 @godcreator/docsite-kit 上：本插件只托管建在 ${platformPackageName} 上的站，先把站点迁到新平台`)
  }
  throw new DocsiteRejected(`${siteDir} 的 node_modules 里没有 ${platformPackageName}：不是平台建的站，或者还没在站点目录里运行 pnpm install`)
}
