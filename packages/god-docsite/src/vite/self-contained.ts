import { normalizePath, type Logger, type NormalizedHotChannelClient, type Plugin } from 'vite'
import { selfContainedReportEvent, selfContainedReportRequestEvent, type SelfContainedProblem, type SelfContainedReport } from '../core/dev-events.js'
import { selfContainedProblemLine, selfContainedProblemsOf } from '../node/references.js'
import { batchedCalls } from './data-dirs.js'

/** dev 运行中一批改动攒到最后一个之后这么久才重查一次 */
export const selfContainedRecheckBatchMs = 300

function reportOf(problems: readonly SelfContainedProblem[]): string {
  return `站点有 ${problems.length} 处引用不自包含，组员打开会是「本站没有这条」：\n${problems.map((problem) => `  ${selfContainedProblemLine(problem)}`).join('\n')}`
}

/** dev 运行中重查一次。查失败（功能包的 resolveReference 抛错、文件正被改写）报成这次没查成：这里在文件监视的回调里，抛出去开发服务会退出 */
async function devSelfContainedReportOf(siteDir: string): Promise<SelfContainedReport> {
  try {
    return { problems: await selfContainedProblemsOf(siteDir), checkError: null }
  } catch (error) {
    return { problems: [], checkError: error instanceof Error ? error.message : String(error) }
  }
}

function sameReport(a: SelfContainedReport, b: SelfContainedReport): boolean {
  return a.checkError === b.checkError && a.problems.length === b.problems.length && a.problems.every((problem, index) => selfContainedProblemLine(problem) === selfContainedProblemLine(b.problems[index]!))
}

/**
 * shared 站的自包含检查（规则见 node/references 的 selfContainedProblemsOf；个人站查出来总是空的）：build 没过就报错停下。
 * dev 只报不拦，和内容放法一样：启动时与站点里的 mdx 文件有改动后（攒一批再查）结果变了就报，终端打印，浏览器里列进问题按钮
 */
export function checkSelfContained(): Plugin {
  let siteDir = ''
  let isDevServer = false
  let checkedAtStart = false
  // configResolved 在 buildStart 与 configureServer 之前运行
  let logger!: Logger
  let latest: SelfContainedReport = { problems: [], checkError: null }
  const logReport = (to: Logger, report: SelfContainedReport) => {
    if (report.checkError !== null) to.warn(`自包含检查这次没查成，下次改文件再查：${report.checkError}`)
    else if (report.problems.length > 0) to.error(reportOf(report.problems))
    else to.info('站点引用的条目本站都有')
  }
  return {
    name: 'god-docsite:check-self-contained',
    configResolved(config) {
      siteDir = config.root
      isDevServer = config.command === 'serve'
      logger = config.logger
    },
    async buildStart() {
      // 每个环境（浏览器、服务端）各调一次 buildStart，只在第一次查
      if (checkedAtStart) return
      checkedAtStart = true
      if (!isDevServer) {
        const problems = await selfContainedProblemsOf(siteDir)
        if (problems.length > 0) this.error(reportOf(problems))
        return
      }
      latest = await devSelfContainedReportOf(siteDir)
      if (latest.checkError !== null || latest.problems.length > 0) logReport(logger, latest)
    },
    configureServer(server) {
      const recheck = batchedCalls(selfContainedRecheckBatchMs, () => {
        void devSelfContainedReportOf(siteDir).then((report) => {
          if (sameReport(report, latest)) return
          latest = report
          logReport(server.config.logger, report)
          server.ws.send({ type: 'custom', event: selfContainedReportEvent, data: report })
        })
      })
      const nodeModules = `${normalizePath(siteDir)}/node_modules/`
      server.watcher.on('all', (_event, file) => {
        const changed = normalizePath(file)
        if (changed.endsWith('.mdx') && !changed.startsWith(nodeModules)) recheck()
      })
      server.ws.on(selfContainedReportRequestEvent, (_data: unknown, client: NormalizedHotChannelClient) => client.send(selfContainedReportEvent, latest))
    },
  }
}
