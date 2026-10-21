import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { unifiedDiffOf } from '../src/scaffold/line-diff.js'
import type { PlatformScaffold } from '../src/scaffold/platform.js'
import { upgradeSite } from '../src/scaffold/upgrade.js'

describe('unifiedDiffOf：模板旧版到新版的统一差异格式', () => {
  it('一样回空串；改、加、删各成一段，前后带两行没变的；\\r\\n 与 \\n 算一样', () => {
    expect(unifiedDiffOf('a\nb\n', 'a\r\nb\r\n')).toBe('')
    const before = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join('\n')
    const after = ['1', '2', '三', '4', '5', '6', '7', '8', '9', '10', '11'].join('\n')
    expect(unifiedDiffOf(before, after)).toBe(['@@ -1,5 +1,5 @@', ' 1', ' 2', '-3', '+三', ' 4', ' 5', '@@ -9,2 +9,3 @@', ' 9', ' 10', '+11'].join('\n'))
    expect(unifiedDiffOf('a\nb\nc\n', 'a\nc\n', 0)).toBe(['@@ -2 +1,0 @@', '-b'].join('\n'))
  })
})

let root: string
let siteDir: string
let pluginDir: string

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'gwb-docsite-upgrade-'))
  siteDir = path.join(root, 'site')
  pluginDir = path.join(root, 'plugin')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

/** 在 parentDir/node_modules 里放一个包：package.json 与 template/ 下给的文件；先删掉旧的那一版 */
function installPackage(parentDir: string, name: string, version: string, template: Record<string, string> = {}): void {
  const dir = path.join(parentDir, 'node_modules', ...name.split('/'))
  rmSync(dir, { recursive: true, force: true })
  write(path.join(dir, 'package.json'), JSON.stringify({ name, version }))
  for (const [relative, text] of Object.entries(template)) write(path.join(dir, 'template', relative), text)
}

const oldPlatformTemplate = { 'app/root.tsx': 'export const a = 1\nexport const b = 2\n', 'app/old.ts': '// 去掉了\n', gitignore: 'node_modules\n' }
const newPlatformTemplate = { 'app/root.tsx': 'export const a = 1\nexport const b = 3\n', 'app/new.ts': '// 新加的\n', gitignore: 'node_modules\n' }

function siteWithOldPackages(): void {
  write(
    path.join(siteDir, 'package.json'),
    JSON.stringify({ dependencies: { '@godcreator/god-docsite': '^0.1.0', '@godcreator/comments': '^0.1.0', '@godcreator/collab': '^0.2.0', '@godcreator/trajectory': 'workspace:*', react: '^19.0.0' } }),
  )
  write(path.join(siteDir, 'docsite.json'), JSON.stringify({ kind: 'base', format: 1 }))
  installPackage(siteDir, '@godcreator/god-docsite', '0.1.0', oldPlatformTemplate)
  installPackage(siteDir, '@godcreator/comments', '0.1.0', { 'styles.css': '.c {}\n' })
  installPackage(siteDir, '@godcreator/collab', '0.2.0')
  write(path.join(siteDir, 'app/root.tsx'), 'export const a = 1\nexport const b = 2\n// 站点自己加的\n')
  write(path.join(siteDir, 'app/old.ts'), '// 去掉了\n')
  write(path.join(siteDir, 'app/features/comments/styles.css'), '.c {}\n')
  installPackage(pluginDir, '@godcreator/god-docsite', '0.2.0')
  installPackage(pluginDir, '@godcreator/comments', '0.2.0')
}

function upgradeDeps(pnpmCalls: string[][], running = false) {
  return {
    versionsFrom: pluginDir,
    isRunning: () => running,
    pnpm: async (_dir: string, args: readonly string[]) => {
      pnpmCalls.push([...args])
      installPackage(siteDir, '@godcreator/god-docsite', '0.2.0', newPlatformTemplate)
      installPackage(siteDir, '@godcreator/comments', '0.2.0', { 'styles.css': '.c { color: red }\n' })
    },
    scaffold: async () => ({ regenerateFeatureIndex: () => ({ features: ['comments'], files: [] }) }) as unknown as PlatformScaffold,
  }
}

