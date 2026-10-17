// 测试站 full-test/site 的 dev 运行中，整个删掉 content 下一个有很多子目录的组，看开发服务会不会退出：
//   node probes/2610171030_dev-content-dir-vanish/run.mjs [轮数]      （在仓根运行，默认 5 轮）
// 每轮新建 content/zz-vanish-<运行编号>-<轮>/（40 个子组，每组 meta.json、5 个页面、一个带 5 个文件的同名文件夹），
// 等文件监视收完，再用另一个进程 rmSync 整个删掉，等 3 秒后看服务还在不在、首页回不回。日志写进本目录 runs/。
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { freePort, startServer, waitForHttp } from '../../tests/e2e/lib/process.mjs'
import { fullTestSiteDir, reactRouterBin } from '../../tests/e2e/lib/site.mjs'

const rounds = Number(process.argv[2] ?? 5)
const probeDir = path.dirname(fileURLToPath(import.meta.url))
const runTag = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const runsDir = path.join(probeDir, 'runs')
mkdirSync(runsDir, { recursive: true })
const contentDir = path.join(fullTestSiteDir, 'content')

function writeVanishingGroup(groupDir) {
  writeFileSync(path.join(groupDir, 'meta.json'), JSON.stringify({ title: '删除试验' }))
  for (let sub = 0; sub < 40; sub++) {
    const subDir = path.join(groupDir, `sub-${sub}`)
    mkdirSync(path.join(subDir, 'page-0'), { recursive: true })
    writeFileSync(path.join(subDir, 'meta.json'), JSON.stringify({ title: `子组 ${sub}` }))
    for (let page = 0; page < 5; page++) writeFileSync(path.join(subDir, `page-${page}.mdx`), `---\ntitle: 页 ${page}\n---\n\n正文\n`)
    for (let asset = 0; asset < 5; asset++) writeFileSync(path.join(subDir, 'page-0', `asset-${asset}.txt`), 'x')
  }
}

const port = await freePort()
const url = `http://127.0.0.1:${port}/`
const server = startServer({
  name: 'dev',
  cwd: fullTestSiteDir,
  args: [reactRouterBin(fullTestSiteDir), 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  env: {},
  logFile: path.join(runsDir, `${runTag}-dev-server.txt`),
})
const results = []
try {
  await waitForHttp(url, { timeoutMs: 120_000, server })
  for (let round = 1; round <= rounds; round++) {
    const groupDir = path.join(contentDir, `zz-vanish-${runTag}-${round}`)
    mkdirSync(groupDir, { recursive: true })
    writeVanishingGroup(groupDir)
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    spawnSync(process.execPath, ['-e', `require('node:fs').rmSync(${JSON.stringify(groupDir)}, { recursive: true, force: true })`], { stdio: 'inherit' })
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    const alive = server.child.exitCode === null
    let status = null
    if (alive) status = (await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(() => null))?.status ?? null
    results.push({ round, alive, status })
    console.log(`第 ${round} 轮：服务${alive ? '还在' : `已退出（exit ${server.child.exitCode}）`}，首页 ${status ?? '没回'}`)
    if (!alive) break
  }
} finally {
  for (let round = 1; round <= rounds; round++) {
    const groupDir = path.join(contentDir, `zz-vanish-${runTag}-${round}`)
    if (existsSync(groupDir)) rmSync(groupDir, { recursive: true, force: true })
  }
  await server.stop()
}
const crashed = results.some((result) => !result.alive)
const output = server.output()
const enoent = output.match(/ENOENT[^\n]*scandir[^\n]*/)?.[0] ?? null
const summary = { runTag, rounds: results, crashed, enoent }
writeFileSync(path.join(runsDir, `${runTag}-result.txt`), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
process.exit(crashed ? 1 : 0)
