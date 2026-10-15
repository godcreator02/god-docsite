import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runLogged } from './process.mjs'

export const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesDir = path.join(repoDir, 'e2e', 'fixtures')
const baseSiteFixturesDir = path.join(fixturesDir, 'base-site')
const demoSiteFixturesDir = path.join(fixturesDir, 'demo-site')

/** 模板里写成 {{version}} 的本仓包与它们在仓里的目录；comments 依赖 identity */
export const platformPackages = {
  '@godcreator/god-docsite': 'packages/god-docsite',
  '@godcreator/identity': 'packages/identity',
  '@godcreator/comments': 'packages/comments',
}

/** 只给 e2e 用的演示功能包：不在 pnpm workspace 里，不用构建 */
export const demoFeaturePackage = { name: 'e2e-demo', dir: path.join(fixturesDir, 'e2e-demo') }

/** 组合：base 是基础站（平台 + identity + comments），demo 是基础站加上演示功能，collab 是基础站加上协作功能（e2e/combos/collab.mjs） */
export const combos = ['base', 'demo', 'collab']

/** 夹具里 people.json 那个人的身份码：服务带着它启动，站点认出「测试员」，可以写评论 */
export const testerIdentityCode = 'e2etestcode01'

export function buildPlatformPackages(logDir) {
  const filters = Object.keys(platformPackages).flatMap((name) => ['--filter', name])
  runLogged('pnpm', [...filters, 'build'], { cwd: repoDir, logFile: path.join(logDir, 'build-packages.txt'), timeoutMs: 600_000 })
}

/** 建站器在平台包的构建产物里：仓根不依赖平台包，按文件路径加载 */
export async function loadScaffold() {
  return import(pathToFileURL(path.join(repoDir, 'packages', 'god-docsite', 'dist', 'node', 'scaffold.mjs')).href)
}

export function packPackage(name, packageDir, tarballDir, logDir) {
  const before = new Set(readdirSync(tarballDir))
  runLogged('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: packageDir, logFile: path.join(logDir, `pack-${name.replace('@', '').replace('/', '-')}.txt`), timeoutMs: 120_000 })
  const created = readdirSync(tarballDir).filter((file) => !before.has(file) && file.endsWith('.tgz'))
  if (created.length !== 1) throw new Error(`pnpm pack ${name} 之后 ${tarballDir} 里多出的 tarball 不是一个：${created.join(', ')}`)
  return path.join(tarballDir, created[0])
}

/** pnpm pack 出平台包与演示功能包的 tarball：装进站点后包的真实路径在 node_modules/.pnpm 下，和从 registry 装一样 */
export function packPackages(tarballDir, logDir) {
  mkdirSync(tarballDir, { recursive: true })
  const platform = Object.fromEntries(Object.entries(platformPackages).map(([name, dir]) => [name, packPackage(name, path.join(repoDir, dir), tarballDir, logDir)]))
  return { platform, demo: packPackage(demoFeaturePackage.name, demoFeaturePackage.dir, tarballDir, logDir) }
}

function toPosix(file) {
  return file.replaceAll('\\', '/')
}

/**
 * 用平台包的 createSite 建站，再叠夹具：基础站叠评论定位回归页、TSX 与 HTML 页、术语表、预置评论；
 * demo 组合叠演示功能的内容页与集合，并把演示功能包写进依赖（link 或 file，和 createSite 的装法一致）。
 * scriptPort 只写进 package.json 的 dev 脚本，e2e 起 dev 时自己带 --port
 */
export async function generateSite({ siteDir, installMode, combo, tarballs, scriptPort }) {
  const { createSite } = await loadScaffold()
  const people = JSON.parse(readFileSync(path.join(baseSiteFixturesDir, 'people.json'), 'utf8'))
  const packageSource = installMode === 'link' ? { kind: 'link', repoDir } : { kind: 'file', tarballs: tarballs.platform }
  createSite({ dir: siteDir, siteName: 'e2e 站', port: scriptPort, people, packageSource })
  if (combo === 'base') {
    cpSync(baseSiteFixturesDir, siteDir, { recursive: true, filter: (source) => path.basename(source) !== 'people.json' })
    return
  }
  cpSync(demoSiteFixturesDir, siteDir, { recursive: true })
  const packageJsonFile = path.join(siteDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonFile, 'utf8'))
  packageJson.dependencies[demoFeaturePackage.name] = installMode === 'link' ? `link:${toPosix(demoFeaturePackage.dir)}` : `file:${toPosix(tarballs.demo)}`
  writeFileSync(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`)
}

export function installSite(siteDir, logDir) {
  runLogged('pnpm', ['install', '--prefer-offline'], { cwd: siteDir, logFile: path.join(logDir, 'install.txt'), timeoutMs: 900_000 })
}

export function typecheckSite(siteDir, logDir) {
  runLogged('pnpm', ['typecheck'], { cwd: siteDir, logFile: path.join(logDir, 'typecheck.txt'), timeoutMs: 300_000 })
}

export function buildSite(siteDir, logDir) {
  runLogged('pnpm', ['build'], { cwd: siteDir, logFile: path.join(logDir, 'build.txt'), timeoutMs: 900_000 })
}

export const reactRouterBin = (siteDir) => path.join(siteDir, 'node_modules', '@react-router', 'dev', 'bin.cjs')
export const reactRouterServeBin = (siteDir) => path.join(siteDir, 'node_modules', '@react-router', 'serve', 'bin.cjs')
