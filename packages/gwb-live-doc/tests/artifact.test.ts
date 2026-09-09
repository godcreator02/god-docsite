import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物守卫 + 几处「一改就得一起改」的账。缺产物时产物那组整组跳过——门禁不依赖 build。
 *
 * 两半规矩不一样：node 半（tsc 出的）相对 import 带扩展名、裸名只许钉死的那些；
 * 浏览器半（esbuild 打的 client.js）只许那四个共享名漏出去。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const distDir = path.join(root, 'dist')
/** 三样产物都在才算 build 过——只看 dist/ 在不在，半截产物（只跑过 tsc）会把这组当成真的在验 */
const built = ['index.js', 'client.js', 'style.css'].every((f) => fs.existsSync(path.join(distDir, f)))

if (!built) console.warn('[gwb-live-doc] dist/ 还没造齐，产物组跳过（pnpm build 之后再跑）')

const CLIENT = 'client.js'
/** node 半运行时真 import 的：契约包（requireKernel / isRecord）。那几个件都是 import type，整句擦除 */
const ALLOWED_BARE = new Set(['@godcreator02/gwb-plugin-api'])
/** 页面 importmap 提供的那四个，跟 build.ts 的 SHARED 一一对应 */
const SHARED = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'])

const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g
const PRELUDE = /(?:^|[{};])([^{};]*)\{/g
const CLASS_SELECTOR = /\.(?:\\.|[A-Za-z0-9_-])+/g
/** `.dark` 是页面级的亮暗标志，只以祖先身份出现在 `livedoc:dark:*` 编出的选择器里 */
const DARK_FLAG = new Set(['.dark'])

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

function classSelectors(css: string): string[] {
  const found = new Set<string>()
  for (const rule of css.replaceAll(CSS_COMMENT, '').matchAll(PRELUDE)) {
    const prelude = rule[1]!.trim()
    if (prelude.startsWith('@')) continue
    for (const cls of prelude.matchAll(CLASS_SELECTOR)) found.add(cls[0])
  }
  return [...found]
}

describe.skipIf(!built)('产物', () => {
  const all = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) : []
  const nodeHalf = all.filter((f) => f !== CLIENT)

  it('两半都在：node 半的 index.js 与六个模块，浏览器半的 client.js，样式表', () => {
    expect(nodeHalf.sort()).toEqual(['deadline.js', 'feedback.js', 'index.js', 'manager.js', 'runner.js', 'sites.js', 'stale.js'])
    expect(all).toContain(CLIENT)
    expect(fs.existsSync(path.join(distDir, 'style.css'))).toBe(true)
  })

  it('node 半：相对 import 一律带扩展名——产物给 node 直接加载，ESM 不做补全', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(RELATIVE)) if (!m[1]!.endsWith('.js')) bad.push(`${file}: ${m[1]!}`)
    }
    expect(bad).toEqual([])
  })

  it('node 半：裸名只有契约包——electron 走变量说明符的 import()，不在这张表上也不该在', () => {
    const bare = new Set<string>()
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(BARE)) if (!m[1]!.startsWith('node:')) bare.add(m[1]!)
    }
    expect([...bare].filter((s) => !ALLOWED_BARE.has(s))).toEqual([])
    expect(read('index.js')).not.toMatch(/from\s+['"]electron['"]/)
  })

  it('node 半：十条命令加那个裸口一个不少——命令名是总线上的公共面，改名就是破约', () => {
    const host = read('index.js')
    for (const command of [
      'live-doc.sites',
      'live-doc.start',
      'live-doc.stop',
      'live-doc.open',
      'live-doc.extend',
      'live-doc.running',
      'live-doc.cli',
      'live-doc.cli-raw',
      'live-doc.stale',
      'live-doc.feedback',
      'live-doc.feedback-list',
    ]) {
      expect(host).toContain(`'${command}'`)
    }
  })

  it('浏览器半：裸名只许那四个共享的', () => {
    const leaked = [...read(CLIENT).matchAll(BARE)].map((m) => m[1]!).filter((s) => !SHARED.has(s))
    expect(leaked).toEqual([])
  })

  it('style.css 里的类选择器一律 .livedoc\\: 开头——围栏就是前缀本身', () => {
    const bad = classSelectors(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8'))
      .filter((s) => !s.startsWith('.livedoc\\:') && !DARK_FLAG.has(s))
      .sort()
    expect(bad).toEqual([])
  })

  it('style.css 里没有 data-gwb-plugin——围栏不依赖任何祖先关系', () => {
    expect(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8')).not.toContain('data-gwb-plugin')
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

  it('live-doc-cli 是真依赖：件要起它的进程，装本件的 home 里必须有它', () => {
    expect(manifest.dependencies?.['@godcreator02/live-doc-cli']).toBeDefined()
    // 只 import type：报告形状是契约，跑它一律起进程（CLI 形态不进程内 import）
    expect(index).toMatch(/import \{ collapse, parseCheckJson \} from '\.\/stale\.js'/)
    expect(index).not.toMatch(/^import [^t].*from '@godcreator02\/live-doc-cli'/m)
  })

  it('skills、settings、node-cli 是可选 peer，注册那三段走 ctx.inject 的子 fiber、不进 export const inject', () => {
    expect(index).toMatch(/ctx\.inject\(\['gwbNodeCli'\]/)
    for (const pkg of ['@godcreator02/gwb-skills', '@godcreator02/gwb-settings', '@godcreator02/gwb-node-cli']) {
      expect(manifest.peerDependencies?.[pkg]).toBeDefined()
      expect(manifest.peerDependenciesMeta?.[pkg]?.optional).toBe(true)
    }
    expect(index).toMatch(/ctx\.inject\(\['gwbSkills'\]/)
    expect(index).toMatch(/ctx\.inject\(\['gwbSettings'\]/)
    expect(index).toMatch(/export const inject = \['gwbShell', 'gwbCommands'\]/)
  })

  it('unit-folder 是局部注入、只 import type：dev 档，不进 dependencies 也不进 peer', () => {
    expect(index).toMatch(/ctx\.inject\(\['gwbUnitFolder'\]/)
    expect(index).toContain("'unit-folder/selection'")
    expect(index).toMatch(/import type \{ UnitSelection \} from '@godcreator02\/gwb-unit-folder'/)
    expect(manifest.dependencies?.['@godcreator02/gwb-unit-folder']).toBeUndefined()
    expect(manifest.peerDependencies?.['@godcreator02/gwb-unit-folder']).toBeUndefined()
    // 本地抄本随它发版而删：留着就是第二份真相
    expect(fs.existsSync(path.join(root, 'src', 'unit-folder-contract.ts'))).toBe(false)
  })

  it('cordis 与 electron 都不在 dependencies——前者写进去就是第二份实例，后者运行时就在主进程里', () => {
    expect(manifest.dependencies?.['cordis']).toBeUndefined()
    expect(manifest.dependencies?.['electron']).toBeUndefined()
  })

  it('Tailwind 前缀是 livedoc（不是 live-doc：v4 的 prefix 只收 a-z），三处对得上', () => {
    expect(fs.readFileSync(path.join(root, 'src', 'client', 'styles.css'), 'utf8')).toContain('prefix(livedoc)')
    const components = JSON.parse(fs.readFileSync(path.join(root, 'components.json'), 'utf8')) as { tailwind?: { prefix?: string } }
    expect(components.tailwind?.prefix).toBe('livedoc')
    expect(fs.readFileSync(path.join(root, 'src', 'client', 'index.tsx'), 'utf8')).toContain('livedoc:')
  })
})
