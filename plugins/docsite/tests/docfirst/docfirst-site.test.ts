import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GwbDocsiteApi } from '../../src/service.js'
import { addDocfirstScripts, createDocfirstSite, DOCFIRST_FEATURES, DOCFIRST_PACKAGE, overlayDocfirstTemplate, packageNearby } from '../../src/docfirst/docfirst-site.js'
import { pluginDir } from '../../src/scaffold/platform.js'

const repoPackagesDir = path.resolve(pluginDir, '..', '..', 'packages')
const versionOf = (unscoped: string) => (JSON.parse(readFileSync(path.join(repoPackagesDir, unscoped, 'package.json'), 'utf8')) as { version: string }).version

let root: string
let siteDir: string

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'gwb-docfirst-site-'))
  siteDir = path.join(root, 'docs-site')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** 基础站建好后的样子：只要 package.json 与模板自己的 content/ 起始页 */
function writeBaseSite(): void {
  mkdirSync(path.join(siteDir, 'content'), { recursive: true })
  writeFileSync(path.join(siteDir, 'package.json'), JSON.stringify({ name: 'docsite', scripts: { dev: 'react-router dev' }, dependencies: {}, devDependencies: { vite: '^8.3.4' } }))
  writeFileSync(path.join(siteDir, 'content', 'start.mdx'), '# 开始\n')
}

describe('插件旁边装着的包', () => {
  it('从插件包根往上的 node_modules 找到 docfirst 与三个功能包，版本是包自己的 version', () => {
    expect(packageNearby(pluginDir, DOCFIRST_PACKAGE).version).toBe(versionOf('docfirst'))
    for (const name of DOCFIRST_FEATURES) expect(packageNearby(pluginDir, name).version).toBe(versionOf(name.replace('@godcreator/', '')))
    expect(() => packageNearby(pluginDir, '@godcreator/not-here')).toThrow('找不到 @godcreator/not-here')
  })
})

describe('叠 docfirst 起始物', () => {
  it('template/ 里站点没有的文件补进站点根，已有的不覆盖', () => {
    writeBaseSite()
    writeFileSync(path.join(siteDir, 'docfirst.config.mjs'), '// 站点自己的\n')
    const { added, kept } = overlayDocfirstTemplate(siteDir, packageNearby(pluginDir, DOCFIRST_PACKAGE).dir)
    expect(kept).toEqual(['docfirst.config.mjs'])
    expect(added).toContain('content/docs/outputs/agents.mdx')
    expect(added).toContain('trajectory/2026-01-01-site-born.md')
    expect(readFileSync(path.join(siteDir, 'docfirst.config.mjs'), 'utf8')).toBe('// 站点自己的\n')
    expect(readFileSync(path.join(siteDir, 'content', 'start.mdx'), 'utf8')).toBe('# 开始\n')
  })

  it('写 doc 系列脚本与 devDependencies 里的命令行；已有同名脚本就报错', () => {
    writeBaseSite()
    addDocfirstScripts(siteDir, '^1.2.3')
    const manifest = JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf8')) as { scripts: Record<string, string>; devDependencies: Record<string, string> }
    expect(manifest.scripts).toEqual({ dev: 'react-router dev', doc: 'docfirst check', 'doc:confirm': 'docfirst confirm', 'doc:render': 'docfirst render' })
    expect(manifest.devDependencies).toEqual({ vite: '^8.3.4', [DOCFIRST_PACKAGE]: '^1.2.3' })
    expect(() => addDocfirstScripts(siteDir, '^1.2.3')).toThrow('已经有脚本 doc、doc:confirm、doc:render')
  })
})

describe('createDocfirstSite', () => {
  it('建基础站 → 叠起始物、写脚本 → 逐个加功能，版本是插件旁边那一版的 ^<版本>', async () => {
    const calls: string[] = []
    const docsite: Pick<GwbDocsiteApi, 'init' | 'addFeature'> = {
      init: async (dir, options) => {
        calls.push(`init ${JSON.stringify(options)}`)
        expect(dir).toBe(siteDir)
        writeBaseSite()
        return { dir, platformDependencies: {} }
      },
      addFeature: async (dir, options) => {
        calls.push(`addFeature ${options.packageName}@${options.specifier}`)
        expect(existsSync(path.join(dir, 'docfirst.config.mjs')), '加功能之前起始物已经叠好').toBe(true)
        const added = calls.filter((call) => call.startsWith('addFeature')).map((call) => call.slice('addFeature @godcreator/'.length).split('@')[0]!)
        return { feature: added.at(-1)!, specifier: options.specifier!, addedFiles: [], keptFiles: [], features: added.sort() }
      },
    }
    const result = await createDocfirstSite(siteDir, { title: '文档站' }, { docsite, packagesFrom: pluginDir })
    expect(calls).toEqual([
      'init {"title":"文档站","kind":"docs"}',
      `addFeature @godcreator/code-pin@^${versionOf('code-pin')}`,
      `addFeature @godcreator/trajectory@^${versionOf('trajectory')}`,
      `addFeature @godcreator/explainer@^${versionOf('explainer')}`,
    ])
    expect(result.features).toEqual(['code-pin', 'explainer', 'trajectory'])
    const manifest = JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf8')) as { devDependencies: Record<string, string> }
    expect(manifest.devDependencies[DOCFIRST_PACKAGE]).toBe(`^${versionOf('docfirst')}`)
  })

  it('建基础站失败：原样报错，后面几步都不做', async () => {
    const calls: string[] = []
    const docsite: Pick<GwbDocsiteApi, 'init' | 'addFeature'> = {
      init: async () => {
        throw new Error('首页返回 500')
      },
      addFeature: async () => {
        calls.push('addFeature')
        throw new Error('不该走到这里')
      },
    }
    await expect(createDocfirstSite(siteDir, { title: '文档站' }, { docsite, packagesFrom: pluginDir })).rejects.toThrow('首页返回 500')
    expect(calls).toEqual([])
    expect(existsSync(siteDir)).toBe(false)
  })
})
