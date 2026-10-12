import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { featureRouteFilesOf } from '../src/routes.js'

const featureName = '@probe/feature'

let root: string
let siteDir: string
let featureDir: string

/** 站点的 node_modules 里放假功能包：和 pnpm 一样是链接，真实目录在别处 */
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'docsite-routes-'))
  siteDir = path.join(root, 'site')
  featureDir = path.join(root, 'feature-package')
  mkdirSync(featureDir, { recursive: true })
  writeFileSync(path.join(featureDir, 'package.json'), JSON.stringify({ name: featureName }))
  mkdirSync(path.join(featureDir, 'dist', 'routes'), { recursive: true })
  writeFileSync(path.join(featureDir, 'dist', 'routes', 'tasks.js'), 'export default function Tasks() {}\n')
  mkdirSync(siteDir, { recursive: true })
  mkdirSync(path.join(siteDir, 'node_modules', '@probe'), { recursive: true })
  symlinkSync(featureDir, path.join(siteDir, 'node_modules', '@probe', 'feature'), 'junction')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('featureRouteFilesOf', () => {
  it('路由文件换成相对 app/ 的真实路径，不经过 node_modules 的链接', () => {
    const appDir = path.join(siteDir, 'app')
    mkdirSync(appDir)
    const [route] = featureRouteFilesOf(appDir, [{ name: featureName, routes: [{ path: 'tasks', file: 'dist/routes/tasks.js' }] }])
    expect(route).toEqual({ path: 'tasks', file: '../../feature-package/dist/routes/tasks.js' })
    expect(statSync(path.resolve(appDir, route!.file)).isFile()).toBe(true)
  })

  it('路由文件不在包里、首页多于一个，都报错', () => {
    const appDir = path.join(siteDir, 'app')
    mkdirSync(appDir)
    expect(() => featureRouteFilesOf(appDir, [{ name: featureName, routes: [{ path: 'x', file: 'dist/routes/x.js' }] }])).toThrow('不在包里')
    const twoIndexes = [{ name: featureName, routes: [{ index: true as const, file: 'dist/routes/tasks.js' }, { index: true as const, file: 'dist/routes/tasks.js' }] }]
    expect(() => featureRouteFilesOf(appDir, twoIndexes)).toThrow('首页只能有一个')
  })
})
