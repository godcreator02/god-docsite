/**
 * 端到端检查：用平台包的建站器（@godcreator/god-docsite/scaffold 的 createSite、addFeature）建站到系统临时目录，
 * 装上本仓的包，分别起 dev 与 build + start，用 Playwright（headless Chromium）跑各组合的检查。
 *
 *   pnpm e2e                                              两种装法 × 两种组合 × dev、start 全跑
 *   pnpm e2e --install=file --combo=demo --server=dev     只跑一部分
 *   pnpm e2e --keep                                       跑完保留生成的站点目录
 *
 * 装法：link 把包写成 link:<仓里的包目录>；file 先 pnpm pack，再按 file:<tarball> 装，包的真实路径在 node_modules/.pnpm 下，
 * 和从 registry 装一样。组合：base 是基础站，demo 是基础站加 e2e/fixtures/e2e-demo 演示功能包，collab 是基础站加协作功能（站点建在协作仓布局的 site/ 下）。
 * 每次运行的日志与结果在 %TEMP%/god-docsite-e2e/<运行时刻>/
 */
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { runBaseChecks } from './combos/base.mjs'
import { addDemoFeatureWithChecks, runDemoChecks } from './combos/demo.mjs'
import { addCollabFeatureWithChecks, buildCollabPackage, collabSiteDirOf, generateCollabSite, packCollabPackage, runCollabChecks } from './combos/collab.mjs'
import { freePort, startServer, waitForHttp } from './lib/process.mjs'
import { buildPlatformPackages, buildSite, combos, generateSite, installSite, loadScaffold, packPackages, reactRouterBin, reactRouterServeBin, testerIdentityCode, typecheckSite } from './lib/site.mjs'

const knownOptions = { install: ['link', 'file'], server: ['dev', 'start'], combo: combos }

function parseArgs(argv) {
  const options = { install: knownOptions.install, server: knownOptions.server, combo: knownOptions.combo, keep: false }
  for (const arg of argv) {
    if (arg === '--keep') {
      options.keep = true
      continue
    }
    const match = /^--(install|server|combo)=(.+)$/.exec(arg)
    if (!match) throw new Error(`认不出参数 ${arg}：可用 --install=link,file、--server=dev,start、--combo=${combos.join(',')}、--keep`)
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
    installSite(siteDir, logDir)
    if (combo === 'demo') {
      const { addFeature } = await loadScaffold()
      record('setup', await addDemoFeatureWithChecks({ siteDir, addFeature }))
    }
    if (combo === 'collab') {
      const { addFeature } = await loadScaffold()
      record('setup', await addCollabFeatureWithChecks({ siteDir, addFeature }))
    }
    // link 装法下包的 .d.mts 从仓里解析 @types/react、vite，与站点自己装的是两份，类型必然对不上；类型只在 file 装法查
    if (installMode === 'file') typecheckSite(siteDir, logDir)
    record('setup', [{ name: `建站、安装${installMode === 'file' ? '、typegen + tsc' : ''}`, pass: true, detail: siteDir }])
  } catch (error) {
    record('setup', [{ name: '建站、安装', pass: false, detail: error.message }])
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
      buildSite(siteDir, logDir)
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

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const runTag = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')
  // 用长路径：%TEMP% 常是 8.3 短名（GODAME~1），站点根与 Vite 解析出的模块路径对不上时，React Router 认不出路由模块、不剥 loader
  const runDir = path.join(realpathSync.native(tmpdir()), 'god-docsite-e2e', runTag)
  mkdirSync(runDir, { recursive: true })
  console.log(`运行目录 ${runDir}`)
  buildPlatformPackages(runDir)
  if (options.combo.includes('collab')) buildCollabPackage(runDir)
  const tarballs = options.install.includes('file') ? packPackages(path.join(runDir, 'tarballs'), runDir) : undefined
  if (tarballs !== undefined && options.combo.includes('collab')) tarballs.collab = packCollabPackage(path.join(runDir, 'tarballs'), runDir)

  const report = []
  for (const installMode of options.install) {
    for (const combo of options.combo) {
      const record = (server, results) => {
        for (const result of results) report.push({ combo, installMode, server, ...result })
        for (const result of results) console.log(`${result.pass ? '通过' : '失败'} [${combo} ${installMode} ${server}] ${result.name}：${result.detail}`)
      }
      await runSite({ options, runDir, runTag, installMode, combo, tarballs, record })
    }
  }

  writeFileSync(path.join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const failed = report.filter((result) => !result.pass)
  for (const combo of options.combo) {
    const ofCombo = report.filter((result) => result.combo === combo)
    console.log(`组合 ${combo}：${ofCombo.filter((result) => result.pass).length}/${ofCombo.length} 项通过`)
  }
  console.log(`\n${report.length - failed.length} 项通过，${failed.length} 项失败；结果 ${path.join(runDir, 'report.json')}`)
  process.exitCode = failed.length === 0 ? 0 : 1
}

await main()
