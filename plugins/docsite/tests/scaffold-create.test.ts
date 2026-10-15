import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDocsite, type CreateDocsiteDeps } from '../src/scaffold/create.js'
import { loadPlatformScaffold } from '../src/scaffold/platform.js'
import { fakeHomePageCheck, fakePnpm, longTempDir, readJson, repoDir } from './site-fixtures.js'

let root: string
let siteDir: string

beforeEach(() => {
  root = longTempDir('gwb-docsite-create-')
  siteDir = path.join(root, 'site')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** 真的平台建站器（从插件旁边装着的平台包加载）、link 指向本仓；pnpm 与起服务检查是假的 */
function depsWith(events: string[], options: { registered?: boolean; status?: number } = {}): CreateDocsiteDeps {
  return { ...fakeHomePageCheck(events, options), scaffold: () => loadPlatformScaffold(), packageSource: { kind: 'link', repoDir }, pnpm: fakePnpm(events) }
}

describe('createDocsite：从空目录建站', () => {
  it('复制平台模板、写端口与站名、pnpm install、补上评论这个基础功能、起服务检查后停掉没登记的站', async () => {
    const events: string[] = []
    const result = await createDocsite(siteDir, { port: 4560, title: '新站' }, depsWith(events))
    expect(events).toEqual(['pnpm install', 'start', 'page-status', 'stop'])
    expect(Object.keys(result.platformDependencies).sort()).toEqual(['@godcreator/comments', '@godcreator/god-docsite', '@godcreator/identity'])
    const manifest = readJson(path.join(siteDir, 'package.json')) as { scripts: Record<string, string>; dependencies: Record<string, string> }
    expect(manifest.scripts['dev']).toMatch(/--port 4560$/)
    expect(manifest.dependencies['@godcreator/god-docsite']).toBe(`link:${path.join(repoDir, 'packages', 'god-docsite').replaceAll('\\', '/')}`)
    expect(readJson(path.join(siteDir, 'content', 'meta.json'))['title']).toBe('新站')
    expect(JSON.parse(readFileSync(path.join(siteDir, 'people.json'), 'utf8'))).toEqual([{ id: 'claude', name: 'Claude', agent: true }])
    expect(existsSync(path.join(siteDir, 'app', 'features', 'comments', 'comments.tsx'))).toBe(true)
    expect(readFileSync(path.join(siteDir, 'app', 'features', 'routes.generated.ts'), 'utf8')).toContain("import * as commentsRoutes from './comments/routes.ts'")
    expect(readFileSync(path.join(siteDir, 'app', 'features', 'styles.generated.css'), 'utf8')).toContain("@import './comments/styles.css';")
  })

  it('登记着的站起服务检查后保持运行', async () => {
    const events: string[] = []
    await createDocsite(siteDir, { port: 4560, title: '新站' }, depsWith(events, { registered: true }))
    expect(events).toEqual(['pnpm install', 'start', 'page-status'])
  })

  it('目录不空就拒绝，什么也不做', async () => {
    mkdirSync(siteDir, { recursive: true })
    writeFileSync(path.join(siteDir, 'package.json'), '{"name":"my-docs"}')
    const events: string[] = []
    await expect(createDocsite(siteDir, { port: 4560, title: '新站' }, depsWith(events))).rejects.toThrow('没建成站点：')
    expect(events).toEqual([])
  })

  it('首页不是 200：报错、站点不停', async () => {
    const events: string[] = []
    await expect(createDocsite(siteDir, { port: 4560, title: '新站' }, depsWith(events, { status: 500 }))).rejects.toThrow('首页（http://127.0.0.1:4560）返回 500')
    expect(events).not.toContain('stop')
  })
})
