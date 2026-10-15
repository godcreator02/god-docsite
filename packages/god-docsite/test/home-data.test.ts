import type * as PageTree from 'fumadocs-core/page-tree'
import { describe, expect, it } from 'vitest'
import { siteHomeData } from '../src/site/home.server.js'
import type { SitePage, SiteSource } from '../src/site/site-context.js'

const page = (url: string): PageTree.Item => ({ type: 'page', name: url, url })
const group = (id: string, children: PageTree.Node[]): PageTree.Folder => ({ type: 'folder', $id: id, name: id, root: true, children })

function sourceOf(tree: PageTree.Root, rootPage?: SitePage): Pick<SiteSource, 'getPage' | 'getPageTree'> {
  return { getPage: (slugs) => (slugs.length === 0 ? rootPage : undefined), getPageTree: () => tree }
}

describe('siteHomeData', () => {
  it('站名取页面树根的名字，「文档」链到目录切换按钮第一组的第一页', () => {
    const tree: PageTree.Root = { $id: 'root', name: '站', children: [group('guide', [page('/guide/a')]), page('/about')] }
    expect(siteHomeData({ source: sourceOf(tree) as SiteSource })).toEqual({ siteName: '站', docsUrl: '/about' })
  })

  it('第一组是文件夹时取它的首页', () => {
    const docs: PageTree.Folder = { ...group('docs', [page('/docs/b')]), index: page('/docs') }
    const tree: PageTree.Root = { $id: 'root', name: '站', children: [docs, group('more', [page('/more/a')])] }
    expect(siteHomeData({ source: sourceOf(tree) as SiteSource }).docsUrl).toBe('/docs')
  })

  it('内容目录根上有 index 页（地址也是 /）就报错', () => {
    const tree: PageTree.Root = { $id: 'root', name: '站', children: [page('/about')] }
    const rootPage = { type: 'mdx', path: 'index.mdx', url: '/', slugs: [], data: {} } as unknown as SitePage
    expect(() => siteHomeData({ source: sourceOf(tree, rootPage) as SiteSource })).toThrow('index.mdx 的地址是 /')
  })

  it('一页都没有就报错', () => {
    expect(() => siteHomeData({ source: sourceOf({ $id: 'root', name: '站', children: [] }) as SiteSource })).toThrow('一页都没有')
  })
})
