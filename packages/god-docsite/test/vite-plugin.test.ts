import type { EnvironmentModuleNode } from 'vite'
import { describe, expect, it } from 'vitest'
import { collectionDirsOf } from '../src/vite/collections.js'
import { collectorModulesToAdd } from '../src/vite/content-collectors.js'
import { featureDependencyIncludes, isSitePackage } from '../src/vite/framework-packages.js'

function moduleNode(id: string | null): EnvironmentModuleNode {
  return { id } as EnvironmentModuleNode
}

describe('collectorModulesToAdd', () => {
  it('只补列表里还没有的收集模块；id 为 null 的不补（补了服务端会整体重新转换，首个请求慢到 8 秒）', () => {
    const changed = moduleNode('/site/content/new.mdx')
    const server = moduleNode('/site/.source/server.ts')
    const browser = moduleNode('/site/.source/browser.ts')
    const unresolved = moduleNode(null)
    expect(collectorModulesToAdd([changed, server], [server, browser, unresolved, browser])).toEqual([browser])
    expect(collectorModulesToAdd([server, browser], [server, browser])).toEqual([])
  })
})

describe('collectionDirsOf', () => {
  const docs = { type: 'docs', dir: 'content', docs: {}, meta: {} }
  it('取出全部集合的目录与 docs 集合的目录，default 导出不算集合', () => {
    expect(collectionDirsOf({ default: { mdxOptions: {} }, docs, comments: { type: 'doc', dir: 'comments' } })).toEqual({ all: ['content', 'comments'], pages: 'content' })
  })

  it('没有集合、docs 集合不是正好一个、dir 写错都报错', () => {
    expect(() => collectionDirsOf({ default: {} })).toThrow(/没有集合/)
    expect(() => collectionDirsOf({ comments: { type: 'doc', dir: 'comments' } })).toThrow(/有且只有一个 defineDocs/)
    expect(() => collectionDirsOf({ docs, other: { ...docs } })).toThrow(/有且只有一个 defineDocs/)
    expect(() => collectionDirsOf({ docs, notes: { type: 'doc', dir: 3 } })).toThrow(/notes 的 dir/)
  })
})

describe('isSitePackage', () => {
  it('peerDependencies 里有 fumadocs-core 或 @fumadocs/base-ui 的是站点包', () => {
    expect(isSitePackage({ peerDependencies: { 'fumadocs-core': '16' } })).toBe(true)
    expect(isSitePackage({ peerDependencies: { '@fumadocs/base-ui': '16' } })).toBe(true)
    expect(isSitePackage({ dependencies: { 'fumadocs-core': '16' } })).toBe(false)
  })

  it('导出 ./site 的是站点包', () => {
    expect(isSitePackage({ exports: { '.': './dist/index.mjs', './site': './dist/site.mjs' } })).toBe(true)
    expect(isSitePackage({ exports: { '.': './dist/index.mjs' } })).toBe(false)
    expect(isSitePackage({ exports: './dist/index.mjs' })).toBe(false)
  })
})

describe('featureDependencyIncludes', () => {
  it('导出 ./site 的功能包的 dependencies 都写成「包 > 依赖」，站点包与去重的包除外；不导出 ./site 的站点包（平台、fumadocs-mdx）不写', () => {
    const collab = {
      name: '@godcreator/collab',
      packageJson: { exports: { '.': './a.mjs', './site': './b.mjs' }, dependencies: { '@godcreator/identity': '^0', 'lucide-react': '1', 'react-markdown': '10', unified: '11' } },
    }
    const mdx = { name: 'fumadocs-mdx', packageJson: { peerDependencies: { 'fumadocs-core': '16' }, dependencies: { esbuild: '0.28' } } }
    expect(featureDependencyIncludes([collab, mdx], new Set(['@godcreator/collab', '@godcreator/identity', 'fumadocs-mdx']))).toEqual(['@godcreator/collab > react-markdown', '@godcreator/collab > unified'])
  })
})
