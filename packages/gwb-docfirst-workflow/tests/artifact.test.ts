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

if (!built) console.warn('[gwb-docfirst-workflow] dist/ 还没造齐，产物组跳过（pnpm build 之后再跑）')

/** node 半运行时真 import 的：契约包（isRecord）。那几个件都是 import type，整句擦除 */
const ALLOWED_BARE = new Set(['@team/gwb-plugin-api'])

const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

describe('产物', () => {
  const nodeHalf = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) : []

  it.skipIf(!built)('产物是平的一层——`../template/attach/` 那条路两态同一个相对位置，靠的就是这个', () => {
    expect(nodeHalf.sort()).toEqual(['attach.js', 'deps.js', 'index.js', 'manifest.js', 'skeleton.js', 'template.js', 'values.js'])
    expect(fs.existsSync(path.join(distDir, 'client.js'))).toBe(false)
    expect(fs.existsSync(path.join(distDir, 'template')), '模板不进 dist，它原地躺在包根靠 files 发出去').toBe(false)
  })

  it.skipIf(!built)('相对 import 一律带扩展名——产物给 node 直接加载，ESM 不做补全', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(RELATIVE)) if (!m[1]!.endsWith('.js')) bad.push(`${file}: ${m[1]!}`)
    }
    expect(bad).toEqual([])
  })

  it.skipIf(!built)('裸名只有契约包', () => {
    const bare = new Set<string>()
    for (const file of nodeHalf) {
      for (const m of read(file).matchAll(BARE)) if (!m[1]!.startsWith('node:')) bare.add(m[1]!)
    }
    expect([...bare].filter((s) => !ALLOWED_BARE.has(s))).toEqual([])
  })

  it.skipIf(!built)('总线上只剩装六区那一条——命令名是公共面，改名就是破约', () => {
    const host = read('index.js')
    expect(host).toContain("'docfirst.attach'")
    // 转发那三条随「件不许依赖包」一起去掉：核对要在**仓**里发生，agent 自己 cd 过去跑 pnpm doc。
    // 反馈那两条随「跨仓反馈集中投总控台」去掉：落点固定之后，投反馈就是往一个固定路径的 md 追加一段
    for (const gone of ['live-doc.cli', 'live-doc.cli-raw', 'live-doc.stale', 'live-doc.feedback', 'live-doc.feedback-list']) {
      expect(host, `${gone} 还在总线上`).not.toContain(`'${gone}'`)
    }
    // 站的一生那几条归站件（docs-site.*）
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
    devDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const index = fs.readFileSync(path.join(root, 'src', 'index.ts'), 'utf8')

  it('六份说明书进了 files——漏了包照发、照装得上，直到挂载去扫目录时才报读不动', () => {
    expect(manifest.files).toContain('skills')
    for (const skill of ['docfirst', 'docfirst-docs', 'trajectory', 'spec-grill', 'parallel-by-module', 'docs-governance']) {
      expect(fs.existsSync(path.join(root, 'skills', skill, 'SKILL.md')), `skills/${skill}/SKILL.md`).toBe(true)
    }
    expect(fs.readFileSync(path.join(root, 'skills', 'docfirst', 'SKILL.md'), 'utf8')).toMatch(/^---\s*\nname: docfirst\n/)
  })

  it('template 进了 files——漏了包照发、照装得上，直到跑 attach 那一刻才报读不动', () => {
    expect(manifest.files).toContain('template')
    expect(fs.existsSync(path.join(root, 'template', 'attach', 'docfirst.config.mjs.tpl'))).toBe(true)
  })

  /**
   * **这条守的是这一轮的判据本身：件的消费方是 agent，包的消费方是仓，件不许依赖包。**
   *
   * 包里留的是判定引擎、比较器、格式实现、站接线与命令行的核对 / 确认 / 渲染 / 轨迹——那几条
   * 要在**仓**里发生（门禁、站构建），agent 要核对就自己 cd 过去跑 `pnpm doc`，件不转发。
   * 件里留的是说明书与铺模板类的动作，那些只在 agent 手上发生。
   *
   * 一旦哪天为了省事又把那个包写回任何一档，件就又回到「攥着 home 里一条解析出来的真实路径、
   * 包升级之后照读旧文件、零报错」那个坑里——三档全查：运行时、peer、开发期。
   */
  it('件对 @team/docfirst-workflow 零依赖：三档一档都不许有它，源码里也一行都不 import', () => {
    for (const [table, deps] of Object.entries({
      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,
      devDependencies: manifest.devDependencies,
    })) {
      for (const dep of Object.keys(deps ?? {})) {
        expect(dep.startsWith('@team/docfirst-workflow'), `${table} 里出现了 ${dep}——件不许依赖包`).toBe(false)
      }
    }
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      for (const m of src.matchAll(BARE)) {
        expect(m[1]!.startsWith('@team/docfirst-workflow'), `src/${file} import 了 ${m[1]!}`).toBe(false)
      }
    }
    // 那张写进目标站 package.json 的依赖表不算依赖：它是字符串，件一行都不 import，
    // 而装出来的站要跑 pnpm doc——那是仓里的事，仓当然该装那个包
    expect(fs.readFileSync(path.join(root, 'src', 'deps.ts'), 'utf8')).toContain('@team/docfirst-workflow')
  })

  it('不起任何子进程、不登记 node CLI——转发一条命令行就是把「在仓里发生」的事挪到件里', () => {
    for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(root, 'src', file), 'utf8')
      expect(src, `src/${file} 起了子进程`).not.toMatch(/node:child_process|gwbNodeCli/)
    }
    expect(manifest.peerDependencies?.['@team/gwb-node-cli']).toBeUndefined()
    expect(manifest.devDependencies?.['@team/gwb-node-cli']).toBeUndefined()
  })

  it('skills 是可选 peer，注册那段走 ctx.inject 的子 fiber、不进 export const inject', () => {
    expect(manifest.peerDependencies?.['@team/gwb-skills']).toBeDefined()
    expect(manifest.peerDependenciesMeta?.['@team/gwb-skills']?.optional).toBe(true)
    expect(index).toMatch(/ctx\.inject\(\['gwbSkills'\]/)
    expect(index).toMatch(/export const inject = \['gwbCommands'\]/)
  })

  /**
   * 两个件互不依赖：站件的东西本件一档都不写、一行都不 import。装六区要的只是一个绝对路径，
   * 骨架是谁铺的、站有没有在跑，本件都不问。
   */
  it('站件不在任何一档依赖里，也不被 import', () => {
    const all = { ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.devDependencies }
    expect(Object.keys(all)).not.toContain('@team/gwb-docs-site')
    expect(index).not.toMatch(/from '@team\/gwb-docs-site'/)
  })

  it('本件不注册窗格——站件那格已经叫「文档站」，两格同名分不出谁是谁', () => {
    expect(index).not.toContain('registerPane')
    expect(index).not.toContain('gwbShell')
    expect(manifest.peerDependencies?.['@team/gwb-shell']).toBeUndefined()
  })

  it('cordis 与 electron 都不在 dependencies——前者写进去就是第二份实例，后者本件根本不用', () => {
    expect(manifest.dependencies?.['cordis']).toBeUndefined()
    expect(manifest.dependencies?.['electron']).toBeUndefined()
  })
})
