/**
 * 端到端检查：用平台包的建站器（@godcreator/god-docsite/scaffold 的 createSite、addBaseFeatures、addFeature）建站到系统临时目录，
 * 装上本仓的包、补上评论这类基础功能，分别起 dev 与 build + start，用 Playwright（headless Chromium）跑各组合的检查。
 *
 *   pnpm e2e                                              两种装法 × 四种组合 × dev、start 全跑，同时跑 3 个站
 *   pnpm e2e --install=file --combo=demo --server=dev     只跑一部分
 *   pnpm e2e --jobs=1                                     一个站一个站地跑
 *   pnpm e2e --skip-build                                 不构建本仓的包：只在调用方刚构建过时用（pnpm verify）
 *   pnpm e2e --keep                                       跑完保留生成的站点目录
 *
 * 装法：link 把包写成 link:<仓里的包目录>；file 先 pnpm pack，再按 file:<tarball> 装，包的真实路径在 node_modules/.pnpm 下，
 * 和从 registry 装一样。组合：base 是基础站，demo 是基础站加 e2e/fixtures/e2e-demo 演示功能包，collab 是基础站加协作功能（站点建在协作仓布局的 site/ 下），
 * docs 是文档维护（基础站加 code-pin、trajectory、explainer）。
 * 每个「装法 × 组合」是一个站，各有自己的站点目录与日志目录；站之间并发，同一个站的 dev 与 start 先后跑。
 * 每次运行的日志与结果在 %TEMP%/god-docsite-e2e/<运行时刻>/
 */
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { runBaseChecks } from './combos/base.mjs'
import { addDemoFeatureWithChecks, runDemoChecks } from './combos/demo.mjs'
import { addCollabFeatureWithChecks, buildCollabPackage, collabSiteDirOf, generateCollabSite, packCollabPackage, runCollabChecks } from './combos/collab.mjs'
import { addDocsFeaturesWithChecks, runDocsChecks } from './combos/docs.mjs'
import { freePort, startServer, waitForHttp } from './lib/process.mjs'
import { buildPlatformPackages, buildSite, combos, generateSite, installSite, loadScaffold, packPackages, reactRouterBin, reactRouterServeBin, testerIdentityCode, typecheckSite } from './lib/site.mjs'

const knownOptions = { install: ['link', 'file'], server: ['dev', 'start'], combo: combos }
const defaultJobs = 3
const usage = `可用 --install=link,file、--server=dev,start、--combo=${combos.join(',')}、--jobs=<正整数，默认 ${defaultJobs}>、--skip-build、--keep`

function parseArgs(argv) {
  const options = { install: knownOptions.install, server: knownOptions.server, combo: knownOptions.combo, jobs: defaultJobs, skipBuild: false, keep: false }
  for (const arg of argv) {
    if (arg === '--keep') {
      options.keep = true
      continue
    }
    if (arg === '--skip-build') {
      options.skipBuild = true
      continue
    }
    const jobs = /^--jobs=(.*)$/.exec(arg)
    if (jobs) {
      if (!/^[1-9]\d*$/.test(jobs[1])) throw new Error(`--jobs 要是正整数，收到 ${jobs[1] || '空值'}`)
      options.jobs = Number(jobs[1])
      continue
    }
    const match = /^--(install|server|combo)=(.+)$/.exec(arg)
    if (!match) throw new Error(`认不出参数 ${arg}：${usage}`)
    const [, name, value] = match
    const values = value.split(',')
    const unknown = values.filter((each) => !knownOptions[name].includes(each))
    if (unknown.length > 0) throw new Error(`--${name} 只能是 ${knownOptions[name].join('、')}，收到 ${unknown.join('、')}`)
    options[name] = values
  }
  return options
}

const serverStartTimeoutMs = 180_000

async function withServer({ name, siteDir, args, env, logFile, url }, body) {
  const server = startServer({ name, cwd: siteDir, args, env, logFile })
  try {
    await waitForHttp(url, { timeoutMs: serverStartTimeoutMs, server })
    return await body()
  } finally {
    await server.stop()
  }
}

