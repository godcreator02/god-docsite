import { normalizePath, type Plugin } from 'vite'
import { dataDirsChangedEvent } from '../core/dev-events.js'
import { hostChannel, type HostContext } from '../core/host-context.js'
import { feedHub, subscribeFeedHub } from '../node/feed-hub.js'
import { batchedCalls, dataDirsChangeBatchMs } from './data-dirs.js'

function providedDirsOf(context: HostContext): string[] {
  return [...new Set(Object.values(context.dirs ?? {}).map((dir) => normalizePath(dir)))]
}

/**
 * dev 下盯住托管方上下文里的本机目录（个人站读的论文库、资料库），有文件增删改就让浏览器重新取当前页的数据。
 * vite 插件和站点的服务端代码在同一个进程里，频道 host 的值一变（插件登记或撤销目录、身份码与字体改了）就跟着换盯的目录，
 * 并让浏览器重新取一次数据，页面不用刷新就用上新的上下文
 */
export function refreshPagesOnProvidedDirChange(): Plugin {
  return {
    name: 'god-docsite:refresh-pages-on-provided-dir-change',
    apply: 'serve',
    configureServer(server) {
      let watchedDirs: string[] = []
      const notifyBrowsers = batchedCalls(dataDirsChangeBatchMs, () => server.ws.send({ type: 'custom', event: dataDirsChangedEvent }))
      // 推进来时 feed.server 已经核对过形状
      const followHostContext = (context: unknown) => {
        const dirs = providedDirsOf(context as HostContext)
        const removed = watchedDirs.filter((dir) => !dirs.includes(dir))
        const added = dirs.filter((dir) => !watchedDirs.includes(dir))
        if (removed.length > 0) server.watcher.unwatch(removed)
        if (added.length > 0) server.watcher.add(added)
        watchedDirs = dirs
        notifyBrowsers()
      }
      const current = feedHub().latest.get(hostChannel)
      if (current !== undefined) followHostContext(current)
      const unsubscribe = subscribeFeedHub(hostChannel, followHostContext)
      server.httpServer?.once('close', unsubscribe)
      server.watcher.on('all', (_event, file) => {
        const changed = normalizePath(file)
        if (watchedDirs.some((dir) => changed === dir || changed.startsWith(`${dir}/`))) notifyBrowsers()
      })
    },
  }
}
