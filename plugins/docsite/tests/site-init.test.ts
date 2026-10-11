import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initSite } from '../src/site-init.js'

const kitDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/docsite-kit')

let root: string
let siteDir: string
let installs: number

/** 假的装依赖：只在站点的 node_modules 里放指向基础包的链接 */
const deps = {
  kitVersion: '0.1.5',
  install: async (dir: string) => {
    installs += 1
    const link = path.join(dir, 'node_modules', '@godcreator', 'docsite-kit')
    if (existsSync(link)) return
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(kitDir, link, 'junction')
  },
}
const whileStopped = async <T>(_dir: string, work: () => Promise<T>) => ({ result: await work() })
type Manifest = { scripts: Record<string, string>; dependencies: Record<string, string>; docsite: { features: string[] } }
const manifestOf = () => JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf8')) as Manifest

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docsite-site-init-'))
  siteDir = path.join(root, 'site')
  installs = 0
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('initSite', () => {
  it('新站点：写最少的 package.json、pnpm-workspace.yaml、content/meta.json，装依赖、写骨架，模板带来依赖就再装一次', async () => {
    const result = await initSite(siteDir, { port: 4560, title: '新站' }, deps, whileStopped)
    expect(result).toEqual({ created: true, features: [] })
    const manifest = manifestOf()
    expect(manifest.dependencies['@godcreator/docsite-kit']).toBe('^0.1.5')
    expect(manifest.dependencies['react-router']).toBeDefined()
    expect(manifest.scripts.dev).toMatch(/--port 4560/)
    expect(manifest.docsite).toEqual({ features: [] })
    expect(JSON.parse(readFileSync(path.join(siteDir, 'content', 'meta.json'), 'utf8'))).toEqual({ title: '新站', pages: [] })
    expect(readFileSync(path.join(siteDir, 'pnpm-workspace.yaml'), 'utf8')).toContain("'@godcreator/*'")
    expect(existsSync(path.join(siteDir, 'app', 'routes.ts'))).toBe(true)
    expect(installs).toBe(2)
  })

  it('新站点没给 port 或 title、已有站点给了，都拒绝', async () => {
    await expect(initSite(siteDir, { port: 4560 }, deps, whileStopped)).rejects.toThrow('要给 port 与 title')
    await initSite(siteDir, { port: 4560, title: '新站' }, deps, whileStopped)
    await expect(initSite(siteDir, { title: '别的名字' }, deps, whileStopped)).rejects.toThrow('不能给 port 与 title')
  })

  it('已有站点：基础包依赖写成 ^插件带的那一版，给了 features 就换掉 docsite.features 与那几项依赖，content/ 不动', async () => {
    await initSite(siteDir, { port: 4560, title: '新站' }, deps, whileStopped)
    writeFileSync(path.join(siteDir, 'content', 'meta.json'), '{"title":"改过的名字","pages":[]}\n')
    const manifest = manifestOf()
    writeFileSync(path.join(siteDir, 'package.json'), JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, '@godcreator/docsite-kit': '^0.1.2' } }))
    await expect(initSite(siteDir, { features: { '@probe/missing': '^1.0.0' } }, deps, whileStopped)).rejects.toThrow('node_modules 里没有 @probe/missing')
    const updated = manifestOf()
    expect(updated.dependencies['@godcreator/docsite-kit']).toBe('^0.1.5')
    expect(updated.dependencies['@probe/missing']).toBe('^1.0.0')
    expect(updated.docsite).toEqual({ features: ['@probe/missing'] })
    expect(readFileSync(path.join(siteDir, 'content', 'meta.json'), 'utf8')).toBe('{"title":"改过的名字","pages":[]}\n')
  })
})