const checksOfCombo = {
  base: ({ baseUrl, mode, siteDir, feedToken, runTag }) => runBaseChecks({ baseUrl, mode, siteDir, feedToken, runTag }),
  demo: ({ baseUrl, mode, siteDir, feedToken }) => runDemoChecks({ baseUrl, mode, siteDir, feedToken }),
  collab: ({ baseUrl, mode, siteDir, feedToken, runTag }) => runCollabChecks({ baseUrl, mode, siteDir, feedToken, runTag }),
  docs: ({ baseUrl, mode, siteDir }) => runDocsChecks({ baseUrl, mode, siteDir }),
}

/** 一种装法 × 一种组合：建站、安装（demo 再加功能）、dev 与 build + start 各跑一轮检查 */
async function runSite({ options, runDir, runTag, installMode, combo, tarballs, record }) {
  const siteDir = combo === 'collab' ? collabSiteDirOf(runDir, installMode) : path.join(runDir, `site-${combo}-${installMode}`)
  const logDir = path.join(runDir, `logs-${combo}-${installMode}`)
  mkdirSync(logDir, { recursive: true })
  const feedToken = randomUUID()
  const serverEnv = { DOCSITE_IDENTITY_CODE: testerIdentityCode, DOCSITE_FEED_TOKEN: feedToken }
  try {
    if (combo === 'collab') await generateCollabSite({ siteDir, installMode, tarballs, collabTarball: tarballs?.collab, scriptPort: await freePort() })
    else await generateSite({ siteDir, installMode, combo, tarballs, scriptPort: await freePort() })
    await installSite(siteDir, logDir)
    const { addBaseFeatures, addFeature } = await loadScaffold()
    addBaseFeatures({ siteDir })
    if (combo === 'demo') record('setup', await addDemoFeatureWithChecks({ siteDir, addFeature }))
    if (combo === 'collab') record('setup', await addCollabFeatureWithChecks({ siteDir, addFeature }))
    if (combo === 'docs') record('setup', await addDocsFeaturesWithChecks({ siteDir, addFeature }))
    // link 装法下包的 .d.mts 从仓里解析 @types/react、vite，与站点自己装的是两份，类型必然对不上；类型只在 file 装法查
    if (installMode === 'file') await typecheckSite(siteDir, logDir)
    record('setup', [{ name: `建站、安装、补基础功能${installMode === 'file' ? '、typegen + tsc' : ''}`, pass: true, detail: siteDir }])
  } catch (error) {
    record('setup', [{ name: '建站、安装、补基础功能', pass: false, detail: error.message }])
    return
  }

  const runChecks = checksOfCombo[combo]
  if (options.server.includes('dev')) {
    const port = await freePort()
    const url = `http://127.0.0.1:${port}`
    try {
      const results = await withServer(
        { name: `dev ${combo} ${installMode}`, siteDir, args: [reactRouterBin(siteDir), 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], env: serverEnv, logFile: path.join(logDir, 'dev-server.txt'), url },
        () => runChecks({ baseUrl: url, mode: 'dev', siteDir, feedToken, runTag }),
      )
      record('dev', results)
    } catch (error) {
      record('dev', [{ name: '起 dev 服务', pass: false, detail: error.message }])
    }
  }

  if (options.server.includes('start')) {
    try {
      await buildSite(siteDir, logDir)
    } catch (error) {
      record('start', [{ name: 'react-router build', pass: false, detail: error.message }])
      return
    }
    const port = await freePort()
    const url = `http://127.0.0.1:${port}`
    try {
      const results = await withServer(
        { name: `start ${combo} ${installMode}`, siteDir, args: [reactRouterServeBin(siteDir), './build/server/index.js'], env: { ...serverEnv, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production' }, logFile: path.join(logDir, 'start-server.txt'), url },
        () => runChecks({ baseUrl: url, mode: 'start', siteDir, feedToken, runTag }),
      )
      record('start', results)
    } catch (error) {
      record('start', [{ name: '起 start 服务', pass: false, detail: error.message }])
    }
  }
  if (!options.keep) rmSync(siteDir, { recursive: true, force: true, maxRetries: 5 })
}

/** 最多同时跑 jobs 个任务；任务自己不抛错（失败记进报告），一个任务结束就接着拿下一个 */
async function runWithLimit(tasks, jobs) {
  const queue = [...tasks]
  const worker = async () => {
    for (let task = queue.shift(); task !== undefined; task = queue.shift()) await task()
  }
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, worker))
}

