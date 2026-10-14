import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'

/** 方案 D2：内容目录新增或删除文件时，在同一进程里调 server.restart() 重建开发服务（不杀进程） */
export function restartOnContentAddOrRemove({ contentDirs }: { contentDirs: string[] }): Plugin {
  return {
    name: 'restart-on-content-add-or-remove',
    configureServer(server) {
      const absoluteContentDirs = contentDirs.map((dir) => normalizePath(path.resolve(server.config.root, dir)))
      const restartIfContent = (file: string) => {
        if (!absoluteContentDirs.some((dir) => normalizePath(file).startsWith(`${dir}/`))) return
        console.log(`@@probe ${JSON.stringify({ t: Date.now(), event: 'restart-requested', file: normalizePath(file) })}`)
        void server.restart()
      }
      server.watcher.on('add', restartIfContent)
      server.watcher.on('unlink', restartIfContent)
    },
  }
}
