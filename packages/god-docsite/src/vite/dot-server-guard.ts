import path from 'node:path'
import type { Plugin } from 'vite'

const serverOnlyModulePattern = /\.server(\.[cm]?[jt]sx?)?$|\/\.server\//
const guardMarker = 'god-docsite:dot-server-guard'

/**
 * React Router 的 .server 检查拿解析结果整串匹配（以 .server.js 结尾）。dev 下 Vite 给 node_modules 里不预构建的包
 * 加 ?v= 版本查询，装进 node_modules 的功能包的 .server 模块就漏检了；build 下没有查询，React Router 照常拦。
 * 这里去掉查询再查一遍，只补 dev 下漏掉的那一种
 */
export function devDotServerGuard(): Plugin {
  return {
    name: 'god-docsite:dot-server-guard',
    apply: 'serve',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      if (this.environment.name !== 'client' || ('scan' in options && options.scan) || !importer) return
      if (options.custom?.[guardMarker]) return
      // 不带 importer 的解析 Vite 补成 <root>/index.html：React Router dev 收集样式时按 SSR 依赖的 URL 查客户端模块图，走的就是这条，不是浏览器在引用
      if (importer === path.join(this.environment.config.root, 'index.html')) return
      const resolved = await this.resolve(id, importer, { ...options, custom: { ...options.custom, [guardMarker]: true } })
      if (!resolved || !resolved.id.includes('?')) return
      if (!serverOnlyModulePattern.test(resolved.id.split('?')[0]!)) return
      const importerFromRoot = path.relative(this.environment.config.root, importer.split('?')[0]!).replaceAll('\\', '/')
      throw new Error(`Server-only module referenced by client\n\n    '${id}' imported by '${importerFromRoot}'\n`)
    },
  }
}
