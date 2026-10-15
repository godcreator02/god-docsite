import { spawnSync } from 'node:child_process'
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { serverModes } from './rounds.mjs'
import { repoDir } from './site.mjs'

/** --server=dev,start 只跑一部分；--skip-build 不构建本仓的包（调用方刚构建过时用）；认不出的参数直接报错 */
export function parseOptions(argv) {
  const usage = `可用 --server=${serverModes.join(',')}、--skip-build`
  const options = { servers: serverModes, skipBuild: false }
  for (const arg of argv) {
    if (arg === '--skip-build') {
      options.skipBuild = true
      continue
    }
    const server = /^--server=(.+)$/.exec(arg)
    if (!server) throw new Error(`认不出参数 ${arg}：${usage}`)
    const values = server[1].split(',')
    const unknown = values.filter((each) => !serverModes.includes(each))
    if (unknown.length > 0) throw new Error(`--server 只能是 ${serverModes.join('、')}，收到 ${unknown.join('、')}`)
    options.servers = values
  }
  return options
}

/** 本次运行的编号与日志目录 %TEMP%/god-docsite-e2e/<kind>-<运行时刻>/ */
export function startRun(kind) {
  const runTag = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')
  // 用长路径：%TEMP% 常是 8.3 短名（GODAME~1），站点根与 Vite 解析出的模块路径对不上时，React Router 认不出路由模块、不剥 loader
  const runDir = path.join(realpathSync.native(tmpdir()), 'god-docsite-e2e', `${kind}-${runTag}`)
  mkdirSync(runDir, { recursive: true })
  return { runTag, runDir, startedAt: Date.now() }
}

export function createRecorder() {
  const report = []
  const record = (group, server, results) => {
    for (const result of results) {
      report.push({ group, server, ...result })
      console.log(`${result.pass ? '通过' : '失败'} [${server} ${group}] ${result.name}：${result.detail}`)
    }
  }
  return { report, record }
}

/** full-test 下的 git 状态（含未跟踪的每个文件）：跑之前记一份，跑完再比 */
export function fullTestGitStatus() {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'full-test'], { cwd: repoDir, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git status 失败（exit ${result.status}）：${result.stderr}`)
  return result.stdout.split('\n').filter(Boolean)
}

export function unchangedGitStatusResult(before) {
  const after = fullTestGitStatus()
  const appeared = after.filter((line) => !before.includes(line))
  const disappeared = before.filter((line) => !after.includes(line))
  const pass = appeared.length === 0 && disappeared.length === 0
  return {
    name: '跑完 git status full-test 和跑之前一样（测试没改脏仓里的文件）',
    pass,
    detail: pass ? `跑之前 ${before.length} 行，跑之后一样` : [...appeared.map((line) => `多出 ${line}`), ...disappeared.map((line) => `少了 ${line}`)].join('；'),
  }
}

export function finishRun({ report, runDir, startedAt }) {
  writeFileSync(path.join(runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const failed = report.filter((result) => !result.pass)
  for (const server of [...new Set(report.map((result) => result.server))]) {
    const ofServer = report.filter((result) => result.server === server)
    console.log(`${server}：${ofServer.filter((result) => result.pass).length}/${ofServer.length} 项通过`)
  }
  for (const result of failed) console.log(`失败 [${result.server} ${result.group}] ${result.name}：${result.detail}`)
  console.log(`\n${report.length - failed.length} 项通过，${failed.length} 项失败，总耗时 ${Math.round((Date.now() - startedAt) / 1000)} 秒；结果 ${path.join(runDir, 'report.json')}`)
  process.exitCode = failed.length === 0 ? 0 : 1
}
