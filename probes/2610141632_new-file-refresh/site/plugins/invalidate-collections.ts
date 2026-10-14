import path from 'node:path'
import { normalizePath, type EnvironmentModuleNode, type Plugin } from 'vite'

/**
 * 方案 C：内容目录里新增或删除文件时，把用 import.meta.glob 收集这些文件的模块补进本次热更新的模块列表，
 * 效果等同 Vite 修好以后 vite:import-glob 自己会做的事。只用公开接口（hotUpdate、moduleGraph），
 * 不解析 fumadocs 生成的代码；order: 'post' 排在核心插件之后，已经在列表里的模块不重复加。
 * id 为空的模块节点（只登记过地址、还没解析）不加：加进去会让服务端整体重新转换，首个请求从几十毫秒拖到 8 秒。
 * reloadClient 为真时，浏览器一侧不走模块热替换，直接整页刷新（侧栏的页面树才会换成新的）
 */
export function invalidateCollectionsOnAddOrRemove({ collectionFiles, contentDirs, reloadClient = false }: { collectionFiles: string[]; contentDirs: string[]; reloadClient?: boolean }): Plugin {
  let absoluteCollectionFiles: string[] = []
  let absoluteContentDirs: string[] = []
  return {
    name: 'invalidate-collections-on-add-or-remove',
    configResolved(config) {
      absoluteCollectionFiles = collectionFiles.map((file) => normalizePath(path.resolve(config.root, file)))
      absoluteContentDirs = contentDirs.map((dir) => normalizePath(path.resolve(config.root, dir)))
    },
    hotUpdate: {
      order: 'post',
      handler({ type, file, modules }) {
        if (type !== 'create' && type !== 'delete') return
        if (!absoluteContentDirs.some((dir) => file.startsWith(`${dir}/`))) return
        const collectionModules = absoluteCollectionFiles.flatMap((collectionFile) => [...(this.environment.moduleGraph.getModulesByFile(collectionFile) ?? [])])
        const missing = collectionModules.filter((module: EnvironmentModuleNode) => module.id !== null && !modules.includes(module))
        if (reloadClient && this.environment.name === 'client') {
          // 先让浏览器端的集合模块失效，刷新后才会重新转换、拿到新的文件清单
          for (const module of [...modules, ...missing]) this.environment.moduleGraph.invalidateModule(module)
          this.environment.hot.send({ type: 'full-reload' })
          return []
        }
        if (missing.length === 0) return
        return [...modules, ...missing]
      },
    },
  }
}
