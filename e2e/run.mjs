/**
 * 端到端检查：从 god-docsite 的模板生成站点到系统临时目录，装上本仓的包，分别起 dev 与 build + start，
 * 用 Playwright（headless Chromium）跑基础站组合的检查。
 *
 *   pnpm e2e                                  两种装法 × dev、start 全跑
 *   pnpm e2e --install=file --server=dev      只跑一部分
 *   pnpm e2e --keep                           跑完保留生成的站点目录
 *
 * 装法：link 把包写成 link:<仓里的包目录>；file 先 pnpm pack，再按 file:<tarball> 装，包的真实路径在 node_modules/.pnpm 下，
 * 和从 registry 装一样。每次运行的日志与结果在 %TEMP%/god-docsite-e2e/<运行时刻>/
 */
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { runBaseChecks } from './combos/base.mjs'
import { freePort, startServer, waitForHttp } from './lib/process.mjs'
import { buildPlatformPackages, buildSite, generateSite, installSite, reactRouterBin, reactRouterServeBin, testerIdentityCode, typecheckSite } from './lib/site.mjs'

const knownOptions = { install: ['link', 'file'], server: ['dev', 'start'] }

function parseArgs(argv) {
  const options = { install: knownOptions.install, server: knownOptions.server, keep: false }
  for (const arg of argv) {
    if (arg === '--keep') {
      options.keep = true
      continue
    }
    const match = /^--(install|server)=(.+)$/.exec(arg)
    if (!match) throw new Error(`认不出参数 ${arg}：可用 --install=link,file、--server=dev,start、--keep`)
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

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const runTag = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')
  // 用长路径：%TEMP% 常是 8.3 短名（GODAME~1），站点根与 Vite 解析出的模块路径对不上时，React Router 认不出路由模块、不剥 loader
  const runDir = path.join(realpathSync.native(tmpdir()), 'god-docsite-e2e', runTag)
  mkdirSync(runDir, { recursive: true })
  console.log(`运行目录 ${runDir}`)
  buildPlatformPackages(runDir)

  const report = []
  for (const installMode of options.install) {
    const siteDir = path.join(runDir, `site-${installMode}`)
    const logDir = path.join(runDir, `logs-${installMode}`)
    mkdirSync(logDir, { recursive: true })
    const feedToken = randomUUID()
    const serverEnv = { DOCSITE_IDENTITY_CODE: testerIdentityCode, DOCSITE_FEED_TOKEN: feedToken }
    const record = (server, results) => {
      for (const result of results) report.push({ installMode, server, ...result })
      for (const result of results) console.log(`${result.pass ? '通过' : '失败'} [${installMode} ${server}] ${result.name}：${result.detail}`)
    }
    try {
      generateSite({ siteDir, installMode, logDir })
      installSite(siteDir, logDir)
      // link 装法下包的 .d.mts 从仓里解析 @types/react、vite，与站点自己装的是两份，类型必然对不上；类型只在 file 装法查
      if (installMode === 'file') typecheckSite(siteDir, logDir)
      record('setup', [{ name: `生成站点、安装${installMode === 'file' ? '、typegen + tsc' : ''}`, pass: true, detail: siteDir }])
    } catch (error) {
      record('setup', [{ name: '生成站点、安装', pass: false, detail: error.message }])
      continue
    }

    if (options.server.includes('dev')) {
      const port = await freePort()
      const url = `http://127.0.0.1:${port}`
      try {
        const results = await withServer(
          { name: `dev ${installMode}`, siteDir, args: [reactRouterBin(siteDir), 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], env: serverEnv, logFile: path.join(logDir, 'dev-server.txt'), url },
          () => runBaseChecks({ baseUrl: url, mode: 'dev', siteDir, feedToken, runTag }),
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
        continue
      }
      const port = await freePort()
      const url = `http://127.0.0.1:${port}`
      try {
        const results = await withServer(
          { name: `start ${installMode}`, siteDir, args: [reactRouterServeBin(siteDir), './build/server/index.js'], env: { ...serverEnv, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production' }, logFile: path.join(logDir, 'start-server.txt'), url },
          () => runBaseChecks({ baseUrl: url, mode: 'start', siteDir, feedToken, runTag }),
        )
        record('start', results)
      } catch (error) {
        record('start', [{ name: '起 start 服务', pass: false, detail: error.message }])
      }
    }
    if (!options.keep) rmSync(siteDir, { recursive: true, force: true, maxRetries: 5 })
  }

  writeFileSync(path.join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const failed = report.filter((result) => !result.pass)
  console.log(`\n${report.length - failed.length} 项通过，${failed.length} 项失败；结果 ${path.join(runDir, 'report.json')}`)
  process.exitCode = failed.length === 0 ? 0 : 1
}

await main()
