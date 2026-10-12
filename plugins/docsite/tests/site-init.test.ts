import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initSite, type SiteInitDeps, type SiteInitOptions } from '../src/site-init.js'
import type { FeatureTemplate } from '../src/scaffold/assemble.js'

/** 假的功能包模板：mkdtemp 里造包根（package.json + template/skeleton + template/initial），不真的拉 registry */
function fakeFeatureTemplate(name: string, version: string, files: Record<string, string> = {}, exports?: Record<string, string>): FeatureTemplate & { rootDir: string } {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'docsite-fake-feature-'))
  const dir = path.join(rootDir, 'package')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, ...(exports !== undefined ? { exports } : {}) }))
  for (const [relative, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true })
    writeFileSync(path.join(dir, relative), text)
  }
  return { name, version, dir, manifest: JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')), rootDir }
}

let root: string
let siteDir: string

/** 假的依赖：记下调用顺序；模板来自插件自带的 template/（派生脚本生成，beforeAll 里先跑一遍） */
function fakeDeps(options: { registered?: boolean; startFails?: boolean; pageStatus?: number } = {}) {
  const events: string[] = []
  const deps: SiteInitDeps = {
    fetchFeatureTemplate: async (name) => {
      events.push(`fetch:${name}`)
      return fakeFeatureTemplate(name, '9.9.9')
    },
    install: async () => {
      events.push('install')
    },
    isRegistered: () => options.registered ?? false,
    start: async () => {
      events.push('start')
      if (options.startFails) throw new Error('开发服务 60 秒内没有报出地址，已停掉')
      return { url: 'http://127.0.0.1:4560', pid: 1, alreadyRunning: false }
    },
    stop: async () => {
      events.push('stop')
      return { url: 'http://127.0.0.1:4560' }
    },
    pageStatus: async () => {
      events.push('page-status')
      return options.pageStatus ?? 200
    },
  }
  return { events, deps }
}

