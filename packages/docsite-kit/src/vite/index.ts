import { realpathSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type PluginOption, type ViteDevServer } from 'vite'
import type { EvaluatedModuleNode, EvaluatedModules } from 'vite/module-runner'
import { manifestFileOf, readManifest } from '../package-dirs.js'
import { tsxPageSuffix } from '@godcreator/docsite-page-sources'
import { feedStore } from '../site-feed.js'
import { feedEndpointPrefix, feedEvent, feedTokenEnvName, feedTokenHeader, isFeedChannel, type FeedMessage } from '@godcreator/docsite-ui'

/** 基础包自己的包名：要和站点自己的代码一样经 Vite 处理 */
const ownPackageName = '@godcreator/docsite-kit'

/**
 * 基础包要和站点自己的代码一样经 Vite 处理：fumadocs 由 Vite 处理，基础包若交给 Node 直接加载（服务端）或单独预打包（浏览器端），
 * 它引用的 fumadocs 就是另一份，React 上下文对不上（报 You need to wrap your application inside `FrameworkProvider`）；
 * 服务端函数也读不到 import.meta.env。接在基础包上的功能包引用基础包，同样要经 Vite 处理
 */
function processedWithSite(featurePackages: readonly string[]): Plugin {
  const packages = [ownPackageName, ...featurePackages]
  return {
    name: 'docsite-kit:processed-with-site',
    config(config) {
      const root = path.resolve(config.root ?? process.cwd())
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
 * 不预打包的包，它们自己依赖的库照样要预打包：里面有 CommonJS 的（diff-match-patch、react-markdown 底下的几个），
 * 原样送进浏览器读不出 default；站点根目录下也解析不到它们（pnpm 不把间接依赖放到顶层），要写成「包 > 依赖」
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
const pageListFiles = ['app/lib/collections.ts', 'app/lib/source.ts']

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

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => (body += chunk))
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function sendText(response: ServerResponse, status: number, text: string) {
  response.statusCode = status
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(text)
}

/** 推送通道的开发服务一侧：POST 存下最新一份并告诉浏览器，GET 回最新一份（还没推过是 null）。格式见 site-feed.ts */
function siteFeeds(): Plugin {
  return {
    name: 'docsite-kit:site-feeds',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(feedEndpointPrefix, (request, response) => {
        const channel = decodeURIComponent((request.url ?? '').replace(/^\//, '').replace(/\?.*$/, ''))
        if (!isFeedChannel(channel)) return sendText(response, 404, `频道名 ${channel} 不对：只用字母、数字、_、-`)
        if (request.method === 'GET') {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-cache')
          return response.end(JSON.stringify(feedStore().get(channel) ?? null))
        }
        if (request.method !== 'POST') return sendText(response, 405, '只收 GET 与 POST')
        const token = process.env[feedTokenEnvName]
        if (!token) return sendText(response, 403, `开发服务没有 ${feedTokenEnvName}：只有 gwb-docsite 启动的开发服务收推送`)
        if (request.headers[feedTokenHeader] !== token) return sendText(response, 403, `${feedTokenHeader} 不对`)
        void readBody(request).then((body) => {
          let data: unknown
          try {
            data = JSON.parse(body)
          } catch {
            return sendText(response, 400, '正文要是 JSON')
          }
          feedStore().set(channel, data)
          const message: FeedMessage = { channel, data }
          server.ws.send({ type: 'custom', event: feedEvent, data: message })
          sendText(response, 204, '')
        }, (error: unknown) => sendText(response, 400, `读请求正文失败：${String(error)}`))
      })
    },
  }
}

export type DocsiteOptions = {
  /** 接在基础包上的功能包（如协作站的 @godcreator/collab-site）：它们引用基础包，要和基础包一样经 Vite 处理 */
  featurePackages?: readonly string[]
}

/** 项目的 vite.config.ts 里写 plugins: [docsite(), fumadocsMdx(), tailwindcss(), reactRouter()] */
export function docsite({ featurePackages = [] }: DocsiteOptions = {}): PluginOption[] {
  return [processedWithSite(featurePackages), pageListRefresh(), siteFeeds()]
}
