import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import featureRoutes from '../src/feature/routes.js'

const packageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('功能包交出的路由', () => {
  it('每条路由的 dist/ 文件都有 src/ 里的路由模块，构建后就在', () => {
    for (const route of featureRoutes.routes) {
      const source = route.file.replace(/^dist\//, 'src/').replace(/\.js$/, '')
      expect([`${source}.ts`, `${source}.tsx`].some((file) => existsSync(path.join(packageDir, file))), route.file).toBe(true)
    }
  })

  it('首页只有一个，接口放在整站布局外面', () => {
    expect(featureRoutes.routes.filter((route) => 'index' in route)).toHaveLength(1)
    expect(featureRoutes.routes.find((route) => 'path' in route && route.path === 'api/collab')).toMatchObject({ layout: false })
  })
})
