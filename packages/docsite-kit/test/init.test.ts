import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { featureRouteFilesOf, writeSiteSkeleton } from '../src/init.js'

const kitDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const featureName = '@probe/feature'

let root: string
let siteDir: string
let featureDir: string

function writeFiles(dir: string, files: Record<string, string>) {
  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true })
    writeFileSync(path.join(dir, relative), text)
  }
}

const readText = (relative: string) => readFileSync(path.join(siteDir, relative), 'utf8')
const readManifest = () => JSON.parse(readText('package.json'))

/** 站点的 node_modules 里放基础包与假功能包：和 pnpm 一样是链接，真实目录在别处 */
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docsite-init-'))
  siteDir = path.join(root, 'site')
  featureDir = path.join(root, 'feature-package')
  writeFiles(featureDir, {
    'package.json': JSON.stringify({ name: featureName }),
    'dist/routes/tasks.js': 'export default function Tasks() {}',
    'template/skeleton/app/lib/journal.ts': 'export const journal = 1\n',
    'template/initial/journal/first.mdx': '第一篇\n',
  })
  writeFiles(siteDir, {
    'package.json': JSON.stringify({ name: 'site', docsite: { features: [featureName] }, scripts: { dev: 'react-router dev --port 4555 --host 127.0.0.1', check: 'tsc' }, dependencies: { [featureName]: '^1.0.0' } }),
    'content/index.mdx': '首页\n',
    'app/routes/old-route.tsx': '旧骨架留下的文件\n',
  })
  mkdirSync(path.join(siteDir, 'node_modules', '@godcreator'), { recursive: true })
  mkdirSync(path.join(siteDir, 'node_modules', '@probe'), { recursive: true })
  symlinkSync(kitDir, path.join(siteDir, 'node_modules', '@godcreator', 'docsite-kit'), 'junction')
  symlinkSync(featureDir, path.join(siteDir, 'node_modules', '@probe', 'feature'), 'junction')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('writeSiteSkeleton', () => {
  it('app/ 整个换成基础包与功能包模板里的，生成 app/site/，initial/ 的只在没有时写', () => {
    writeFileSync(path.join(siteDir, 'people.json'), '[{"id":"a","name":"甲"}]\n')
    const written = writeSiteSkeleton(siteDir)
    expect(written.features).toEqual([featureName])
    expect(existsSync(path.join(siteDir, 'app/routes/old-route.tsx'))).toBe(false)
    expect(readText('app/routes.ts')).toContain('featureRouteFilesOf')
    expect(readText('app/lib/journal.ts')).toBe('export const journal = 1\n')
    expect(readText('.gitignore')).toContain('node_modules/')
    expect(readText('people.json')).toBe('[{"id":"a","name":"甲"}]\n')
    expect(existsSync(path.join(siteDir, 'comments'))).toBe(false)
    expect(readText('journal/first.mdx')).toBe('第一篇\n')
    expect(readText('content/index.mdx')).toBe('首页\n')
    expect(readText('app/site/features.ts')).toContain(`export const siteFeatures: string[] = ['${featureName}']`)
    expect(readText('app/site/routes.ts')).toContain(`import feature0 from '${featureName}/routes'`)
    expect(readText('app/site/ui.ts')).toContain(`{ name: '${featureName}', ...feature0 }`)
    expect(readText('app/site/data.server.ts')).toContain(`from '${featureName}/site-server'`)
    expect(readText('app/site/styles.css')).toContain(`@import '${featureName}/styles.css';`)
    expect(readText('app/site/content.ts')).toContain('export const featureContents: ReadonlyArray<{ name: string } & FeatureContent> = []')
  })

  it('功能包的 exports 里有 ./content 才进 app/site/content.ts', () => {
    writeFiles(featureDir, { 'package.json': JSON.stringify({ name: featureName, exports: { './content': './dist/content.js' } }) })
    writeSiteSkeleton(siteDir)
    expect(readText('app/site/content.ts')).toContain(`import feature0 from '${featureName}/content'`)
    expect(readText('app/site/content.ts')).toContain(`[{ name: '${featureName}', ...feature0 }]`)
  })

  it('模板的脚本与依赖合并进 package.json：dev 保留站点的端口，站点自己的脚本与依赖留着', () => {
    const written = writeSiteSkeleton(siteDir)
    expect(written.manifestChanged).toBe(true)
    const manifest = readManifest()
    expect(manifest.scripts.dev).toMatch(/--port 4555/)
    expect(manifest.scripts.check).toBe('tsc')
    expect(manifest.scripts.build).toBe('react-router build')
    expect(manifest.dependencies[featureName]).toBe('^1.0.0')
    expect(manifest.dependencies['react-router']).toBeDefined()
    expect(manifest.docsite).toEqual({ features: [featureName] })
    expect(writeSiteSkeleton(siteDir).manifestChanged).toBe(false)
  })

  it('功能包模板里的文件和基础包的同名、或写在 app/site/ 下，就报错', () => {
    writeFiles(featureDir, { 'template/skeleton/app/routes.ts': '替换\n' })
    expect(() => writeSiteSkeleton(siteDir)).toThrow('功能包只能添加文件，不能替换')
    rmSync(path.join(featureDir, 'template/skeleton/app/routes.ts'))
    writeFiles(featureDir, { 'template/skeleton/app/site/x.ts': '\n' })
    expect(() => writeSiteSkeleton(siteDir)).toThrow('app/site/ 由初始化生成')
  })

  it('package.json 没有 docsite.features、dev 没写端口、功能包没装，都报错', () => {
    const manifestFile = path.join(siteDir, 'package.json')
    writeFileSync(manifestFile, JSON.stringify({ scripts: { dev: 'react-router dev --port 4555' } }))
    expect(() => writeSiteSkeleton(siteDir)).toThrow('要有 docsite.features')
    writeFileSync(manifestFile, JSON.stringify({ docsite: { features: [] }, scripts: { dev: 'react-router dev' } }))
    expect(() => writeSiteSkeleton(siteDir)).toThrow('要写 --port <端口>')
    writeFileSync(manifestFile, JSON.stringify({ docsite: { features: ['@probe/missing'] }, scripts: { dev: 'react-router dev --port 4555' } }))
    expect(() => writeSiteSkeleton(siteDir)).toThrow('node_modules 里没有 @probe/missing')
  })
})

