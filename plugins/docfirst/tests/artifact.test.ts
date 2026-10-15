import fs from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物检查，加几处必须同时改的对照。没有产物时产物那组整组跳过：门禁不依赖 build。
 *
 * node 侧产物（tsc 输出）：相对 import 带扩展名，包名 import 只许 node 内置模块、electron 与 peer 里写了的包。
 * 插件没有浏览器侧：窗格随托管命令一起删了。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const distDir = path.join(root, 'dist')
const built = fs.existsSync(path.join(distDir, 'index.js'))

if (!built) console.warn('[gwb-docfirst-workflow] dist/ 还没生成，产物组跳过（pnpm build 之后再跑）')

/** node 侧产物里允许的包名 import：node 内置模块、electron、本包 peer 里写了的包（都装在 home 里）。只 import type 的整句会被擦除 */
const ownPeers = new Set(Object.keys((JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { peerDependencies?: Record<string, string> }).peerDependencies ?? {}))
/** `@scope/name/sub` → `@scope/name`；`name/sub` → `name` */
const packageNameOf = (spec: string): string => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/')
const isNodeBuiltin = (spec: string): boolean => spec.startsWith('node:') || builtinModules.includes(spec)

const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

describe('产物', () => {
  const nodeHalf = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) : []

  it.skipIf(!built)('产物一层排开，没有浏览器侧（窗格随托管命令一起删了）', () => {
    expect(nodeHalf.sort()).toEqual(['args.js', 'docfirst-site.js', 'index.js', 'ports.js', 'repo-root.js', 'units-root.js', 'values.js', 'vocab.js'])
    expect(fs.existsSync(path.join(distDir, 'client.js'))).toBe(false)
    expect(fs.existsSync(path.join(distDir, 'style.css'))).toBe(false)
  })

  it.skipIf(!built)('相对 import 一律带扩展名：产物由 node 直接加载，ESM 不补扩展名', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(RELATIVE)) if (!m[1]!.endsWith('.js')) bad.push(`${file}: ${m[1]!}`)
    }
    expect(bad).toEqual([])
  })

  it.skipIf(!built)('包名 import 只有 node 内置模块、electron 与 peer 里写了的包', () => {
    const bare = new Set<string>()
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(BARE)) bare.add(m[1]!)
    }
    expect([...bare].filter((spec) => !isNodeBuiltin(spec) && spec !== 'electron' && !ownPeers.has(packageNameOf(spec)))).toEqual([])
  })

  it.skipIf(!built)('命令总线上只有一条建站命令：命令名是公共接口，改名就是破坏兼容', () => {
    const host = read('index.js')
    expect(host).toContain("'docfirst.create'")
    // 旧路线已删：Next 脚手架的 create-plain 与托管 Next 站的 docfirst.site.*（站的托管归 gwb-docsite 的 docsite.site.*）
    for (const gone of ['docfirst.create-plain', 'docfirst.site.list', 'docfirst.site.add', 'docfirst.site.remove', 'docfirst.site.restart']) {
      expect(host, `${gone} 还在总线上`).not.toContain(`'${gone}'`)
    }
    // 核对要在仓里发生，agent 在仓里跑 pnpm doc，插件不转发命令行
    expect(host).not.toMatch(/gwbNodeCli/)
  })
})

describe('必须同时改的几处', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    files?: string[]
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const index = fs.readFileSync(path.join(root, 'src', 'index.ts'), 'utf8')

  it('说明书都在 files 里：漏了照样能发布、能安装，直到注册时扫描目录才报读不到', () => {
    expect(manifest.files).toContain('skills')
    for (const skill of ['docs-site', 'docs-writing', 'trajectory']) {
      expect(fs.existsSync(path.join(root, 'skills', skill, 'SKILL.md')), `skills/${skill}/SKILL.md`).toBe(true)
    }
    expect(fs.readFileSync(path.join(root, 'skills', 'docs-site', 'SKILL.md'), 'utf8')).toMatch(/^---\s*\nname: docs-site\n/)
  })

  /**
   * 插件与包的分界：插件的使用者是 agent，包的使用者是仓。插件只按路径读几个包的 package.json 与 template/（写进新站的版本、
   * 叠到站点根的起始物），所以它们只能出现在 dependencies 里，peer 与开发期都不许有，源码里也不许 import。
   * 包名从 `packages/` 下的清单现读：按名字前缀判的话，通用包不带 docfirst 前缀，查不到。
   */
  it('本仓 packages/ 下的包只在 dependencies 里（docfirst 与三个功能包），源码里不 import', () => {
    const packagesDir = path.resolve(root, '..', '..', 'packages')
    const repoPackages = fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => (JSON.parse(fs.readFileSync(path.join(packagesDir, entry.name, 'package.json'), 'utf8')) as { name: string }).name)
    expect(repoPackages.length, 'packages/ 下一个包都没读到').toBeGreaterThan(0)
    const isRepoPackage = (spec: string): boolean => repoPackages.includes(packageNameOf(spec))
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(['@godcreator/code-pin', '@godcreator/docfirst', '@godcreator/explainer', '@godcreator/trajectory'])
    for (const [table, deps] of Object.entries({ peerDependencies: manifest.peerDependencies, devDependencies: manifest.devDependencies })) {
      for (const dep of Object.keys(deps ?? {})) {
        expect(isRepoPackage(dep), `${table} 里出现了 ${dep}：插件不许依赖包`).toBe(false)
      }
    }
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      for (const m of src.matchAll(BARE)) {
        expect(isRepoPackage(m[1]!), `src/${file} import 了 ${m[1]!}`).toBe(false)
      }
    }
  })
  it('没有任何文件启动子进程，不转发 docfirst 命令行：建站与加功能经 gwbDocsite 服务，装依赖与探活归 gwb-docsite', () => {
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      expect(src, `src/${file} 启动了子进程`).not.toMatch(/node:child_process/)
      expect(src, `src/${file} 登记了 node CLI`).not.toMatch(/gwbNodeCli/)
    }
    expect(manifest.peerDependencies?.['@godcreator/gwb-node-cli']).toBeUndefined()
    expect(manifest.devDependencies?.['@godcreator/gwb-node-cli']).toBeUndefined()
  })

  it('skills 与 gwb-docsite 是可选 peer，说明书与建站服务走 ctx.inject、不进 export const inject', () => {
    for (const peer of ['@godcreator/gwb-skills', '@godcreator/gwb-docsite']) {
      expect(manifest.peerDependencies?.[peer]).toBeDefined()
      expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true)
    }
    expect(index).toMatch(/ctx\.inject\(\['gwbSkills'\]/)
    expect(index).toMatch(/ctx\.inject\(\['gwbDocsite'\]/)
    expect(index).toMatch(/export const inject = \['gwbCommands'\]/)
  })

  it('cordis 与 electron 都不在 dependencies：前者写进去就是第二份实例，后者本插件不用', () => {
    expect(manifest.dependencies?.['cordis']).toBeUndefined()
    expect(manifest.dependencies?.['electron']).toBeUndefined()
  })
})
