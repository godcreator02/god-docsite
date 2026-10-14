import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runLogged } from './process.mjs'

export const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const templateDir = path.join(repoDir, 'packages', 'god-docsite', 'template')
const fixturesDir = path.join(repoDir, 'e2e', 'fixtures')

/** 模板里写成 {{version}} 的本仓包与它们在仓里的目录；comments 依赖 identity */
export const platformPackages = {
  '@godcreator/god-docsite': 'packages/god-docsite',
  '@godcreator/identity': 'packages/identity',
  '@godcreator/comments': 'packages/comments',
}

/** 夹具里 people.json 那个人的身份码：服务带着它启动，站点认出「测试员」，可以写评论 */
export const testerIdentityCode = 'e2etestcode01'

export function buildPlatformPackages(logDir) {
  const filters = Object.keys(platformPackages).flatMap((name) => ['--filter', name])
  runLogged('pnpm', [...filters, 'build'], { cwd: repoDir, logFile: path.join(logDir, 'build-packages.txt'), timeoutMs: 600_000 })
}

/** pnpm pack 出 tarball：装进站点后包的真实路径在 node_modules/.pnpm 下，和从 registry 装一样 */
function packPlatformPackages(tarballDir, logDir) {
  mkdirSync(tarballDir, { recursive: true })
  const tarballs = {}
  for (const [name, dir] of Object.entries(platformPackages)) {
    const before = new Set(readdirSync(tarballDir))
    runLogged('pnpm', ['pack', '--pack-destination', tarballDir], { cwd: path.join(repoDir, dir), logFile: path.join(logDir, `pack-${name.split('/')[1]}.txt`), timeoutMs: 120_000 })
    const created = readdirSync(tarballDir).filter((file) => !before.has(file) && file.endsWith('.tgz'))
    if (created.length !== 1) throw new Error(`pnpm pack ${name} 之后 ${tarballDir} 里多出的 tarball 不是一个：${created.join(', ')}`)
    tarballs[name] = path.join(tarballDir, created[0])
  }
  return tarballs
}

function toPosix(file) {
  return file.replaceAll('\\', '/')
}

/**
 * 从模板生成一个站点到 siteDir，再叠上夹具（评论定位回归页、TSX 与 HTML 页、术语表、带身份码的 people.json）。
 * installMode：link 把 {{version}} 换成 link:<仓里的包目录>；file 换成 file:<pnpm pack 的 tarball>，
 * 并用 overrides 让包之间的依赖（comments → identity）也指向 tarball
 */
export function generateSite({ siteDir, installMode, logDir }) {
  if (existsSync(siteDir)) throw new Error(`${siteDir} 已经存在：每次运行用新目录`)
  cpSync(templateDir, siteDir, { recursive: true, filter: (source) => !/[\\/](node_modules|build|\.react-router|\.source)([\\/]|$)/.test(path.relative(templateDir, source)) })
  cpSync(fixturesDir, siteDir, { recursive: true })

  let specifiers
  if (installMode === 'link') {
    specifiers = Object.fromEntries(Object.entries(platformPackages).map(([name, dir]) => [name, `link:${toPosix(path.join(repoDir, dir))}`]))
  } else if (installMode === 'file') {
    const tarballs = packPlatformPackages(path.join(path.dirname(siteDir), `${path.basename(siteDir)}-tarballs`), logDir)
    specifiers = Object.fromEntries(Object.entries(tarballs).map(([name, file]) => [name, `file:${toPosix(file)}`]))
  } else {
    throw new Error(`没有装法 ${installMode}，可选：link、file`)
  }

  const packageJsonFile = path.join(siteDir, 'package.json')
  const packageJsonText = readFileSync(packageJsonFile, 'utf8')
  const packageJson = JSON.parse(packageJsonText)
  for (const [name, version] of Object.entries(packageJson.dependencies)) {
    if (version !== '{{version}}') continue
    if (!(name in specifiers)) throw new Error(`模板 package.json 里 ${name} 写着 {{version}}，e2e 不认识这个包`)
    packageJson.dependencies[name] = specifiers[name]
  }
  if (JSON.stringify(packageJson).includes('{{')) throw new Error('模板 package.json 里还有没换掉的占位')
  writeFileSync(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`)

  const overrides = installMode === 'file' ? Object.entries(specifiers).map(([name, specifier]) => `  '${name}': '${specifier}'`).join('\n') : ''
  writeFileSync(
    path.join(siteDir, 'pnpm-workspace.yaml'),
    `allowBuilds:\n  esbuild: true\n${overrides ? `overrides:\n${overrides}\n` : ''}`,
  )
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
