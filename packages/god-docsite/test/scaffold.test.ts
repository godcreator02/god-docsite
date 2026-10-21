import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { addBaseFeatures, addFeature, createSite, regenerateFeatureIndex, type PackageSource } from '../src/node/scaffold/index.js'
import { scanExports } from '../src/node/scaffold/exported-names.js'

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const platformPackageNames = ['@godcreator/comments', '@godcreator/god-docsite', '@godcreator/identity']
const people = [{ id: 'tester', name: '测试员', codes: ['e2etestcode01'] }]

const tempDirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'god-docsite-scaffold-'))
  tempDirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function writeFile(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

function newSite(packageSource: PackageSource = { kind: 'link', repoDir }): string {
  const dir = path.join(tempDir(), 'site')
  createSite({ dir, siteName: '测试站', people, packageSource })
  return dir
}

/** 在站点 node_modules 里放一个功能包（package.json 加 template/ 下给定的文件），并写进站点 package.json 的依赖 */
function installFakeFeature(siteDir: string, name: string, templateFiles: Record<string, string>, collections?: string[]): void {
  const dir = path.join(siteDir, 'node_modules', ...name.split('/'))
  writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.2.3', ...(collections ? { godDocsite: { collections } } : {}) }))
  for (const [relative, text] of Object.entries(templateFiles)) writeFile(path.join(dir, 'template', relative), text)
  const manifestFile = path.join(siteDir, 'package.json')
  const manifest = readJson(manifestFile) as { dependencies: Record<string, string> }
  manifest.dependencies[name] = '^1.2.3'
  writeFileSync(manifestFile, JSON.stringify(manifest))
}

const demoTemplate = {
  'routes.ts': "export default []\n",
  'feature.tsx': 'export const mdxComponents = {}\n',
  'mdx.ts': "export const remarkPlugins = []\nexport const collections = { demoNotes: () => ({}) }\n",
  'styles.css': "@import 'demo/styles.css';\n",
  'page.tsx': 'export default function Page() { return null }\n',
}

describe('scanExports', () => {
  it('认出点名的导出，跳过类型，记下 default 与 export *', () => {
    const scan = scanExports(
      [
        '// export const commented = 1',
        '/* export function hidden() {} */',
        "export const a = 'https://example.com'",
        'export async function b() {}',
        'export class C {}',
        'export type T = string',
        'export interface I {}',
        'export { d, e as f, type G } from "./x"',
        'export type { H } from "./y"',
        'export default {}',
        "export * from './z.ts'",
      ].join('\n'),
      'x.ts',
    )
    expect(scan).toEqual({ names: ['a', 'b', 'C', 'd', 'f'], hasDefault: true, starFrom: ['./z.ts'] })
  })

  it('认不出名字的导出报错', () => {
    expect(() => scanExports('export const { a, b } = obj', 'x.ts')).toThrow(/认不出名字的导出/)
  })
})

describe('createSite', () => {
  it('link 装法：复制模板、换掉 {{version}}、写站名 people 与空的汇总文件，dev 脚本不写端口', () => {
    const dir = newSite()
    const manifest = readJson(path.join(dir, 'package.json')) as { dependencies: Record<string, string>; scripts: Record<string, string> }
    for (const name of platformPackageNames) expect(manifest.dependencies[name]).toBe(`link:${path.join(repoDir, 'packages', name.split('/')[1]!).replaceAll('\\', '/')}`)
    expect(manifest.scripts['dev']).not.toContain('--port')
    expect(readJson(path.join(dir, 'content', 'meta.json'))['title']).toBe('测试站')
    expect(JSON.parse(readFileSync(path.join(dir, 'people.json'), 'utf8'))).toEqual(people)
    expect(readFileSync(path.join(dir, '.gitignore'), 'utf8')).toContain('node_modules/')
    expect(existsSync(path.join(dir, 'gitignore'))).toBe(false)
    const workspace = readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8')
    expect(workspace).toContain('esbuild: true')
    expect(workspace).not.toContain('overrides')
    expect(readFileSync(path.join(dir, 'app', 'features', 'routes.generated.ts'), 'utf8')).toContain('const featureRoutesModules: FeatureRoutesModule[] = []')
    expect(readFileSync(path.join(dir, 'app', 'features', 'runtime.generated.ts'), 'utf8')).toContain('siteFeatureRuntime({})')
    expect(readFileSync(path.join(dir, 'app', 'features', 'collections.generated.ts'), 'utf8')).toContain('export {}')
    expect(readFileSync(path.join(dir, 'app', 'features', 'styles.generated.css'), 'utf8')).not.toContain('@import')
    expect(readFileSync(path.join(dir, 'app', 'features', 'server.generated.ts'), 'utf8')).toContain('export const featureSections: FeatureSections[] = []')
  })

  it('registry 装法：版本取各包自己 package.json 的 version', () => {
    const resolveFrom = path.join(tempDir(), 'host', 'lib')
    for (const [index, name] of platformPackageNames.entries()) {
      writeFile(path.join(resolveFrom, '..', 'node_modules', ...name.split('/'), 'package.json'), JSON.stringify({ name, version: `0.${index + 1}.0` }))
    }
    const dir = newSite({ kind: 'registry', resolveFrom })
    const { dependencies } = readJson(path.join(dir, 'package.json')) as { dependencies: Record<string, string> }
    expect(platformPackageNames.map((name) => dependencies[name])).toEqual(['^0.1.0', '^0.2.0', '^0.3.0'])
  })

  it('registry 装法找不到包时报错', () => {
    expect(() => newSite({ kind: 'registry', resolveFrom: tempDir() })).toThrow(/找不到 @godcreator\/comments/)
  })

  it('file 装法：写 file: 与 overrides；缺 tarball 报错', () => {
    const tarballDir = tempDir()
    const tarballs = Object.fromEntries(platformPackageNames.map((name) => [name, path.join(tarballDir, `${name.split('/')[1]}.tgz`)]))
    for (const file of Object.values(tarballs)) writeFileSync(file, '')
    const dir = newSite({ kind: 'file', tarballs })
    const workspace = readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8')
    expect(workspace).toContain(`'@godcreator/identity': 'file:${tarballs['@godcreator/identity']!.replaceAll('\\', '/')}'`)
    const { ['@godcreator/identity']: _identity, ...withoutIdentity } = tarballs
    expect(() => newSite({ kind: 'file', tarballs: withoutIdentity })).toThrow(/没给 @godcreator\/identity 的 tarball/)
  })

  it('目录非空时报错', () => {
    const dir = tempDir()
    writeFileSync(path.join(dir, 'x.txt'), '')
    expect(() => createSite({ dir, siteName: '站', people, packageSource: { kind: 'link', repoDir } })).toThrow(/不是空目录/)
  })
})

describe('addFeature', () => {
  it('补进功能目录并生成汇总文件；重复运行不动改过的、补回删掉的、重写汇总文件', () => {
    const siteDir = newSite()
    installFakeFeature(siteDir, '@godcreator/demo-feature', demoTemplate, ['demoNotes'])
    const first = addFeature({ siteDir, packageName: '@godcreator/demo-feature' })
    expect(first).toEqual({ feature: 'demo-feature', addedFiles: Object.keys(demoTemplate).sort(), keptFiles: [], features: ['demo-feature'] })
    const featuresDir = path.join(siteDir, 'app', 'features')
    const indexText = (file: string) => readFileSync(path.join(featuresDir, file), 'utf8')
    expect(indexText('routes.generated.ts')).toContain("import * as demoFeatureRoutes from './demo-feature/routes.ts'")
    expect(indexText('runtime.generated.ts')).toContain("siteFeatureRuntime({ 'demo-feature': demoFeatureFeature })")
    expect(indexText('mdx.generated.ts')).toContain("import * as demoFeatureMdx from './demo-feature/mdx.ts'")
    expect(indexText('mdx.generated.ts')).toContain('const featureMdxModules: FeatureMdxModule[] = [demoFeatureMdx]')
    expect(indexText('collections.generated.ts')).toContain("import { sitePlugins } from '../lib/mdx-plugins.ts'")
    expect(indexText('collections.generated.ts')).toContain('export const demoNotes = demoFeatureMdx.collections.demoNotes(sitePlugins)')
    expect(indexText('styles.generated.css')).toContain("@import './demo-feature/styles.css';")

    const pageFile = path.join(featuresDir, 'demo-feature', 'page.tsx')
    writeFileSync(pageFile, '// 用户改过\n')
    rmSync(path.join(featuresDir, 'demo-feature', 'routes.ts'))
    const routesIndex = indexText('routes.generated.ts')
    writeFileSync(path.join(featuresDir, 'routes.generated.ts'), '// 坏了\n')
    const again = addFeature({ siteDir, packageName: '@godcreator/demo-feature' })
    expect(again.addedFiles).toEqual(['routes.ts'])
    expect(readFileSync(pageFile, 'utf8')).toBe('// 用户改过\n')
    expect(indexText('routes.generated.ts')).toBe(routesIndex)
  })

  it('功能包没装、没有 template/ 时报错并说明', () => {
    const siteDir = newSite()
    expect(() => addFeature({ siteDir, packageName: '@godcreator/missing' })).toThrow(/pnpm add @godcreator\/missing/)
    installFakeFeature(siteDir, '@godcreator/no-template', {})
    expect(() => addFeature({ siteDir, packageName: '@godcreator/no-template' })).toThrow(/没有 template\//)
  })

  it('功能的集合与站点的集合重名时报错', () => {
    const siteDir = newSite()
    installFakeFeature(siteDir, '@godcreator/clash', { 'mdx.ts': 'export const collections = { comments: () => ({}) }\n' }, ['comments'])
    expect(() => addFeature({ siteDir, packageName: '@godcreator/clash' })).toThrow(/集合名 comments/)
  })

  it('有 mdx.ts 的功能目录在站点依赖里找不到功能包、集合名单写错时报错', () => {
    const siteDir = newSite()
    writeFile(path.join(siteDir, 'app', 'features', 'orphan', 'mdx.ts'), 'export const remarkPlugins = []\n')
    expect(() => regenerateFeatureIndex(siteDir)).toThrow(/功能名是 orphan 的包有 0 个/)
    rmSync(path.join(siteDir, 'app', 'features', 'orphan'), { recursive: true })
    installFakeFeature(siteDir, '@godcreator/bad-list', { 'mdx.ts': 'export {}\n' }, ['not-an-identifier'])
    expect(() => addFeature({ siteDir, packageName: '@godcreator/bad-list' })).toThrow(/godDocsite 要写成/)
  })

  it('regenerateFeatureIndex 只认含 routes.ts、feature.tsx、mdx.ts、styles.css 或 site.server.ts 的子目录，按名字排序', () => {
    const siteDir = newSite()
    const featuresDir = path.join(siteDir, 'app', 'features')
    writeFile(path.join(featuresDir, 'zeta', 'feature.tsx'), 'export {}\n')
    writeFile(path.join(featuresDir, 'alpha', 'routes.ts'), 'export default []\n')
    writeFile(path.join(featuresDir, 'beta', 'styles.css'), '.beta {}\n')
    writeFile(path.join(featuresDir, 'gamma', 'site.server.ts'), 'export const gammaSite = {}\n')
    writeFile(path.join(featuresDir, 'notes', 'readme.md'), '不是功能\n')
    expect(regenerateFeatureIndex(siteDir).features).toEqual(['alpha', 'beta', 'gamma', 'zeta'])
  })

  it('site.server.ts 导出了 sections 才进服务端汇总', () => {
    const siteDir = newSite()
    const featuresDir = path.join(siteDir, 'app', 'features')
    writeFile(path.join(featuresDir, 'paper-list', 'site.server.ts'), 'export const sections = () => []\n')
    writeFile(path.join(featuresDir, 'collab', 'site.server.ts'), 'export const collabSite = {}\n')
    regenerateFeatureIndex(siteDir)
    const serverIndex = readFileSync(path.join(featuresDir, 'server.generated.ts'), 'utf8')
    expect(serverIndex).toContain("import * as paperListServer from './paper-list/site.server.ts'")
    expect(serverIndex).toContain("export const featureSections: FeatureSections[] = [{ feature: 'paper-list', sections: paperListServer.sections }]")
    expect(serverIndex).not.toContain('collab')
  })

  it('addBaseFeatures：模板跟着装的包里带 template/ 的补进功能目录（comments），没有的跳过（这里装的 identity 是没有 template/ 的假包），重复运行只补缺的；没装先报错', () => {
    const siteDir = newSite()
    expect(() => addBaseFeatures({ siteDir })).toThrow(/node_modules 里没有 @godcreator\/comments/)
    const commentsTemplate = { 'routes.ts': 'export default []\n', 'styles.css': '.c {}\n' }
    for (const [name, templateFiles] of [['@godcreator/comments', commentsTemplate], ['@godcreator/identity', {}]] as const) {
      const dir = path.join(siteDir, 'node_modules', ...name.split('/'))
      writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0' }))
      for (const [relative, text] of Object.entries(templateFiles)) writeFile(path.join(dir, 'template', relative), text)
    }
    const added = addBaseFeatures({ siteDir })
    expect(added.map(({ feature, addedFiles }) => [feature, addedFiles])).toEqual([['comments', ['routes.ts', 'styles.css']]])
    expect(readFileSync(path.join(siteDir, 'app', 'features', 'routes.generated.ts'), 'utf8')).toContain("import * as commentsRoutes from './comments/routes.ts'")
    expect(addBaseFeatures({ siteDir }).map(({ addedFiles, keptFiles }) => [addedFiles, keptFiles])).toEqual([[[], ['routes.ts', 'styles.css']]])
  })

  it('模板只有 styles.css 的功能包：算作功能，只进样式汇总', () => {
    const siteDir = newSite()
    installFakeFeature(siteDir, '@godcreator/style-only', { 'styles.css': "@import '@godcreator/style-only/styles.css';\n" })
    const added = addFeature({ siteDir, packageName: '@godcreator/style-only' })
    expect(added.features).toEqual(['style-only'])
    const indexText = (file: string) => readFileSync(path.join(siteDir, 'app', 'features', file), 'utf8')
    expect(indexText('styles.generated.css')).toContain("@import './style-only/styles.css';")
    expect(indexText('routes.generated.ts')).not.toContain('style-only')
    expect(indexText('runtime.generated.ts')).toContain('siteFeatureRuntime({})')
    expect(indexText('mdx.generated.ts')).not.toContain('style-only')
    expect(indexText('collections.generated.ts')).toContain('export {}')
  })
})
