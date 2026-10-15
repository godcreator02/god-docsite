import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { misplacedContentFilesOf } from '../node/content-layout.js'

function reportOf(contentDir: string, problems: readonly string[]): string {
  return `内容目录 ${contentDir} 里有 ${problems.length} 个文件放错了位置：\n${problems.map((problem) => `  ${problem}`).join('\n')}`
}

/**
 * 内容目录的文件放对了没有（规则见 node/content-layout）：build 与 dev 启动时放错了就报错停下；
 * dev 运行中增删文件时重新查，放错了在终端与浏览器的错误层里报出来
 */
export function checkContentLayout(pageDir: string): Plugin {
  let absolutePageDir = ''
  return {
    name: 'god-docsite:check-content-layout',
    configResolved(config) {
      absolutePageDir = path.resolve(config.root, pageDir)
    },
    buildStart() {
      const problems = misplacedContentFilesOf(absolutePageDir)
      if (problems.length > 0) this.error(reportOf(pageDir, problems))
    },
    configureServer(server) {
      const pageDirPrefix = `${normalizePath(absolutePageDir)}/`
      const recheck = (file: string) => {
        if (!normalizePath(file).startsWith(pageDirPrefix)) return
        const problems = misplacedContentFilesOf(absolutePageDir)
        if (problems.length === 0) return
        const message = reportOf(pageDir, problems)
        server.config.logger.error(message)
        server.ws.send({ type: 'error', err: { message, stack: '' } })
      }
      for (const event of ['add', 'unlink', 'addDir', 'unlinkDir'] as const) server.watcher.on(event, recheck)
    },
  }
}