describe('upgradeSite：升包、重写汇总文件、列出模板变了的文件', () => {
  it('升插件旁边有的、从 registry 装的包；别的写明为什么没升；模板的变化按站点里文件的样子分开', async () => {
    siteWithOldPackages()
    const pnpmCalls: string[][] = []
    const result = await upgradeSite(siteDir, {}, upgradeDeps(pnpmCalls))
    expect(pnpmCalls).toEqual([['add', '@godcreator/comments@^0.2.0', '@godcreator/god-docsite@^0.2.0']])
    expect(result.upgraded).toEqual([
      { name: '@godcreator/comments', from: '0.1.0', to: '0.2.0' },
      { name: '@godcreator/god-docsite', from: '0.1.0', to: '0.2.0' },
    ])
    expect(result.notUpgraded.map(({ name, specifier }) => [name, specifier])).toEqual([
      ['@godcreator/collab', '^0.2.0'],
      ['@godcreator/trajectory', 'workspace:*'],
    ])
    expect(result.features).toEqual(['comments'])
    expect(result.templateChanges).toEqual([
      { file: 'app/features/comments/styles.css', template: 'changed', site: 'old', diff: '@@ -1 +1 @@\n-.c {}\n+.c { color: red }' },
      { file: 'app/new.ts', template: 'added', site: 'missing' },
      { file: 'app/old.ts', template: 'removed', site: 'old' },
      { file: 'app/root.tsx', template: 'changed', site: 'own', diff: '@@ -1,2 +1,2 @@\n export const a = 1\n-export const b = 2\n+export const b = 3' },
    ])
    expect(result.identityFile).toEqual({ kind: 'base', format: 1 })
  })

  it('建站时写一次、归站点维护的文件（内容、依赖清单）与 docfirst 的起始物不列', async () => {
    write(path.join(siteDir, 'package.json'), JSON.stringify({ dependencies: { '@godcreator/god-docsite': '^0.1.0' }, devDependencies: { '@godcreator/docfirst': '^0.1.0' } }))
    installPackage(siteDir, '@godcreator/god-docsite', '0.1.0', { 'content/start.mdx': '旧起始页\n', 'package.json': '{"name":"旧"}\n' })
    installPackage(siteDir, '@godcreator/docfirst', '0.1.0', { 'docfirst.config.mjs': '// 旧\n' })
    installPackage(pluginDir, '@godcreator/god-docsite', '0.2.0')
    installPackage(pluginDir, '@godcreator/docfirst', '0.2.0')
    const deps = {
      ...upgradeDeps([]),
      pnpm: async () => {
        installPackage(siteDir, '@godcreator/god-docsite', '0.2.0', { 'content/start.mdx': '新起始页\n', 'package.json': '{"name":"新"}\n' })
        installPackage(siteDir, '@godcreator/docfirst', '0.2.0', { 'docfirst.config.mjs': '// 新\n' })
      },
    }
    const result = await upgradeSite(siteDir, {}, deps)
    expect(result.upgraded.map(({ name }) => name)).toEqual(['@godcreator/docfirst', '@godcreator/god-docsite'])
    expect(result.templateChanges).toEqual([])
  })

  it('站点在运行、没装依赖时拒绝，不动包', async () => {
    siteWithOldPackages()
    const pnpmCalls: string[][] = []
    await expect(upgradeSite(siteDir, {}, upgradeDeps(pnpmCalls, true))).rejects.toThrow('先 docsite.site.stop')
    rmSync(path.join(siteDir, 'node_modules'), { recursive: true })
    await expect(upgradeSite(siteDir, {}, upgradeDeps(pnpmCalls))).rejects.toThrow('先在站点目录里 pnpm install')
    expect(pnpmCalls).toEqual([])
  })

  it('versions 给插件旁边没装的包指定版本；不在站点依赖里、写的不是版本范围就拒绝', async () => {
    siteWithOldPackages()
    const pnpmCalls: string[][] = []
    await expect(upgradeSite(siteDir, { '@godcreator/word-report': '^0.1.0' }, upgradeDeps(pnpmCalls))).rejects.toThrow('不在站点的依赖里')
    await expect(upgradeSite(siteDir, { '@godcreator/collab': 'latest' }, upgradeDeps(pnpmCalls))).rejects.toThrow('要写成版本范围')
    const result = await upgradeSite(siteDir, { '@godcreator/collab': '^0.3.0' }, upgradeDeps(pnpmCalls))
    expect(pnpmCalls).toEqual([['add', '@godcreator/collab@^0.3.0', '@godcreator/comments@^0.2.0', '@godcreator/god-docsite@^0.2.0']])
    expect(result.notUpgraded.map(({ name }) => name)).toEqual(['@godcreator/trajectory'])
  })
})
