import type { Plugin } from 'vite'
import { collectionDirsOf } from './collections.js'
import { copyContentAssets } from './content-assets.js'
import { checkContentLayout } from './content-layout.js'
import { invalidateContentCollectors } from './content-collectors.js'
import { refreshPagesOnDataDirChange } from './data-dirs.js'
import { devIssuesInsteadOfViteOverlay } from './dev-overlay.js'
import { devPort } from './dev-port.js'
import { devDotServerGuard } from './dot-server-guard.js'
import { frameworkPackages } from './framework-packages.js'

export { collectionDirsOf, type CollectionDirs } from './collections.js'
export { collectorModulesToAdd } from './content-collectors.js'
export { isSitePackage } from './framework-packages.js'

export interface GodDocsiteOptions {
  /** source.config.ts 的全部导出（import * as collections from './source.config'）：内容目录由其中的集合得出 */
  collections: Record<string, unknown>
}

/**
 * 站点 vite.config.ts 的平台插件，排在 fumadocsMdx()、tailwindcss() 之后、reactRouter() 之前：
 * 按 package.json 认出平台与功能包（peer fumadocs 或导出 ./site）让它们经 Vite 处理；dev 下补查带查询的 .server 模块；内容目录增删文件时让收集内容的模块重新转换；
 * 功能包登记的数据目录变了让浏览器重新取当前页的数据；查内容目录的文件放对了没有；dev 下的问题改由平台布局的问题按钮显示、不弹 Vite 的报错层；
 * build 收尾把内容目录里的文件复制进客户端产物；开发服务没给端口就随机挑一个，并把地址告诉站点
 */
export function godDocsite({ collections }: GodDocsiteOptions): Plugin[] {
  const dirs = collectionDirsOf(collections)
  return [
    devPort(),
    frameworkPackages(),
    devDotServerGuard(),
    invalidateContentCollectors(dirs.all),
    refreshPagesOnDataDirChange(),
    devIssuesInsteadOfViteOverlay(),
    checkContentLayout(dirs.pages),
    copyContentAssets(dirs.pages),
  ]
}
