import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物守卫 + 几处「一改就得一起改」的账。缺产物时产物那组整组跳过——门禁不依赖 build。
 *
 * 本件只有 node 半（tsc 出的）：相对 import 带扩展名、裸名只许钉死的那些。
 * 浏览器半那组规矩连同窗格一起归站件了，这儿不再有。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const distDir = path.join(root, 'dist')
const built = fs.existsSync(path.join(distDir, 'index.js'))

if (!built) console.warn('[gwb-live-doc] dist/ 还没造齐，产物组跳过（pnpm build 之后再跑）')

/** node 半运行时真 import 的：契约包（isRecord）。那几个件都是 import type，整句擦除 */
const ALLOWED_BARE = new Set(['@godcreator02/gwb-plugin-api'])

const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

describe.skipIf(!built)('产物', () => {
  const nodeHalf = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) : []

  it('只有 node 半的四个模块——client.js 与 style.css 跟着窗格归站件了', () => {
    expect(nodeHalf.sort()).toEqual(['feedback.js', 'index.js', 'site-lookup.js', 'stale.js'])
    expect(fs.existsSync(path.join(distDir, 'client.js'))).toBe(false)
    expect(fs.existsSync(path.join(distDir, 'style.css'))).toBe(false)
  })

  it('相对 import 一律带扩展名——产物给 node 直接加载，ESM 不做补全', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(RELATIVE)) if (!m[1]!.endsWith('.js')) bad.push(`${file}: ${m[1]!}`)
    }
    expect(bad).toEqual([])
  })

  it('裸名只有契约包', () => {
    const bare = new Set<string>()
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(BARE)) if (!m[1]!.startsWith('node:')) bare.add(m[1]!)
    }
    expect([...bare].filter((s) => !ALLOWED_BARE.has(s))).toEqual([])
  })

  it('五条命令加那个裸口一个不少——命令名是总线上的公共面，改名就是破约', () => {
    const host = read('index.js')
    for (const command of ['live-doc.cli', 'live-doc.cli-raw', 'live-doc.attach', 'live-doc.stale', 'live-doc.feedback', 'live-doc.feedback-list']) {
      expect(host).toContain(`'${command}'`)
    }
  })

  it('站的一生那六条命令一条都不在了——它们归站件（docs-site.*）', () => {
    const host = read('index.js')
    for (const gone of ['live-doc.sites', 'live-doc.start', 'live-doc.stop', 'live-doc.open', 'live-doc.extend', 'live-doc.running', 'live-doc.init']) {
      expect(host).not.toContain(`'${gone}'`)
    }
  })
})

describe('几处一改就得一起改的账', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    files?: string[]
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const index = fs.readFileSync(path.join(root, 'src', 'index.ts'), 'utf8')

  it('skills 进了 files——漏了包照发、照装得上，直到挂载去扫目录时才报读不动', () => {
    expect(manifest.files).toContain('skills')
    expect(fs.existsSync(path.join(root, 'skills', 'live-doc', 'SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(root, 'skills', 'live-doc', 'SKILL.md'), 'utf8')).toMatch(/^---\s*\nname: live-doc\n/)
  })

  /**
   * 降 peer 是为了让那个包**装成 home 的直接依赖**：只有那样
   * `<home>/node_modules/@godcreator02/livedoc` 才是一条 junction、`pnpm add 包@新版本`
   * 会改它的指向。写回 dependencies 就等于把包塞回件私有的 node_modules，那条路径不存在，
   * 件只能退回 `import.meta.resolve`——于是升级之后照读旧文件、零报错。
   */
  it('livedoc 是硬 peer：不在 dependencies 里，也不标 optional（缺了这个件干不了活）', () => {
    expect(manifest.dependencies?.['@godcreator02/livedoc']).toBeUndefined()
    expect(manifest.peerDependencies?.['@godcreator02/livedoc']).toBeDefined()
    expect(manifest.peerDependenciesMeta?.['@godcreator02/livedoc']).toBeUndefined()
    // 只 import type：报告形状是契约，跑它一律起进程（CLI 形态不进程内 import）
    expect(index).toMatch(/import \{ collapse, parseCheckJson \} from '\.\/stale\.js'/)
    expect(index).not.toMatch(/^import [^t].*from '@godcreator02\/live-doc/m)
  })

  /**
   * 取址方式就是这个病本身：`import.meta.resolve` 回的是解开软链、当场定死的真实路径
   * （pnpm 下带版本号），而 pnpm 从不清理旧目录——升级之后读旧文件一路成功、零报错。
   * 两处取址（可执行、说明书目录）都得**每次现算**，一处缓存就是把病搬个家。
   */
  it('livedoc 的路径现查 home 的 node_modules，一个 import.meta.resolve 都没有', () => {
    // 只禁那个调用，不禁注释里提它的名字——那段注释正是这条规矩的出处
    expect(index).not.toMatch(/import\.meta\.resolve\(/)
    expect(index).toMatch(/requireKernel\(ctx\)\.dataDir/)
    // 两处取址各自是个函数、各自吃 ctx：没有模块级常量把结果攥住
    expect(index).toMatch(/function livedocEntry\(ctx: GwbContext\): string/)
    expect(index).toMatch(/function livedocSkillsDir\(ctx: GwbContext\): string/)
    expect(index).not.toMatch(/^const livedoc\w* =/m)
  })

  it('skills、node-cli 是可选 peer，注册那两段走 ctx.inject 的子 fiber、不进 export const inject', () => {
    expect(index).toMatch(/ctx\.inject\(\['gwbNodeCli'\]/)
    for (const pkg of ['@godcreator02/gwb-skills', '@godcreator02/gwb-node-cli']) {
      expect(manifest.peerDependencies?.[pkg]).toBeDefined()
      expect(manifest.peerDependenciesMeta?.[pkg]?.optional).toBe(true)
    }
    expect(index).toMatch(/ctx\.inject\(\['gwbSkills'\]/)
    expect(index).toMatch(/export const inject = \['gwbCommands'\]/)
  })

  /**
   * 这条守的是这次拆分的判据本身：**两个件互不依赖**。站件的东西本件一档都不写、
   * 一行都不 import——要「有哪些站」只经命令总线问 `docs-site.list`，问不着就要求给绝对路径。
   * 哪天为了省事把站件的类型 import 进来，这条会红。
   */
  it('站件不在任何一档依赖里，也不被 import——只经命令总线说话', () => {
    const all = { ...manifest.dependencies, ...manifest.peerDependencies }
    expect(Object.keys(all)).not.toContain('@godcreator02/gwb-docs-site')
    expect(index).not.toMatch(/from '@godcreator02\/gwb-docs-site'/)
    expect(fs.readFileSync(path.join(root, 'src', 'site-lookup.ts'), 'utf8')).not.toMatch(/from '@godcreator02\/gwb-docs-site'/)
    expect(index).toContain('docs-site.list')
  })

  it('本件不注册窗格——站件那格已经叫「文档站」，两格同名分不出谁是谁', () => {
    expect(index).not.toContain('registerPane')
    expect(index).not.toContain('gwbShell')
    expect(manifest.peerDependencies?.['@godcreator02/gwb-shell']).toBeUndefined()
  })

  it('cordis 与 electron 都不在 dependencies——前者写进去就是第二份实例，后者本件根本不用', () => {
    expect(manifest.dependencies?.['cordis']).toBeUndefined()
    expect(manifest.dependencies?.['electron']).toBeUndefined()
  })
})
