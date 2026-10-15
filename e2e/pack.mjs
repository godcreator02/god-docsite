/**
 * 发版前的打包检查：把测试站依赖的本仓包 pnpm pack，测试站连同协作数据复制到系统临时目录，依赖换成 file:<tarball> 装好
 * （包的真实路径在 node_modules/.pnpm 下，和从 registry 装一样），typegen + tsc 之后跑和 pnpm e2e 完全相同的检查。
 * 查的是只有装成 tarball 才会露出来的问题：包的 files 漏了文件、exports 指错、依赖没写进 dependencies、类型对不上。
 *
 *   pnpm e2e:pack                   先构建测试站依赖的本仓包，dev、start 两轮都跑
 *   pnpm e2e:pack --server=dev      只跑一部分
 *   pnpm e2e:pack --skip-build      不构建本仓的包：只在调用方刚构建过时用
 *
 * 日志、tarball、临时站点与 report.json 在 %TEMP%/god-docsite-e2e/pack-<运行时刻>/；全部通过时临时站点删掉，只留日志、tarball 与结果
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { runLogged, runLoggedAsync } from './lib/process.mjs'
import { collabTestGitStatus, createRecorder, finishRun, parseOptions, startRun, unchangedGitStatusResult } from './lib/report.mjs'
import { runRounds } from './lib/rounds.mjs'
import { buildSitePackages, collabTestDir, collabTestSiteDir, repoDir, typecheckSite } from './lib/site.mjs'

const toPosix = (file) => file.replaceAll('\\', '/')
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const dependencyEntries = (manifest) => [manifest.dependencies, manifest.devDependencies].flatMap((deps) => Object.entries(deps ?? {}))

/** 本仓包名 → 包目录：包目录名是包名去掉作用域（@godcreator/code-pin → packages/code-pin） */
function workspacePackageDir(name) {
  const dir = path.join(repoDir, 'packages', name.slice(name.indexOf('/') + 1))
  if (readJson(path.join(dir, 'package.json')).name !== name) throw new Error(`${dir} 不是 ${name} 的包目录`)
  return dir
}

/** 测试站经 workspace: 依赖的本仓包，连同这些包自己经 workspace: 依赖的，包名 → 包目录 */
function workspacePackagesOfSite() {
  const found = new Map()
  const visit = (manifest) => {
    for (const [name, spec] of dependencyEntries(manifest)) {
      if (!spec.startsWith('workspace:') || found.has(name)) continue
      found.set(name, workspacePackageDir(name))
      visit(readJson(path.join(found.get(name), 'package.json')))
    }
  }
  visit(readJson(path.join(collabTestSiteDir, 'package.json')))
  return found
}

function packPackage(name, packageDir, tarballDir, logDir) {
  const before = new Set(readdirSync(tarballDir))
  runLogged('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: packageDir, logFile: path.join(logDir, `pack-${name.replace('@', '').replace('/', '-')}.txt`), timeoutMs: 120_000 })
  const created = readdirSync(tarballDir).filter((file) => !before.has(file) && file.endsWith('.tgz'))
  if (created.length !== 1) throw new Error(`pnpm pack ${name} 之后 ${tarballDir} 里多出的 tarball 不是一个：${created.join(', ')}`)
  return path.join(tarballDir, created[0])
}

/** 仓根 pnpm-workspace.yaml 里默认 catalog 的「包名 → 版本」：站点的 catalog: 依赖换成它 */
function defaultCatalog() {
  const lines = readFileSync(path.join(repoDir, 'pnpm-workspace.yaml'), 'utf8').split(/\r?\n/)
  const start = lines.indexOf('catalog:')
  if (start === -1) throw new Error('仓根 pnpm-workspace.yaml 里没有 catalog: 段')
  const catalog = new Map()
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break
    const entry = /^ {2}'?([^']+?)'?: (.+)$/.exec(line)
    if (!entry) throw new Error(`读不懂 catalog 里的这一行：${line}`)
    catalog.set(entry[1], entry[2].trim())
  }
  return catalog
}

