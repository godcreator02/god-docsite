import path from 'node:path'
import { normalizePath, type EnvironmentModuleNode, type Plugin } from 'vite'

/**
 * 本次热更新的模块列表里还缺的收集内容的模块。
 * id 为 null 的（只登记过地址、还没解析）不加：加进去会让服务端整体重新转换，新增文件后的第一个请求从几十毫秒拖到 8 秒
 */
export function collectorModulesToAdd(
  modules: readonly EnvironmentModuleNode[],
  collectorModules: readonly EnvironmentModuleNode[],
): EnvironmentModuleNode[] {
  return collectorModules.filter((module, index) => module.id !== null && !modules.includes(module) && collectorModules.indexOf(module) === index)
}

/**
 * 内容目录里新增或删除文件时，把用 import.meta.glob 收集文件的模块（fumadocs-mdx 生成的 .source/*、站点自己收集 TSX 与
 * HTML 页面的模块）补进本次热更新的模块列表，它们重新转换后文件清单才包含新文件。
 * Windows 上 Vite 8.3.4 对相对 base 的 glob 漏掉新增文件，这是不靠补丁 Vite 的补法；Vite 自己已经把它们放进列表时这里什么也不加。
 * 收集文件的模块在转换时按源码里有没有 import.meta.glob 认出，内容目录由站点的集合定义给出
 */
export function invalidateContentCollectors(contentDirs: readonly string[]): Plugin {
  let absoluteContentDirs: string[] = []
  const collectorFiles = new Set<string>()
  return {
    name: 'god-docsite:invalidate-content-collectors',
    apply: 'serve',
    configResolved(config) {
      absoluteContentDirs = contentDirs.map((dir) => normalizePath(path.resolve(config.root, dir)))
    },
    transform: {
      order: 'pre',
      filter: { code: 'import.meta.glob' },
      handler(_code, id) {
        const file = normalizePath(id.split('?')[0]!)
        if (!file.includes('/node_modules/')) collectorFiles.add(file)
      },
    },
    hotUpdate: {
      order: 'post',
      handler({ type, file, modules }) {
        if (type !== 'create' && type !== 'delete') return
        if (!absoluteContentDirs.some((dir) => file.startsWith(`${dir}/`))) return
        const graph = this.environment.moduleGraph
        const toAdd = collectorModulesToAdd(modules, [...collectorFiles].flatMap((collectorFile) => [...(graph.getModulesByFile(collectorFile) ?? [])]))
        if (toAdd.length === 0) return
        return [...modules, ...toAdd]
      },
    },
  }
}