describe('featureRouteFilesOf', () => {
  it('路由文件换成相对 app/ 的真实路径，不经过 node_modules 的链接', () => {
    const appDir = path.join(siteDir, 'app')
    const [route] = featureRouteFilesOf(appDir, [{ name: featureName, routes: [{ path: 'tasks', file: 'dist/routes/tasks.js' }] }])
    expect(route).toEqual({ path: 'tasks', file: '../../feature-package/dist/routes/tasks.js' })
    expect(statSync(path.resolve(appDir, route!.file)).isFile()).toBe(true)
  })

  it('路由文件不在包里、首页多于一个，都报错', () => {
    const appDir = path.join(siteDir, 'app')
    expect(() => featureRouteFilesOf(appDir, [{ name: featureName, routes: [{ path: 'x', file: 'dist/routes/x.js' }] }])).toThrow('不在包里')
    const twoIndexes = [{ name: featureName, routes: [{ index: true as const, file: 'dist/routes/tasks.js' }, { index: true as const, file: 'dist/routes/tasks.js' }] }]
    expect(() => featureRouteFilesOf(appDir, twoIndexes)).toThrow('首页只能有一个')
  })
})

describe('自述站', () => {
  it('app/ 与模板的 skeleton/app 一致：改了模板就运行 pnpm site:skeleton', () => {
    const templateApp = path.join(kitDir, 'template', 'skeleton', 'app')
    const siteApp = path.join(kitDir, '..', '..', 'site', 'app')
    const filesUnder = (dir: string, prefix = ''): string[] =>
      readdirSync(dir).flatMap((entry) => (statSync(path.join(dir, entry)).isDirectory() ? filesUnder(path.join(dir, entry), `${prefix}${entry}/`) : [`${prefix}${entry}`]))
    for (const file of filesUnder(templateApp)) {
      expect(readFileSync(path.join(siteApp, file), 'utf8'), file).toBe(readFileSync(path.join(templateApp, file), 'utf8'))
    }
  })
})