type Manifest = { name?: string; private?: boolean; type?: string; scripts: Record<string, string>; dependencies: Record<string, string>; devDependencies: Record<string, string>; docsite: { features: string[] } }
const manifestOf = () => JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf8')) as Manifest

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docsite-site-init-'))
  siteDir = path.join(root, 'site')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('initSite：从空目录一步建站', () => {
  it('组装骨架模板、一次写盘、一次 install、起服务检查后停掉（没登记）；workspace 依赖换成版本表的精确版本', async () => {
    const { events, deps } = fakeDeps()
    const result = await initSite(siteDir, { port: 4560, title: '新站' }, deps)
    expect(result).toEqual({ created: true, features: [] })
    expect(events).toEqual(['install', 'start', 'page-status', 'stop'])
    const manifest = manifestOf()
    expect(manifest.name).toBe('site')
    expect(manifest['private']).toBe(true)
    expect(manifest.type).toBe('module')
    expect(manifest.scripts['dev']).toBe('react-router dev --port 4560 --host 127.0.0.1 --strictPort')
    expect(manifest.dependencies['@godcreator/docsite-kit']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(manifest.dependencies['react-router']).toBeDefined()
    expect(manifest.docsite).toEqual({ features: [] })
    expect(JSON.parse(readFileSync(path.join(siteDir, 'content', 'meta.json'), 'utf8'))).toEqual({ title: '新站', pages: [] })
    expect(readFileSync(path.join(siteDir, 'pnpm-workspace.yaml'), 'utf8')).toContain("'@godcreator/*'")
    expect(readFileSync(path.join(siteDir, '.gitignore'), 'utf8')).toContain('node_modules/')
    expect(readFileSync(path.join(siteDir, 'app', 'routes.ts'), 'utf8')).toContain('@godcreator/docsite-kit/routes')
    expect(existsSync(path.join(siteDir, 'people.json'))).toBe(true)
  })

  it('登记着的站起服务检查后保持运行，不停', async () => {
    const { events, deps } = fakeDeps({ registered: true })
    await initSite(siteDir, { port: 4560, title: '新站' }, deps)
    expect(events).toEqual(['install', 'start', 'page-status'])
  })

  it('目录里只有 package.json：当新站建，保留它的 name', async () => {
    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'package.json'), '{"name":"my-docs"}')
    const { deps } = fakeDeps()
    await initSite(siteDir, { port: 4560, title: '新站' }, deps)
    expect(manifestOf().name).toBe('my-docs')
  })

  it('给了 features：拉每个功能包的模板，依赖写解析出的精确版本，模板文件与 app/site/ 都写进去', async () => {
    const { events, deps } = fakeDeps()
    deps.fetchFeatureTemplate = async (name) => {
      events.push(`fetch:${name}`)
      return fakeFeatureTemplate(name, '1.2.3', {
        'template/skeleton/app/lib/journal.ts': 'export const journal = 1\n',
        'template/initial/journal/first.mdx': '第一篇\n',
      })
    }
    await initSite(siteDir, { port: 4560, title: '新站', features: { '@probe/feature': '^1.0.0' } }, deps)
    const manifest = manifestOf()
    expect(manifest.docsite).toEqual({ features: ['@probe/feature'] })
    expect(manifest.dependencies['@probe/feature']).toBe('1.2.3')
    expect(events).toEqual(['fetch:@probe/feature', 'install', 'start', 'page-status', 'stop'])
    expect(readFileSync(path.join(siteDir, 'app', 'lib', 'journal.ts'), 'utf8')).toBe('export const journal = 1\n')
    expect(readFileSync(path.join(siteDir, 'journal', 'first.mdx'), 'utf8')).toBe('第一篇\n')
    expect(readFileSync(path.join(siteDir, 'app', 'site', 'features.ts'), 'utf8')).toContain(`'${'@probe/feature'}'`)
    expect(readFileSync(path.join(siteDir, 'app', 'site', 'content.ts'), 'utf8')).toContain('[]')
  })

  it('拉模板失败：一个文件不写，目录还是空的', async () => {
    const { deps } = fakeDeps()
    deps.fetchFeatureTemplate = async () => {
      throw new Error('registry 不可达')
    }
    await expect(initSite(siteDir, { port: 4560, title: '新站', features: { '@probe/gone': '^1.0.0' } }, deps)).rejects.toThrow('registry 不可达')
    expect(existsSync(path.join(siteDir, 'package.json'))).toBe(false)
  })

  it('目录里有别的文件、没给 port 或 title，都拒绝，什么也不做', async () => {
    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'readme.txt'), 'hi')
    const notEmpty = fakeDeps()
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, notEmpty.deps)).rejects.toThrow('不是空目录')
    expect(notEmpty.events).toEqual([])
    rmSync(path.join(siteDir, 'readme.txt'))
    const noPort = fakeDeps()
    await expect(initSite(siteDir, { title: '新站' } as unknown as SiteInitOptions, noPort.deps)).rejects.toThrow('要给 port（开发端口）与 title（站名）')
    expect(noPort.events).toEqual([])
  })

  it('已经是站点（package.json 有 docsite.features）就拒绝：骨架建完归站点，没有重写通道', async () => {
    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'package.json'), JSON.stringify({ docsite: { features: [] } }))
    const { events, deps } = fakeDeps()
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, deps)).rejects.toThrow('骨架建完就归站点')
    expect(events).toEqual([])
  })

  it('起服务检查起不来：原样报错', async () => {
    const fails = fakeDeps({ startFails: true })
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, fails.deps)).rejects.toThrow('没有报出地址')
  })

  it('探活首页非 200 报错、站不再停掉', async () => {
    const { events, deps } = fakeDeps({ pageStatus: 500 })
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, deps)).rejects.toThrow('首页（http://127.0.0.1:4560）返回 500')
    expect(events).toContain('start')
    expect(events).not.toContain('stop')
  })
})
