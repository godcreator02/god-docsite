/**
 * 建站器比对检查（pnpm test:scaffold）：用平台包的建站器把仓里两个站「应该长的样子」生成到系统临时目录，
 * 和仓里的站点逐个比对建站器负责的文件（模板骨架、app/features/ 下各功能的接线文件与汇总文件），不一致就失败并列出差异文件。
 * 改了站点模板或功能包的 template/ 却没用建站器重新生成站点，这项检查就失败。
 *
 * 不装依赖、不构建：建站器从站点 node_modules 读功能包，这里在临时站点的 node_modules/@godcreator/ 下建目录联接，
 * 指向工作区里的包目录（和 pnpm 按 link: 装出来的一样）。建站器在平台包的构建产物里，要先 pnpm build。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scaffoldModule = path.join(repoDir, 'packages', 'god-docsite', 'dist', 'node', 'scaffold.mjs')

/** 两个站都由站点自己维护、建站器只在建站时写一次的文件：内容、人员、依赖清单、站名、术语、评论 */
const siteOwnedInEverySite = [
  { path: 'content/', reason: '站点的内容页（模板只给一张起始页与 meta.json）' },
  { path: 'comments/', reason: '站点的评论' },
  { path: 'people.json', reason: '站点的人员' },
  { path: 'glossary.json', reason: '站点的术语表' },
  { path: 'package.json', reason: '站点的依赖与脚本（仓里的站点在 pnpm 工作区里，依赖写 workspace: 与 catalog:）' },
  { path: 'pnpm-workspace.yaml', reason: '仓里的站点是仓根 pnpm 工作区的成员，没有自己的工作区文件' },
]

const sites = [
  {
    name: 'collab-test',
    dir: path.join(repoDir, 'collab-test', 'site'),
    features: ['@godcreator/collab', '@godcreator/code-pin', '@godcreator/trajectory', '@godcreator/explainer'],
    siteOwned: [],
  },
  {
    name: 'docs-site',
    dir: path.join(repoDir, 'docs-site'),
    features: ['@godcreator/code-pin', '@godcreator/trajectory', '@godcreator/explainer'],
    siteOwned: [
      { path: 'app/lib/mdx-plugins.ts', reason: '站点在这里写不标术语的页（docfirst.config.mjs 的说明指到这里）' },
      { path: 'tsconfig.json', reason: '站点自己定的类型检查范围：include 只列 app、content、comments 与三份配置文件' },
    ],
  },
]

/** 目录下的全部文件，相对这个目录、用正斜杠；跳过 node_modules 这类不进仓的目录 */
function filesUnder(dir, skippedDirs) {
  const walk = (current, prefix) =>
    readdirSync(current).flatMap((name) => {
      const relative = prefix === '' ? name : `${prefix}/${name}`
      const full = path.join(current, name)
      if (!statSync(full).isDirectory()) return [relative]
      return skippedDirs.has(name) ? [] : walk(full, relative)
    })
  return walk(dir, '').sort()
}

const generatedOnlyDirs = new Set(['node_modules'])
/** 仓里站点目录下不进仓的目录（站点 .gitignore 里的） */
const siteBuildDirs = new Set(['node_modules', 'build', '.react-router', '.source'])

const isSiteOwned = (relative, siteOwned) => siteOwned.some((entry) => (entry.path.endsWith('/') ? relative.startsWith(entry.path) : relative === entry.path))

/** 站点 node_modules 里建一个目录联接，指向工作区里的包目录 */
function linkWorkspacePackage(siteDir, packageName) {
  const packageDir = path.join(repoDir, 'packages', packageName.slice(packageName.indexOf('/') + 1))
  if (!existsSync(path.join(packageDir, 'package.json'))) throw new Error(`工作区里没有 ${packageName}（找的是 ${packageDir}）`)
  const target = path.join(siteDir, 'node_modules', ...packageName.split('/'))
  mkdirSync(path.dirname(target), { recursive: true })
  symlinkSync(packageDir, target, 'junction')
}

/** 模板 package.json 里写成 {{version}} 的包：建站器装基础站时跟着装的 */
function basePackagesOf(generatedDir) {
  const { dependencies } = JSON.parse(readFileSync(path.join(generatedDir, 'package.json'), 'utf8'))
  return Object.keys(dependencies).filter((name) => name.startsWith('@godcreator/'))
}

