import path from 'node:path'
import { normalizePath, type Logger, type NormalizedHotChannelClient, type Plugin } from 'vite'
import { contentLayoutReportEvent, contentLayoutReportRequestEvent, type ContentLayoutReport } from '../core/dev-events.js'
import { misplacedContentFilesOf } from '../node/content-layout.js'
import { batchedCalls } from './data-dirs.js'

/** dev 运行中一批增删（git 改名几百个文件、agent 连着建几个文件）攒到最后一个之后这么久才重查一次 */
export const contentLayoutRecheckBatchMs = 300

function reportOf(contentDir: string, problems: readonly string[]): string {
  return `内容目录 ${contentDir} 里有 ${problems.length} 个文件放错了位置：\n${problems.map((problem) => `  ${problem}`).join('\n')}`
}

/**
 * dev 运行中重查一次。读目录失败（git 切分支、杀毒软件扫描时文件被占用）报成这次没查成：这里在文件监视的回调里，
 * 抛出去没有人接、开发服务会退出；下一次增删文件再查
 */
export function devContentLayoutReportOf(contentDir: string, absoluteContentDir: string): ContentLayoutReport {
  try {
    return { contentDir, problems: misplacedContentFilesOf(absoluteContentDir), checkError: null }
  } catch (error) {
    return { contentDir, problems: [], checkError: error instanceof Error ? error.message : String(error) }
  }
}

export function sameContentLayoutReport(a: ContentLayoutReport, b: ContentLayoutReport): boolean {
  return a.checkError === b.checkError && a.problems.length === b.problems.length && a.problems.every((problem, index) => problem === b.problems[index])
}

/**
 * 内容目录的文件放对了没有（规则见 node/content-layout）：build 放错了就报错停下。
 * dev 只报不拦：别人提交了一个放错的文件，不能让每个人的站都起不来。启动时与运行中增删文件后（攒一批再查）结果变了就报：
 * 终端打印，浏览器里列进平台布局的问题按钮；刚打开的页面向开发服务要一次当前结果
 */
export function checkContentLayout(pageDir: string): Plugin {
  let absolutePageDir = ''
  let isDevServer = false
  let checkedAtDevStart = false
  // configResolved 在 buildStart 与 configureServer 之前运行
  let logger!: Logger
  let latest: ContentLayoutReport = { contentDir: pageDir, problems: [], checkError: null }
  const logReport = (to: Logger, report: ContentLayoutReport) => {
    if (report.checkError !== null) to.warn(`内容目录 ${pageDir} 的放法这次没查成，下次增删文件再查：${report.checkError}`)
    else if (report.problems.length > 0) to.error(reportOf(pageDir, report.problems))
    else to.info(`内容目录 ${pageDir} 的文件都放对了`)
  }
  return {
    name: 'god-docsite:check-content-layout',
    configResolved(config) {
      absolutePageDir = path.resolve(config.root, pageDir)
      isDevServer = config.command === 'serve'
      logger = config.logger
    },
    buildStart() {
      if (!isDevServer) {
        const problems = misplacedContentFilesOf(absolutePageDir)
        if (problems.length > 0) this.error(reportOf(pageDir, problems))
        return
      }
      // dev 下每个环境（浏览器、服务端）各调一次 buildStart，只在第一次查
      if (checkedAtDevStart) return
      checkedAtDevStart = true
      latest = devContentLayoutReportOf(pageDir, absolutePageDir)
      if (latest.checkError !== null || latest.problems.length > 0) logReport(logger, latest)
    },
    configureServer(server) {
      const pageDirPrefix = `${normalizePath(absolutePageDir)}/`
      const recheck = batchedCalls(contentLayoutRecheckBatchMs, () => {
        const report = devContentLayoutReportOf(pageDir, absolutePageDir)
        if (sameContentLayoutReport(report, latest)) return
        latest = report
        logReport(server.config.logger, report)
        server.ws.send({ type: 'custom', event: contentLayoutReportEvent, data: report })
      })
      for (const event of ['add', 'unlink', 'addDir', 'unlinkDir'] as const) {
        server.watcher.on(event, (file: string) => {
          if (normalizePath(file).startsWith(pageDirPrefix)) recheck()
        })
      }
      server.ws.on(contentLayoutReportRequestEvent, (_data: unknown, client: NormalizedHotChannelClient) => client.send(contentLayoutReportEvent, latest))
    },
  }
}
