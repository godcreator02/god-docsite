/**
 * 日常的端到端检查：在仓里的测试站 full-test/site（基础站 + 全部功能）上直接启动 dev 与 build + start，用 Playwright（headless Chromium）跑全部检查。
 * 不建站、不装依赖；站点用的是工作区里各包的构建产物。
 *
 *   pnpm test:e2e                   先构建测试站依赖的本仓包，dev、start 两轮都跑
 *   pnpm test:e2e --server=dev      只跑一部分
 *   pnpm test:e2e --skip-build      不构建本仓的包：只在调用方刚构建过时用（pnpm verify）
 *
 * 检查只在站里新建带本次运行编号的东西，每轮跑完删掉；最后一项检查 git status full-test 和跑之前一样。
 * 日志与 report.json 在 %TEMP%/god-docsite-e2e/repo-<运行时刻>/。用打包装法查同样这些检查的是 pnpm test:pack（tests/e2e/pack.mjs），发版前跑
 */
import { fullTestGitStatus, createRecorder, finishRun, parseOptions, startRun, unchangedGitStatusResult } from './lib/report.mjs'
import { runRounds } from './lib/rounds.mjs'
import { buildSitePackages, fullTestSiteDir } from './lib/site.mjs'

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const { runTag, runDir, startedAt } = startRun('repo')
  console.log(`运行编号 ${runTag}，日志目录 ${runDir}`)
  const statusBefore = fullTestGitStatus()
  const { report, record } = createRecorder()
  if (!options.skipBuild) buildSitePackages(runDir)
  await runRounds({ siteDir: fullTestSiteDir, servers: options.servers, logDir: runDir, runTag, record })
  record('repo', 'after', [unchangedGitStatusResult(statusBefore)])
  finishRun({ report, runDir, startedAt })
}

await main()