/** 照装好依赖的站点那样补功能：功能包写进依赖、node_modules 里能找到，再 addBaseFeatures 与逐个 addFeature */
function generateExpectedSite({ scaffold, generatedDir, features }) {
  scaffold.createSite({ dir: generatedDir, siteName: '比对用', port: 4000, people: [], packageSource: { kind: 'link', repoDir } })
  const manifestFile = path.join(generatedDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  for (const name of features) manifest.dependencies[name] = `link:${path.join(repoDir, 'packages', name.slice(name.indexOf('/') + 1)).replaceAll('\\', '/')}`
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  for (const name of [...basePackagesOf(generatedDir), ...features]) {
    if (!existsSync(path.join(generatedDir, 'node_modules', ...name.split('/')))) linkWorkspacePackage(generatedDir, name)
  }
  scaffold.addBaseFeatures({ siteDir: generatedDir })
  for (const packageName of features) scaffold.addFeature({ siteDir: generatedDir, packageName })
}

const textOf = (file) => readFileSync(file, 'utf8').replaceAll('\r\n', '\n')

/** 建站器生成的每个文件（站点自己维护的除外）仓里都要有、内容一样；仓里 app/ 下多出建站器不会生成的文件也算差异 */
function differencesOf({ generatedDir, siteDir, siteOwned }) {
  const generated = filesUnder(generatedDir, generatedOnlyDirs).filter((relative) => !isSiteOwned(relative, siteOwned))
  const differences = []
  for (const relative of generated) {
    const inSite = path.join(siteDir, relative)
    if (!existsSync(inSite)) differences.push(`${relative}：仓里没有`)
    else if (textOf(inSite) !== textOf(path.join(generatedDir, relative))) differences.push(`${relative}：内容不同`)
  }
  const generatedSet = new Set(generated)
  const extraInApp = filesUnder(path.join(siteDir, 'app'), siteBuildDirs).map((relative) => `app/${relative}`).filter((relative) => !generatedSet.has(relative) && !isSiteOwned(relative, siteOwned))
  differences.push(...extraInApp.map((relative) => `${relative}：建站器不会生成（多出来的）`))
  return { compared: generated.length, differences }
}

async function main() {
  if (process.argv.length > 2) throw new Error(`scaffold-check 不收参数，收到 ${process.argv.slice(2).join(' ')}`)
  if (!existsSync(scaffoldModule)) throw new Error(`没有 ${scaffoldModule}：先 pnpm build（至少 pnpm --filter @godcreator/god-docsite build）`)
  const scaffold = await import(pathToFileURL(scaffoldModule).href)
  const startedAt = Date.now()
  // 用长路径：%TEMP% 常是 8.3 短名，联接与比对时的相对路径要对得上
  const workDir = path.join(realpathSync.native(tmpdir()), 'god-docsite-scaffold-check', String(process.pid))
  rmSync(workDir, { recursive: true, force: true })
  let failed = 0
  try {
    for (const site of sites) {
      const generatedDir = path.join(workDir, site.name)
      generateExpectedSite({ scaffold, generatedDir, features: site.features })
      const siteOwned = [...siteOwnedInEverySite, ...site.siteOwned]
      const { compared, differences } = differencesOf({ generatedDir, siteDir: site.dir, siteOwned })
      if (differences.length === 0) {
        console.log(`通过 ${site.name}：建站器负责的 ${compared} 个文件与仓里一致（站点自己维护的不比：${siteOwned.map((entry) => entry.path).join('、')}）`)
        continue
      }
      failed += 1
      console.log(`失败 ${site.name}：${differences.length} 处和建站器生成的不一样（改站点骨架与接线文件要改平台包的 template/ 或功能包的 template/，再用建站器重新生成）：`)
      for (const difference of differences) console.log(`  ${difference}`)
    }
  } finally {
    // 递归删除遇到目录联接只删联接本身（lstat 认作符号链接），不进到工作区的包目录里
    rmSync(workDir, { recursive: true, force: true })
  }
  console.log(`${sites.length - failed}/${sites.length} 个站一致，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)} 秒`)
  process.exitCode = failed === 0 ? 0 : 1
}

await main()