const serverOrder = ['setup', 'dev', 'start']

/** 报告按组合、装法、服务排好：并发时各站记录的先后不定，排好后两次运行的 report.json 能直接比对；同一轮里的检查保持原来的先后 */
function sortedReport(report, options) {
  const rank = (result) => [options.combo.indexOf(result.combo), options.install.indexOf(result.installMode), serverOrder.indexOf(result.server)]
  return report
    .map((result, index) => ({ result, index }))
    .sort((a, b) => {
      const [ra, rb] = [rank(a.result), rank(b.result)]
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
      return a.index - b.index
    })
    .map(({ result }) => result)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const startedAt = Date.now()
  const runTag = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')
  // 用长路径：%TEMP% 常是 8.3 短名（GODAME~1），站点根与 Vite 解析出的模块路径对不上时，React Router 认不出路由模块、不剥 loader
  const runDir = path.join(realpathSync.native(tmpdir()), 'god-docsite-e2e', runTag)
  mkdirSync(runDir, { recursive: true })
  console.log(`运行目录 ${runDir}，同时跑 ${options.jobs} 个站`)
  if (!options.skipBuild) {
    buildPlatformPackages(runDir)
    if (options.combo.includes('collab')) buildCollabPackage(runDir)
  }
  const tarballs = options.install.includes('file') ? packPackages(path.join(runDir, 'tarballs'), runDir) : undefined
  if (tarballs !== undefined && options.combo.includes('collab')) tarballs.collab = packCollabPackage(path.join(runDir, 'tarballs'), runDir)

  const report = []
  const tasks = options.install.flatMap((installMode) =>
    options.combo.map((combo) => async () => {
      const label = `${combo} ${installMode}`
      const siteStartedAt = Date.now()
      console.log(`开始 [${label}]`)
      const record = (server, results) => {
        for (const result of results) report.push({ combo, installMode, server, ...result })
        for (const result of results) console.log(`${result.pass ? '通过' : '失败'} [${label} ${server}] ${result.name}：${result.detail}`)
      }
      await runSite({ options, runDir, runTag, installMode, combo, tarballs, record })
      console.log(`结束 [${label}]，用时 ${Math.round((Date.now() - siteStartedAt) / 1000)} 秒`)
    }),
  )
  await runWithLimit(tasks, options.jobs)

  const sorted = sortedReport(report, options)
  writeFileSync(path.join(runDir, 'report.json'), `${JSON.stringify(sorted, null, 2)}\n`)
  const failed = sorted.filter((result) => !result.pass)
  for (const combo of options.combo) {
    const ofCombo = sorted.filter((result) => result.combo === combo)
    console.log(`组合 ${combo}：${ofCombo.filter((result) => result.pass).length}/${ofCombo.length} 项通过`)
  }
  for (const result of failed) console.log(`失败 [${result.combo} ${result.installMode} ${result.server}] ${result.name}：${result.detail}`)
  console.log(`\n${sorted.length - failed.length} 项通过，${failed.length} 项失败，总耗时 ${Math.round((Date.now() - startedAt) / 1000)} 秒；结果 ${path.join(runDir, 'report.json')}`)
  process.exitCode = failed.length === 0 ? 0 : 1
}

await main()
