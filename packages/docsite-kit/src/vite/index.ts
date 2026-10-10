import path from 'node:path'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type PluginOption, type ViteDevServer } from 'vite'
import type { EvaluatedModuleNode, EvaluatedModules } from 'vite/module-runner'
import { tsxPageSuffix } from '../page-sources.js'

/** 基础包自己的包名：要和站点自己的代码一样经 Vite 处理 */
const ownPackageName = '@godcreator/docsite-kit'

/**
 * 基础包要和站点自己的代码一样经 Vite 处理：fumadocs 由 Vite 处理，基础包若交给 Node 直接加载（服务端）或单独预打包（浏览器端），
 * 它引用的 fumadocs 就是另一份，React 上下文对不上（报 You need to wrap your application inside `FrameworkProvider`）
 */
function processedWithSite(): Plugin {
  return {
    name: 'docsite-kit:processed-with-site',
    config() {
      return { ssr: { noExternal: [ownPackageName] }, optimizeDeps: { exclude: [ownPackageName] } }
    },
  }
}

/** 放页面的目录与列出页面的模块，都相对站点根；项目骨架就是这样摆的 */
const contentDirs = ['content']
const pageListFiles = ['app/lib/collections.ts', 'app/lib/source.ts']

/**
 * 页面目录里新增、删除文件（改名是一删一增）以及改 TSX 页面时，让列出页面的模块重新生成，再让浏览器整页刷新。
 * 改别的文件不经过这里，照 Vite 与 React Router 的默认处理。
 * 要补这一处：defineDocs 展开出的 import.meta.glob 带 base 选项，Vite 在文件增减时不让它失效，开发服务端一直拿着旧清单，新页面直接 404；
 * 改 TSX 页面默认走组件热替换，正文变了但页面树里的标题还是旧的（布局的 loader 不重新运行）
 */
function pageListRefresh(): Plugin {
  let watchedDirs: string[] = []
  let listFiles: string[] = []
  return {
    name: 'docsite-kit:page-list-refresh',
    configResolved(config) {
      const resolve = (relative: string) => normalizePath(path.resolve(config.root, relative))
      watchedDirs = contentDirs.map(resolve)
      listFiles = pageListFiles.map(resolve)
    },
    hotUpdate: {
      order: 'pre',
      handler({ type, file, server }) {
        const changed = normalizePath(file)
        if (!watchedDirs.some((dir) => changed.startsWith(`${dir}/`))) return
        if (type === 'update' && !changed.endsWith(tsxPageSuffix)) return
        // 浏览器一侧与开发服务端一侧各调用一次；两边的失效都在浏览器一侧这一次里做完，再让浏览器刷新，免得刷新后的请求赶在开发服务端失效之前。
        // 改了的 TSX 页面本身也要在模块运行器里失效：这里拦下了默认的热更新，运行器不会自己去失效它
        if (this.environment.name === 'client') {
          for (const target of [changed, ...listFiles]) invalidateInBothEnvironments(server, target)
          this.environment.hot.send({ type: 'full-reload' })
        }
        return []
      },
    },
  }
}

function invalidateInBothEnvironments(server: ViteDevServer, file: string) {
  for (const environment of [server.environments.client, server.environments.ssr]) {
    for (const module of environment.moduleGraph.getModulesByFile(file) ?? []) environment.moduleGraph.invalidateModule(module)
  }
  const ssr = server.environments.ssr
  if (!isRunnableDevEnvironment(ssr)) throw new Error('开发服务端不是 RunnableDevEnvironment，没法让模块运行器里的页面清单失效')
  invalidateWithImporters(ssr.runner.evaluatedModules, file)
}

/**
 * 开发服务端的模块运行器里，让这个文件的模块和它一路往上的引用者失效，下一次请求运行 loader 时重新加载。
 * 不用 full-reload：它清空整个运行器再重新加载入口，改名连着两个事件，两次重新加载重叠时 react-dom 被当成内联模块执行而报错
 */
function invalidateWithImporters(evaluatedModules: EvaluatedModules, file: string) {
  const pending = [...(evaluatedModules.getModulesByFile(file) ?? [])]
  const invalidated = new Set<EvaluatedModuleNode>()
  while (pending.length > 0) {
    const node = pending.pop()!
    if (invalidated.has(node)) continue
    evaluatedModules.invalidateModule(node)
    invalidated.add(node)
    for (const importerId of node.importers) {
      const importer = evaluatedModules.getModuleById(importerId)
      if (importer) pending.push(importer)
    }
  }
}

/** 项目的 vite.config.ts 里写 plugins: [docsite(), fumadocsMdx(), tailwindcss(), reactRouter()] */
export function docsite(): PluginOption[] {
  return [processedWithSite(), pageListRefresh()]
}
