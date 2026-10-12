import { realpathSync } from 'node:fs'
import path from 'node:path'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type PluginOption, type ViteDevServer } from 'vite'
import type { EvaluatedModuleNode, EvaluatedModules } from 'vite/module-runner'
import { manifestFileOf, readManifest } from '../package-dirs.js'
import { tsxPageSuffix } from '@godcreator/docsite-page-sources'
import { feedDevServer } from '@godcreator/docsite-feed'

/** 基础包自己的包名：要和站点自己的代码一样经 Vite 处理 */
const ownPackageName = '@godcreator/docsite-kit'
/** 骨架或功能包会带进站的能力包：与基础包同因要经 Vite 处理——workspace 内 pnpm 链接让 fumadocs 侥幸单例，从 registry 安装的站会解析出多份实例 */
const capabilityPackages = [
  '@godcreator/docsite-identity',
  '@godcreator/docsite-comments',
  '@godcreator/docsite-page-sources',
  '@godcreator/docsite-ui',
  '@godcreator/docsite-writing',
  '@godcreator/docsite-feed',
  '@godcreator/docsite-explainer',
  '@godcreator/docsite-docfirst',
]

/**
 * 基础包与能力包要和站点自己的代码一样经 Vite 处理：fumadocs 由 Vite 处理，它们若交给 Node 直接加载（服务端）或单独预打包（浏览器端），
 * 它们引用的 fumadocs 就是另一份，React 上下文对不上（报 You need to wrap your application inside `FrameworkProvider`）；
 * 服务端函数也读不到 import.meta.env。接在基础包上的功能包引用基础包，同样要经 Vite 处理
 */
function processedWithSite(featurePackages: readonly string[]): Plugin {
  return {
    name: 'docsite-kit:processed-with-site',
    config(config) {
      const root = path.resolve(config.root ?? process.cwd())
      // 能力包按站点实际装着的算（feed、explainer 这类骨架不直接用的可以不装）；功能包是调用方显式给的，没装就报错
      const installedCapabilities = capabilityPackages.filter((name) => manifestFileOf(root, name) !== null)
      const packages = [ownPackageName, ...installedCapabilities, ...featurePackages]
      return {
        ssr: { noExternal: packages },
        optimizeDeps: { exclude: packages, include: nestedDependenciesOf(root, packages) },
        // 功能包里的路由模块经 @site 读骨架里的模块（页面树、MDX 组件、功能包复制进来的集合文件），类型见 ./site-modules
        resolve: { alias: { '@site': path.join(root, 'app') } },
      }
    },
  }
}

/**
 * 不预打包的包，它们自己声明的依赖照样要预打包：这些依赖在站点根目录下解析不到（pnpm 不把间接依赖放到顶层），
 * 要写成「包 > 依赖」的形式
 */
function nestedDependenciesOf(root: string, packages: readonly string[]): string[] {
  return packages.flatMap((name) => {
    const manifestFile = manifestFileOf(root, name)
    if (manifestFile === null) throw new Error(`站点的 node_modules 里没有 ${name}：在站点目录运行 pnpm install`)
    const { dependencies = {} } = readManifest(manifestFile)
    return Object.keys(dependencies)
      .filter((dependency) => !packages.includes(dependency) && hasRootEntry(path.dirname(realpathSync(manifestFile)), dependency))
      .map((dependency) => `${name} > ${dependency}`)
  })
}

/** 依赖有没有根出口：只有子路径出口的包（如 @godcreator/collab-model）没法整个预打包，它的子路径由 Vite 按用到的去找 */
function hasRootEntry(fromDir: string, name: string): boolean {
  const manifestFile = manifestFileOf(fromDir, name)
  if (manifestFile === null) throw new Error(`${fromDir} 往上找不到依赖 ${name}：在站点目录运行 pnpm install`)
  const { exports } = readManifest(manifestFile)
  if (exports === undefined || typeof exports === 'string' || Array.isArray(exports)) return true
  const keys = Object.keys(exports as object)
  return !keys.some((key) => key.startsWith('.')) || keys.includes('.')
}

/** 放页面与评论的目录、列出它们的模块，都相对站点根；项目骨架就是这样摆的 */
const contentDirs = ['content', 'comments']
const pageListFiles = ['app/lib/collections.ts', 'app/lib/source.server.ts']

/**
 * 改 TSX 页面时，让列出页面的模块重新生成，再让浏览器整页刷新。改别的文件不经过这里，照 Vite 与 React Router 的默认处理。
 * 目录里新增、删除文件不再拦：Windows 上 glob 相对 base 的缺陷已由仓内补丁修复（patches/vite@8.3.4.patch），
 * 原生链路自己能发现新增文件（清理清单 #3）。要补的只剩：改 TSX 页面默认走组件热替换，正文变了但页面树里的标题还是旧的（布局的 loader 不重新运行）
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
        if (type !== 'update' || !changed.endsWith(tsxPageSuffix)) return
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


export type DocsiteOptions = {
  /** 接在基础包上的功能包（如协作站的 @godcreator/collab-site）：它们引用基础包，要和基础包一样经 Vite 处理 */
  featurePackages?: readonly string[]
}

/** 项目的 vite.config.ts 里写 plugins: [docsite(), fumadocsMdx(), tailwindcss(), reactRouter()] */
export function docsite({ featurePackages = [] }: DocsiteOptions = {}): PluginOption[] {
  return [processedWithSite(featurePackages), pageListRefresh(), feedDevServer()]
}
