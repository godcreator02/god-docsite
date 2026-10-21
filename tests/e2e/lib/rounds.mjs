import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { chromium } from 'playwright'
import { runAllFeaturesChecks, runRouteTableChecks } from '../checks/all-features.mjs'
import { runBaseChecks } from '../checks/base.mjs'
import { runCollabChecks } from '../checks/collab.mjs'
import { runDocsChecks } from '../checks/docs.mjs'
import { runLibraryChecks } from '../checks/library.mjs'
import { runReportChecks } from '../checks/report.mjs'
import { freePort, startServer, waitForHttp } from './process.mjs'
import { removeRunLeftovers, writeTitlePage } from './run-scratch.mjs'
import { buildSite, reactRouterBin, reactRouterServeBin, testerIdentityCode } from './site.mjs'

export const serverModes = ['dev', 'start']

/** 每一轮（dev、start）按这个先后跑；collab 组里推送的通知会让测试员成为负责人，要排在它自己的删除检查之后，所以各组不并发 */
const checkGroups = [
  { name: 'base', run: runBaseChecks },
  { name: 'collab', run: runCollabChecks },
  { name: 'docs', run: runDocsChecks },
  { name: 'report', run: runReportChecks },
  { name: 'all-features', run: runAllFeaturesChecks },
  { name: 'library', run: runLibraryChecks },
]

const serverStartTimeoutMs = 180_000

/** 和 gwb-docsite 一样：开发服务起来以后把托管方上下文推进频道 host，站点从里面取测试员的身份码 */
async function pushHostContext(url, feedToken) {
  const response = await fetch(new URL('/__docsite/feed/host', url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-docsite-token': feedToken },
    body: JSON.stringify({ format: 1, identityCode: testerIdentityCode, readerFonts: { body: null, heading: null, mono: null } }),
  })
  if (!response.ok) throw new Error(`推托管方上下文，站点回 ${response.status}：${await response.text()}`)
}

async function withServer({ name, siteDir, args, env, logFile, url, afterReady }, body) {
  const server = startServer({ name, cwd: siteDir, args, env, logFile })
  try {
    await waitForHttp(url, { timeoutMs: serverStartTimeoutMs, server })
    await afterReady?.()
    return await body()
  } finally {
    await server.stop()
  }
}

async function runCheckGroups({ browser, baseUrl, mode, siteDir, feedToken, runTag, record }) {
  for (const group of checkGroups) {
    try {
      record(group.name, mode, await group.run({ browser, baseUrl, mode, siteDir, feedToken, runTag }))
    } catch (error) {
      record(group.name, mode, [{ name: `跑 ${group.name} 组`, pass: false, detail: `抛错：${error.message}` }])
    }
  }
}

function cleanUpRound({ siteDir, runTag, mode }) {
  const removed = removeRunLeftovers(siteDir, runTag)
  console.log(`${mode} 这一轮跑完，删掉本次运行建的 ${removed.length} 处：${removed.map((file) => path.relative(siteDir, file)).join('、') || '无'}`)
}

async function devRound({ browser, siteDir, logDir, runTag, serverEnv, feedToken, record }) {
  writeTitlePage(siteDir, runTag)
  try {
    const port = await freePort()
    const url = `http://127.0.0.1:${port}`
    await withServer(
      {
        name: 'dev',
        siteDir,
        args: [reactRouterBin(siteDir), 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        env: serverEnv,
        logFile: path.join(logDir, 'dev-server.txt'),
        url,
        afterReady: () => pushHostContext(url, feedToken),
      },
      () => runCheckGroups({ browser, baseUrl: url, mode: 'dev', siteDir, feedToken, runTag, record }),
    )
  } catch (error) {
    record('server', 'dev', [{ name: '起 dev 服务', pass: false, detail: error.message }])
  } finally {
    cleanUpRound({ siteDir, runTag, mode: 'dev' })
  }
}

async function startRound({ browser, siteDir, logDir, runTag, serverEnv, feedToken, record }) {
  try {
    await buildSite(siteDir, logDir)
  } catch (error) {
    record('server', 'start', [{ name: 'react-router build', pass: false, detail: error.message }])
    return
  }
  try {
    const port = await freePort()
    const url = `http://127.0.0.1:${port}`
    await withServer(
      { name: 'start', siteDir, args: [reactRouterServeBin(siteDir), './build/server/index.js'], env: { ...serverEnv, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production' }, logFile: path.join(logDir, 'start-server.txt'), url },
      () => runCheckGroups({ browser, baseUrl: url, mode: 'start', siteDir, feedToken, runTag, record }),
    )
  } catch (error) {
    record('server', 'start', [{ name: '起 start 服务', pass: false, detail: error.message }])
  } finally {
    cleanUpRound({ siteDir, runTag, mode: 'start' })
  }
}

/**
 * 在一个已装好依赖的测试站上跑检查：先静态查路由表，再按 servers 起 dev、build + start 各一轮，每轮跑全部检查组。
 * record(group, server, results) 收结果；每轮结束删掉本次运行在站里建的东西
 */
export async function runRounds({ siteDir, servers, logDir, runTag, record }) {
  record('all-features', 'static', await runRouteTableChecks({ siteDir }))
  const feedToken = randomUUID()
  const serverEnv = { DOCSITE_FEED_TOKEN: feedToken }
  const browser = await chromium.launch({ headless: true })
  try {
    const round = { browser, siteDir, logDir, runTag, serverEnv, feedToken, record }
    if (servers.includes('dev')) await devRound(round)
    if (servers.includes('start')) await startRound(round)
  } finally {
    await browser.close()
  }
}
