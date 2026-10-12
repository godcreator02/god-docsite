import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assembleSite, type FeatureTemplate, type PlannedFile } from '../src/scaffold/assemble.js'
import { writeSiteFiles } from '../src/scaffold/write.js'
import { scaffoldKitVersions } from '../src/scaffold/versions.js'

const pluginDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const templateDir = path.join(pluginDir, 'template')

let root: string
let siteDir: string

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docsite-scaffold-'))
  siteDir = path.join(root, 'site')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true })
    writeFileSync(path.join(dir, relative), text)
  }
}

/** 假的功能包模板：mkdtemp 里造包根 */
function featureTemplate(name: string, files: Record<string, string>, manifest: Record<string, unknown> = {}): FeatureTemplate {
  const dir = path.join(root, 'features', name.replaceAll('/', '__'))
  writeFiles(dir, { 'package.json': JSON.stringify({ name, ...manifest }), ...files })
  return { name, version: '1.0.0', dir, manifest: JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) }
}

const plannedOf = (files: readonly PlannedFile[]) => new Map(files.map((file) => [file.relativePath, file.content]))

const assembleInput = (features: readonly FeatureTemplate[] = []) => ({
  kitTemplateDir: templateDir,
  features,
  siteName: 'new-site',
  port: 4560,
  title: '新站',
  versions: scaffoldKitVersions,
})

describe('assembleSite', () => {
  it('骨架模板的文件都在（app/、根配置、gitignore 改回 .gitignore、起始物），package.json 单独合成', () => {
    const planned = plannedOf(assembleSite(assembleInput()))
    expect(planned.get('app/root.tsx')).toBeDefined()
    expect(planned.get('vite.config.ts')).toBeDefined()
    expect(planned.get('.gitignore')).toBeDefined()
    expect(planned.has('gitignore')).toBe(false)
    expect(planned.get('people.json')).toBe('[]\n')
    expect(planned.has('package.json')).toBe(true)
    expect(planned.has('app/site/features.ts')).toBe(true)
  })

  it('功能包的 exports 里有 ./content 才进 app/site/content.ts', () => {
    const plain = plannedOf(assembleSite(assembleInput([featureTemplate('@probe/a', {})])))
    expect(plain.get('app/site/content.ts')).toContain('[]')
    const withContent = plannedOf(assembleSite(assembleInput([featureTemplate('@probe/a', {}, { exports: { './content': './dist/content.js' } })])))
    expect(withContent.get('app/site/content.ts')).toContain(`import feature0 from '@probe/a/content'`)
  })

  it('功能包模板的脚本与依赖合并进 package.json：dev 换新站的端口，依赖同名照骨架的，workspace 依赖换成版本表的精确版本', () => {
    const feature = featureTemplate('@probe/a', {
      'template/skeleton/package.json': JSON.stringify({
        scripts: { docfirst: 'docfirst check', dev: 'react-router dev --port 1' },
        dependencies: { '@probe/tool': '^2.0.0', react: '0.0.0-canary' },
      }),
    })
    const manifest = JSON.parse(plannedOf(assembleSite(assembleInput([feature]))).get('package.json')!) as {
      scripts: Record<string, string>
      dependencies: Record<string, string>
      docsite: { features: string[] }
    }
    expect(manifest.scripts['dev']).toBe('react-router dev --port 4560 --host 127.0.0.1 --strictPort')
    expect(manifest.scripts['docfirst']).toBe('docfirst check')
    expect(manifest.dependencies['@probe/tool']).toBe('^2.0.0')
    expect(manifest.dependencies['react']).not.toBe('0.0.0-canary')
    expect(manifest.dependencies['@godcreator/docsite-kit']).toBe(scaffoldKitVersions['@godcreator/docsite-kit'])
    expect(manifest.dependencies['@probe/a']).toBe('1.0.0')
    expect(manifest.docsite).toEqual({ features: ['@probe/a'] })
  })

  it('功能包模板里的文件和骨架的同名、或写在 app/site/ 下，就报错', () => {
    expect(() => assembleSite(assembleInput([featureTemplate('@probe/same', { 'template/skeleton/app/routes.ts': '替换\n' })]))).toThrow('功能包只能添加文件，不能替换')
    expect(() => assembleSite(assembleInput([featureTemplate('@probe/generated', { 'template/skeleton/app/site/x.ts': '\n' })]))).toThrow('app/site/ 由建站时生成')
  })

  it('版本表缺了骨架模板的 workspace 依赖就报错', () => {
    expect(() => assembleSite({ ...assembleInput(), versions: {} })).toThrow('版本表里没有它')
  })

  it('功能包模板没带 skeleton/package.json 就不并任何脚本与依赖（起始物型的功能包）', () => {
    const planned = plannedOf(assembleSite(assembleInput([featureTemplate('@probe/plain', {})])))
    const manifest = JSON.parse(planned.get('package.json')!) as { scripts: Record<string, string> }
    expect(manifest.scripts['docfirst']).toBeUndefined()
    expect(planned.has('package.json')).toBe(true)
  })
})

describe('writeSiteFiles', () => {
  it('一次写进空目录；中途失败只回滚本次新建的，预存在的文件一个字节不覆盖（package.json 除外）', () => {
    const files: PlannedFile[] = [
      { relativePath: 'a.txt', content: 'A\n' },
      { relativePath: 'dir/b.txt', content: 'B\n' },
    ]
    writeSiteFiles(siteDir, files)
    expect(readFileSync(path.join(siteDir, 'a.txt'), 'utf8')).toBe('A\n')

    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'keep.txt'), '旧的\n')
    expect(() =>
      writeSiteFiles(siteDir, [
        { relativePath: 'new.txt', content: '新\n' },
        { relativePath: 'keep.txt', content: '要覆盖\n' },
      ]),
    ).toThrow()
    expect(readFileSync(path.join(siteDir, 'keep.txt'), 'utf8')).toBe('旧的\n')
    expect(existsSync(path.join(siteDir, 'new.txt'))).toBe(false)
  })

  it('Windows 保留名与非法字符拒绝', () => {
    expect(() => writeSiteFiles(siteDir, [{ relativePath: 'con.txt', content: '' }])).toThrow('Windows 保留的名字')
    expect(() => writeSiteFiles(siteDir, [{ relativePath: 'a<b.txt', content: '' }])).toThrow('不允许的字符')
  })
})

describe('插件自带的骨架模板（派生脚本产物）', () => {
  it('与自述站一致：重跑 sync-template 后没有文件变化，app/site/ 不进模板', () => {
    const before = plannedOf(assembleSite(assembleInput()))
    execFileSync('node', [path.join(pluginDir, 'scripts', 'sync-template.mjs')])
    const after = plannedOf(assembleSite(assembleInput()))
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort())
    for (const [file, content] of after) expect(content, file).toBe(before.get(file))
    expect(existsSync(path.join(templateDir, 'app', 'site'))).toBe(false)
  })
})
