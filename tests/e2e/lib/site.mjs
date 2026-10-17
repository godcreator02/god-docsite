import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runLogged, runLoggedAsync } from './process.mjs'

export const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** 仓里的测试站：协作仓形态，站点在 site/，任务与模块在 collab/records/ */
export const fullTestDir = path.join(repoDir, 'full-test')
export const fullTestSiteDir = path.join(fullTestDir, 'site')
const fullTestSitePackage = 'full-test-site'

/** full-test 的 people.json 里测试员的身份码：服务带着它启动，站点认出「测试员」，可以写评论与任务 */
export const testerIdentityCode = 'e2etestcode01'
/** 测试站 people.json 里带着 testerIdentityCode 的那个人 */
export const testerPersonId = 'tester'

/** 构建测试站依赖的本仓包（不含站点自己：站点在 start 那一轮里构建） */
export function buildSitePackages(logDir) {
  runLogged('pnpm', ['--filter', `${fullTestSitePackage}^...`, 'build'], { cwd: repoDir, logFile: path.join(logDir, 'build-packages.txt'), timeoutMs: 600_000 })
}

export function typecheckSite(siteDir, logDir) {
  return runLoggedAsync('pnpm', ['typecheck'], { cwd: siteDir, logFile: path.join(logDir, 'typecheck.txt'), timeoutMs: 300_000 })
}

export function buildSite(siteDir, logDir) {
  return runLoggedAsync('pnpm', ['build'], { cwd: siteDir, logFile: path.join(logDir, 'build-site.txt'), timeoutMs: 900_000 })
}

export const reactRouterBin = (siteDir) => path.join(siteDir, 'node_modules', '@react-router', 'dev', 'bin.cjs')
export const reactRouterServeBin = (siteDir) => path.join(siteDir, 'node_modules', '@react-router', 'serve', 'bin.cjs')
