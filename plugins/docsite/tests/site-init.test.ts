import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initSite, type SiteInitDeps } from '../src/site-init.js'

const kitDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/docsite-kit')

let root: string
let siteDir: string

/** 假的依赖：记下调用顺序；addKit / install 照真 pnpm 的效果装包——基础包链到本仓的（模板是真的），别的包装成没有模板的空包 */
function fakeDeps(options: { registered?: boolean; startFails?: boolean; pageStatus?: number } = {}) {
  const events: string[] = []
  const installAs = (dir: string, name: string) => {
    const target = path.join(dir, 'node_modules', ...name.split('/'))
    if (existsSync(target)) return
    mkdirSync(path.dirname(target), { recursive: true })
    if (name === '@godcreator/docsite-kit') {
      symlinkSync(kitDir, target, 'junction')
    } else {
      mkdirSync(target)
      writeFileSync(path.join(target, 'package.json'), `${JSON.stringify({ name, version: '0.0.0' }, null, 2)}\n`)
    }
  }
  const deps: SiteInitDeps = {
    addKit: async (dir) => {
      events.push('add-kit')
      installAs(dir, '@godcreator/docsite-kit')
    },
    install: async (dir) => {
      events.push('install')
      const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
      for (const name of Object.keys(manifest.dependencies ?? {})) installAs(dir, name)
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

type Manifest = { name?: string; private?: boolean; type?: string; scripts: Record<string, string>; dependencies: Record<string, string>; docsite: { features: string[] } }
const manifestOf = () => JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf8')) as Manifest

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docsite-site-init-'))
  siteDir = path.join(root, 'site')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('initSite：从零建站', () => {
  it('空目录：装基础包、写最少的 package.json 等几样、照模板写骨架、装全部依赖、起服务检查后停掉（没登记）', async () => {
    const { events, deps } = fakeDeps()
    const result = await initSite(siteDir, { port: 4560, title: '新站' }, deps)
    expect(result).toEqual({ created: true, features: [] })
    expect(events).toEqual(['add-kit', 'install', 'start', 'page-status', 'stop'])
    const manifest = manifestOf()
    expect(manifest['private']).toBe(true)
    expect(manifest['type']).toBe('module')
    expect(manifest.scripts['dev']).toBe('react-router dev --port 4560 --host 127.0.0.1 --strictPort')
    expect(manifest.dependencies['react-router']).toBeDefined()
    expect(manifest.docsite).toEqual({ features: [] })
    expect(JSON.parse(readFileSync(path.join(siteDir, 'content', 'meta.json'), 'utf8'))).toEqual({ title: '新站', pages: [] })
    expect(readFileSync(path.join(siteDir, 'pnpm-workspace.yaml'), 'utf8')).toContain("'@godcreator/*'")
    expect(existsSync(path.join(siteDir, 'app', 'routes.ts'))).toBe(true)
  })

  it('登记着的站起服务检查后保持运行，不停', async () => {
    const { events, deps } = fakeDeps({ registered: true })
    await initSite(siteDir, { port: 4560, title: '新站' }, deps)
    expect(events).toEqual(['add-kit', 'install', 'start', 'page-status'])
  })

  it('目录里只有 package.json：当新站，保留里面原有的字段', async () => {
    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'package.json'), '{"name":"my-docs"}')
    const { deps } = fakeDeps()
    await initSite(siteDir, { port: 4560, title: '新站' }, deps)
    expect(manifestOf().name).toBe('my-docs')
  })

  it('给了 features（服务面给协作站用）：写进 docsite.features 与依赖，写骨架前先装上功能包', async () => {
    const { events, deps } = fakeDeps()
    await initSite(siteDir, { port: 4560, title: '新站', features: { '@probe/missing': '^1.0.0' } }, deps)
    const manifest = manifestOf()
    expect(manifest.docsite).toEqual({ features: ['@probe/missing'] })
    expect(manifest.dependencies['@probe/missing']).toBe('^1.0.0')
    expect(events).toEqual(['add-kit', 'install', 'install', 'start', 'page-status', 'stop'])
  })

  it('目录里有别的文件、没给 port 或 title，都拒绝，什么也不做', async () => {
    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'readme.txt'), 'hi')
    const notEmpty = fakeDeps()
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, notEmpty.deps)).rejects.toThrow('不是空目录')
    expect(notEmpty.events).toEqual([])
    rmSync(path.join(siteDir, 'readme.txt'))
    const noPort = fakeDeps()
    await expect(initSite(siteDir, { title: '新站' }, noPort.deps)).rejects.toThrow('要给 port（开发端口）与 title（站名）')
    expect(notEmpty.events).toEqual([])
  })

  it('起服务检查起不来：原样报错', async () => {
    const { deps } = fakeDeps({ startFails: true })
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, deps)).rejects.toThrow('没有报出地址')
  })
})

  it('起服务检查探活首页：非 200 报错、站不再停掉', async () => {
    const { events, deps } = fakeDeps({ pageStatus: 500 })
    await expect(initSite(siteDir, { port: 4560, title: '新站' }, deps)).rejects.toThrow('首页（http://127.0.0.1:4560）返回 500')
    expect(events).toContain('start')
    expect(events).not.toContain('stop')
  })

describe('initSite：更新已有站点', () => {
  beforeEach(async () => {
    await initSite(siteDir, { port: 4560, title: '新站' }, fakeDeps().deps)
  })

  it('照装上的模板重写骨架，不重装基础包；模板没带来新依赖就不装', async () => {
    const { events, deps } = fakeDeps()
    const result = await initSite(siteDir, {}, deps)
    expect(result).toEqual({ created: false, features: [] })
    expect(events).toEqual([])
    expect(existsSync(path.join(siteDir, 'app', 'routes.ts'))).toBe(true)
  })

  it('模板带来了新依赖就再装一次', async () => {
    const manifest = manifestOf()
    delete manifest.dependencies['react-router']
    writeFileSync(path.join(siteDir, 'package.json'), JSON.stringify(manifest))
    const { events, deps } = fakeDeps()
    await initSite(siteDir, {}, deps)
    expect(events).toEqual(['install'])
  })

  it('给了 port 或 title 拒绝；给了 features 换掉 docsite.features 与那几项依赖，content/ 不动', async () => {
    const { deps } = fakeDeps()
    await expect(initSite(siteDir, { port: 4561 }, deps)).rejects.toThrow('不能给 port 与 title')
    writeFileSync(path.join(siteDir, 'content', 'meta.json'), '{"title":"改过的名字","pages":[]}\n')
    await expect(initSite(siteDir, { features: { '@probe/missing': '^1.0.0' } }, deps)).rejects.toThrow('node_modules 里没有 @probe/missing')
    const manifest = manifestOf()
    expect(manifest.docsite).toEqual({ features: ['@probe/missing'] })
    expect(manifest.dependencies['@probe/missing']).toBe('^1.0.0')
    expect(readFileSync(path.join(siteDir, 'content', 'meta.json'), 'utf8')).toBe('{"title":"改过的名字","pages":[]}\n')
  })

  it('登记着的站更新完就启动', async () => {
    const { events, deps } = fakeDeps({ registered: true })
    await initSite(siteDir, {}, deps)
    expect(events).toEqual(['start'])
  })
})