/** 站点 package.json：workspace: 换成 file:<tarball>，catalog: 换成仓根 catalog 里的版本 */
function rewriteSiteManifest(siteDir, tarballs) {
  const file = path.join(siteDir, 'package.json')
  const manifest = readJson(file)
  const catalog = defaultCatalog()
  for (const deps of [manifest.dependencies, manifest.devDependencies]) {
    for (const [name, spec] of Object.entries(deps ?? {})) {
      if (spec.startsWith('workspace:')) deps[name] = `file:${toPosix(tarballs.get(name))}`
      else if (spec === 'catalog:') {
        if (!catalog.has(name)) throw new Error(`站点依赖 ${name} 写的 catalog:，仓根默认 catalog 里没有它`)
        deps[name] = catalog.get(name)
      } else if (spec.startsWith('catalog:')) throw new Error(`站点依赖 ${name} 写的是具名 catalog（${spec}），打包检查只认默认 catalog`)
    }
  }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

/** 和建站器 file 装法写的一样：esbuild 要跑安装脚本；本仓包之间的依赖也指向 tarball */
function writeSiteWorkspaceYaml(siteDir, tarballs) {
  const lines = ['allowBuilds:', '  esbuild: true', 'minimumReleaseAgeExclude:', "  - '@godcreator/*'", 'overrides:', ...[...tarballs].map(([name, tarball]) => `  '${name}': 'file:${toPosix(tarball)}'`)]
  writeFileSync(path.join(siteDir, 'pnpm-workspace.yaml'), `${lines.join('\n')}\n`)
}

const notCopied = new Set(['node_modules', 'build', '.react-router', '.source'])

/** 测试站连同协作数据复制到临时目录（保持协作仓布局），换成打包装法，装依赖，typegen + tsc；返回临时站点目录 */
async function preparePackedSite(runDir) {
  const tarballDir = path.join(runDir, 'tarballs')
  mkdirSync(tarballDir, { recursive: true })
  const tarballs = new Map([...workspacePackagesOfSite()].map(([name, dir]) => [name, packPackage(name, dir, tarballDir, runDir)]))
  const copiedCollabTest = path.join(runDir, 'collab-test')
  cpSync(collabTestDir, copiedCollabTest, { recursive: true, filter: (source) => !notCopied.has(path.basename(source)) })
  const siteDir = path.join(copiedCollabTest, 'site')
  rewriteSiteManifest(siteDir, tarballs)
  writeSiteWorkspaceYaml(siteDir, tarballs)
  await runLoggedAsync('pnpm', ['install', '--prefer-offline'], { cwd: siteDir, logFile: path.join(runDir, 'install.txt'), timeoutMs: 900_000 })
  await typecheckSite(siteDir, runDir)
  return { siteDir, packages: [...tarballs.keys()] }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const { runTag, runDir, startedAt } = startRun('pack')
  console.log(`运行编号 ${runTag}，日志与临时站点在 ${runDir}`)
  const statusBefore = collabTestGitStatus()
  const { report, record } = createRecorder()
  if (!options.skipBuild) buildSitePackages(runDir)
  let prepared
  try {
    prepared = await preparePackedSite(runDir)
    record('setup', 'pack', [{ name: '打包、复制测试站、按 file: 装依赖、typegen + tsc', pass: true, detail: `${prepared.packages.join('、')}；站点 ${prepared.siteDir}` }])
  } catch (error) {
    record('setup', 'pack', [{ name: '打包、复制测试站、按 file: 装依赖、typegen + tsc', pass: false, detail: error.message }])
  }
  if (prepared !== undefined) await runRounds({ siteDir: prepared.siteDir, servers: options.servers, logDir: runDir, runTag, record })
  record('repo', 'after', [unchangedGitStatusResult(statusBefore)])
  finishRun({ report, runDir, startedAt })
  // 临时站点连同依赖二百多 MB：全部通过就删掉，有失败留着查
  if (process.exitCode === 0 && prepared !== undefined) rmSync(path.dirname(prepared.siteDir), { recursive: true, force: true, maxRetries: 5 })
}

await main()
