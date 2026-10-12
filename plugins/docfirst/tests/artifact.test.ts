import fs from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物检查，加几处必须同时改的对照。没有产物时产物那组整组跳过：门禁不依赖 build。
 *
 * node 侧产物（tsc 输出）：相对 import 带扩展名，包名 import 只许 node 内置模块、electron 与 peer 里写了的包。
 * 浏览器侧产物是窗格的 client.js（esbuild 打成一个文件）与 style.css，不在 node 侧的检查里。
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
  const nodeHalf = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js') && f !== 'client.js') : []

  it.skipIf(!built)('产物只有一层：`../template/` 在源码与产物里是同一个相对位置，靠的就是这一点', () => {
    expect(nodeHalf.sort()).toEqual([
      'args.js',
      'create.js',
      'deps.js',
      'hosted-sites.js',
      'index.js',
      'ports.js',
      'repo-root.js',
      'scaffold.js',
      'site-args.js',
      'site-host.js',
      'site-process.js',
      'template.js',
      'units-root.js',
      'values.js',
      'vocab.js',
    ])
    expect(fs.existsSync(path.join(distDir, 'client.js')), '窗格的浏览器侧').toBe(true)
    expect(fs.existsSync(path.join(distDir, 'style.css')), '窗格的样式').toBe(true)
    expect(fs.existsSync(path.join(distDir, 'template')), '模板不进 dist，它在包根，靠 files 发布').toBe(false)
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

  it.skipIf(!built)('命令总线上是两条建站命令与四条托管命令：命令名是公共接口，改名就是破坏兼容', () => {
    const host = read('index.js')
    for (const command of ['docfirst.create', 'docfirst.create-plain', 'docfirst.site.list', 'docfirst.site.add', 'docfirst.site.remove', 'docfirst.site.restart']) {
      expect(host).toContain(`'${command}'`)
    }
    expect(host, '建站一步完成，不再有先建骨架再装配的第二条命令').not.toContain("'docfirst.attach'")
    // 核对要在仓里发生，agent 在仓里跑 pnpm doc，插件不转发命令行。
    // 给别的仓写反馈是在那个仓的 gitea 上开 issue，不经本插件的命令
    for (const gone of ['live-doc.cli', 'live-doc.cli-raw', 'live-doc.stale', 'live-doc.feedback', 'live-doc.feedback-list']) {
      expect(host, `${gone} 还在总线上`).not.toContain(`'${gone}'`)
    }
    // 托管只认登记过的站，不扫描容器根找站、不打开浏览器
    for (const gone of ['live-doc.sites', 'live-doc.start', 'live-doc.stop', 'live-doc.open', 'live-doc.extend', 'live-doc.running', 'live-doc.init']) {
      expect(host).not.toContain(`'${gone}'`)
    }
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

  it('template 在 files 里：漏了照样能发布、能安装，直到运行 docfirst.create 时才报读不到', () => {
    expect(manifest.files).toContain('template')
    expect(fs.existsSync(path.join(root, 'template', 'add', 'docfirst.config.mjs.tpl'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'template', 'replace', 'src', 'lib', 'source.ts.tpl'))).toBe(true)
  })

  /**
   * 插件与包的分界：插件的使用者是 agent，包的使用者是仓，插件不许依赖本仓 `packages/` 下的任何一个包。
   * 把包写进任何一档依赖，插件就会用 home 里解析出来的一条固定路径，包升级后照读旧文件、不报错，
   * 所以三档都查：运行时、peer、开发期。包名从 `packages/` 下的清单现读：按名字前缀判的话，通用包不带 docfirst 前缀，查不到。
   */
  it('插件对本仓 packages/ 下的包零依赖：三档依赖都没有，源码里也不 import', () => {
    const packagesDir = path.resolve(root, '..', '..', 'packages')
    const repoPackages = fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => (JSON.parse(fs.readFileSync(path.join(packagesDir, entry.name, 'package.json'), 'utf8')) as { name: string }).name)
    expect(repoPackages.length, 'packages/ 下一个包都没读到').toBeGreaterThan(0)
    const isRepoPackage = (spec: string): boolean => repoPackages.includes(packageNameOf(spec))
    for (const [table, deps] of Object.entries({
      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,
      devDependencies: manifest.devDependencies,
    })) {
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
    // 写进目标站 package.json 的依赖表不算依赖：它是字符串，插件不 import；装出来的站要运行 pnpm doc、要渲染，站当然要装这个包
    const depsSource = fs.readFileSync(path.join(root, 'src', 'deps.ts'), 'utf8')
    expect(depsSource).toContain('@godcreator/docfirst-workflow')
  })

  /**
   * 子进程只在两处启动：`src/scaffold.ts` 运行官方脚手架 `pnpm dlx create-fumadocs-app`（建站只在 agent 手上发生一次），
   * `src/site-process.ts` 在托管的站目录里运行 `pnpm build` 与 `pnpm start`（站的运行跟会话无关，归工作台）。
   * 别的文件一概不启动子进程——转发 docfirst 命令行就是把该在仓里发生的事搬进插件。
   */
  it('只有 scaffold.ts 与 site-process.ts 启动子进程，不转发 docfirst 命令行，不登记 node CLI', () => {
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      expect(src, `src/${file} 登记了 node CLI`).not.toMatch(/gwbNodeCli/)
      if (file === 'scaffold.ts' || file === 'site-process.ts') continue
      expect(src, `src/${file} 启动了子进程`).not.toMatch(/node:child_process/)
    }
    const scaffold = fs.readFileSync(path.join(root, 'src', 'scaffold.ts'), 'utf8')
    expect([...scaffold.matchAll(/execFile\(/g)], 'scaffold.ts 只启动一次子进程：运行官方脚手架').toHaveLength(1)
    expect(scaffold, '子进程要带超时').toMatch(/timeout: SCAFFOLD_TIMEOUT_MS/)
    const siteProcess = fs.readFileSync(path.join(root, 'src', 'site-process.ts'), 'utf8')
    expect(siteProcess, '托管只运行站自己的 build 与 start 脚本').not.toMatch(/docfirst|'doc'|doc:render|doc:confirm/)
    expect(siteProcess, '构建、等启动、停进程都有超时').toMatch(/BUILD_TIMEOUT_MS[\s\S]*READY_TIMEOUT_MS[\s\S]*KILL_TIMEOUT_MS/)
    expect(manifest.peerDependencies?.['@godcreator/gwb-node-cli']).toBeUndefined()
    expect(manifest.devDependencies?.['@godcreator/gwb-node-cli']).toBeUndefined()
  })

  it('skills、data、shell 是可选 peer，注册说明书、托管站点、窗格走 ctx.inject、不进 export const inject', () => {
    for (const peer of ['@godcreator/gwb-skills', '@godcreator/gwb-data', '@godcreator/gwb-shell']) {
      expect(manifest.peerDependencies?.[peer]).toBeDefined()
      expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true)
    }
    expect(index).toMatch(/ctx\.inject\(\['gwbSkills'\]/)
    expect(index).toMatch(/ctx\.inject\(\['gwbData'\]/)
    expect(index).toMatch(/ctx\.inject\(\['gwbShell'\]/)
    expect(index).toMatch(/export const inject = \['gwbCommands'\]/)
  })

  /**
   * 建站（运行官方脚手架、本机约定、写盘）在本插件的 `src/scaffold.ts` 里，不经站点插件 `@godcreator/gwb-docs-site`：
   * 三档依赖里都没有它，源码不引用它的包名、不注入它的服务 `gwbDocsSite`、不调它的 `docs-site.create`。
   */
  it('不依赖站点插件：依赖表、源码、注入与命令调用里都没有它', () => {
    for (const table of [manifest.dependencies, manifest.peerDependencies, manifest.devDependencies]) {
      expect(table?.['@godcreator/gwb-docs-site']).toBeUndefined()
    }
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      expect(src, `src/${file} 引用了站点插件`).not.toMatch(/@godcreator\/gwb-docs-site|gwbDocsSite|'docs-site\.create'/)
    }
  })

  /** 窗格只显示托管着哪些站：开关、重启都由 agent 调命令，窗格里不调别的命令、不放按钮 */
  it('只有一个窗格，它只读 docfirst.site.list，没有按钮', () => {
    expect([...index.matchAll(/registerPane\(/g)]).toHaveLength(1)
    const clientDir = path.join(root, 'src', 'client')
    const client = fs
      .readdirSync(clientDir)
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => fs.readFileSync(path.join(clientDir, file), 'utf8'))
      .join('\n')
    expect([...client.matchAll(/'docfirst\.[\w.-]+'/g)].map((m) => m[0])).toEqual(["'docfirst.site.list'"])
    expect(client).not.toMatch(/<button|onClick|<Button/)
  })

  it('cordis 与 electron 都不在 dependencies：前者写进去就是第二份实例，后者本插件不用', () => {
    expect(manifest.dependencies?.['cordis']).toBeUndefined()
    expect(manifest.dependencies?.['electron']).toBeUndefined()
  })
})
