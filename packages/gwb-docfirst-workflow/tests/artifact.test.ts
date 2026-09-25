import fs from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物检查，加几处必须同时改的对照。没有产物时产物那组整组跳过：门禁不依赖 build。
 *
 * 本插件只有 node 侧产物（tsc 输出）：相对 import 带扩展名，包名 import 只许 node 内置模块、electron 与 peer 里写了的包。
 * 本插件没有窗格，也就没有浏览器侧产物（窗格在站点插件里）。
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

  it.skipIf(!built)('产物只有一层：`../template/attach/` 在源码与产物里是同一个相对位置，靠的就是这一点', () => {
    expect(nodeHalf.sort()).toEqual(['attach.js', 'deps.js', 'index.js', 'manifest.js', 'skeleton.js', 'template.js', 'values.js'])
    expect(fs.existsSync(path.join(distDir, 'client.js'))).toBe(false)
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

  it.skipIf(!built)('命令总线上只有 docfirst.attach 一条：命令名是公共接口，改名就是破坏兼容', () => {
    const host = read('index.js')
    expect(host).toContain("'docfirst.attach'")
    // 核对要在仓里发生，agent 在仓里跑 pnpm doc，插件不转发命令行。
    // 投反馈是在目标仓站里的 content/future/inbox/ 下新建一个文件，不经命令
    for (const gone of ['live-doc.cli', 'live-doc.cli-raw', 'live-doc.stale', 'live-doc.feedback', 'live-doc.feedback-list']) {
      expect(host, `${gone} 还在总线上`).not.toContain(`'${gone}'`)
    }
    // 扫描站、启动、停止、端口归站点插件（docs-site.*）
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

  it('六份说明书在 files 里：漏了照样能发布、能安装，直到注册时扫描目录才报读不到', () => {
    expect(manifest.files).toContain('skills')
    for (const skill of ['docfirst', 'docfirst-docs', 'trajectory', 'spec-grill', 'parallel-by-module', 'docs-governance']) {
      expect(fs.existsSync(path.join(root, 'skills', skill, 'SKILL.md')), `skills/${skill}/SKILL.md`).toBe(true)
    }
    expect(fs.readFileSync(path.join(root, 'skills', 'docfirst', 'SKILL.md'), 'utf8')).toMatch(/^---\s*\nname: docfirst\n/)
  })

  it('template 在 files 里：漏了照样能发布、能安装，直到运行 attach 时才报读不到', () => {
    expect(manifest.files).toContain('template')
    expect(fs.existsSync(path.join(root, 'template', 'attach', 'docfirst.config.mjs.tpl'))).toBe(true)
  })

  /**
   * 插件与包的分界：插件的使用者是 agent，包的使用者是仓，插件不许依赖包。
   * 把那个包写进任何一档依赖，插件就会用 home 里解析出来的一条固定路径，包升级后照读旧文件、不报错，
   * 所以三档都查：运行时、peer、开发期。
   */
  it('插件对 @godcreator/docfirst-workflow 零依赖：三档依赖都没有它，源码里也不 import', () => {
    for (const [table, deps] of Object.entries({
      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,
      devDependencies: manifest.devDependencies,
    })) {
      for (const dep of Object.keys(deps ?? {})) {
        expect(dep.startsWith('@godcreator/docfirst-workflow'), `${table} 里出现了 ${dep}：插件不许依赖包`).toBe(false)
      }
    }
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      for (const m of src.matchAll(BARE)) {
        expect(m[1]!.startsWith('@godcreator/docfirst-workflow'), `src/${file} import 了 ${m[1]!}`).toBe(false)
      }
    }
    // 写进目标站 package.json 的依赖表不算依赖：它是字符串，插件不 import；装出来的站要跑 pnpm doc，站当然要装那个包
    expect(fs.readFileSync(path.join(root, 'src', 'deps.ts'), 'utf8')).toContain('@godcreator/docfirst-workflow')
  })

  it('不启动子进程、不登记 node CLI：转发命令行就是把该在仓里发生的事搬进插件', () => {
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      expect(src, `src/${file} 启动了子进程`).not.toMatch(/node:child_process|gwbNodeCli/)
    }
    expect(manifest.peerDependencies?.['@godcreator/gwb-node-cli']).toBeUndefined()
    expect(manifest.devDependencies?.['@godcreator/gwb-node-cli']).toBeUndefined()
  })

  it('skills 是可选 peer，注册说明书走 ctx.inject、不进 export const inject', () => {
    expect(manifest.peerDependencies?.['@godcreator/gwb-skills']).toBeDefined()
    expect(manifest.peerDependenciesMeta?.['@godcreator/gwb-skills']?.optional).toBe(true)
    expect(index).toMatch(/ctx\.inject\(\['gwbSkills'\]/)
    expect(index).toMatch(/export const inject = \['gwbCommands'\]/)
  })

  /** 两个插件互不依赖：装配只要一个绝对路径，骨架由谁生成、站在不在运行，本插件都不问 */
  it('站点插件不在任何一档依赖里，也不被 import', () => {
    const all = { ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies }
    expect(Object.keys(all)).not.toContain('@godcreator/gwb-docs-site')
    expect(index).not.toMatch(/from '@godcreator\/gwb-docs-site'/)
  })

  it('本插件不注册窗格：站点插件的窗格已经叫「文档站」，两个同名窗格分不清', () => {
    expect(index).not.toContain('registerPane')
    expect(index).not.toContain('gwbShell')
    expect(manifest.peerDependencies?.['@godcreator/gwb-shell']).toBeUndefined()
  })

  it('cordis 与 electron 都不在 dependencies：前者写进去就是第二份实例，后者本插件不用', () => {
    expect(manifest.dependencies?.['cordis']).toBeUndefined()
    expect(manifest.dependencies?.['electron']).toBeUndefined()
  })
})
