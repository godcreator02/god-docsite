import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

/**
 * 只读诊断：把内容目录的文件监视事件、hotUpdate 收到的模块、各环境发出的热更新消息打成
 * `@@probe {json}` 行写到 stdout，测量脚本按时间戳对齐。不改任何模块、不触发刷新
 */
export function probeDiagnostics({ contentDirs }: { contentDirs: string[] }): Plugin {
  let absoluteContentDirs: string[] = []
  const isContentFile = (file: string) => absoluteContentDirs.some((dir) => normalizePath(file).startsWith(`${dir}/`))
  const log = (event: string, data: Record<string, unknown>) => console.log(`@@probe ${JSON.stringify({ t: Date.now(), event, ...data })}`)

  return {
    name: 'probe-diagnostics',
    configResolved(config) {
      absoluteContentDirs = contentDirs.map((dir) => normalizePath(path.resolve(config.root, dir)))
    },
    configureServer(server) {
      log('server-configured', {})
      server.watcher.on('add', (file) => isContentFile(file) && log('watcher-add', { file: normalizePath(file) }))
      server.watcher.on('unlink', (file) => isContentFile(file) && log('watcher-unlink', { file: normalizePath(file) }))
      for (const [name, environment] of Object.entries(server.environments)) {
        const hot = environment.hot
        const send = hot.send.bind(hot) as (...args: unknown[]) => void
        hot.send = ((...args: unknown[]) => {
          const [payload] = args
          const type = typeof payload === 'string' ? `custom:${payload}` : (payload as { type?: string; event?: string }).type === 'custom' ? `custom:${(payload as { event?: string }).event}` : (payload as { type?: string }).type
          // vite:invoke 是 SSR 模块运行器取模块的内部通信，不是热更新
          if (type !== 'custom:vite:invoke') log('hot-send', { environment: name, type, path: (payload as { path?: string }).path })
          send(...args)
        }) as typeof hot.send
      }
    },
    hotUpdate: {
      order: 'post',
      handler({ type, file, modules }) {
        if (!isContentFile(file) || type === 'update') return
        log('hot-update', { environment: this.environment.name, type, file, moduleIds: modules.map((module) => module.id) })
      },
    },
  }
}
