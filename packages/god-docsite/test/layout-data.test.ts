import { loader } from 'fumadocs-core/source'
import type { LoaderFunctionArgs } from 'react-router'
import { describe, expect, it } from 'vitest'
import { featurePageTreeNodes, siteFeatureLayoutServer } from '../src/site/feature-page-tree.server.js'
import { siteLayoutData } from '../src/site/layout.server.js'
import { htmlPageSource, tsxPageSource } from '../src/site/page-sources.js'
import type { BaseSiteContext, SiteSource } from '../src/site/site-context.js'

function sourceWith(pages: Record<string, { title: string }>): SiteSource {
  return loader({
    source: { tsx: tsxPageSource(pages), html: htmlPageSource({}) },
    baseUrl: '/',
  }) as unknown as SiteSource
}

const sidebarLinks = [{ name: '评论', url: '/comments', icon: null, order: 90 }]

describe('siteLayoutData', () => {
  it('根 $id 是内容摘要：同样的内容同一个 id，加一页或改标题就换', async () => {
    const before = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }, sidebarLinks)
    const same = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }, sidebarLinks)
    const added = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' }, '/content/b.page.tsx': { title: '乙' } }) }, sidebarLinks)
    const renamed = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲改' } }) }, sidebarLinks)
    const idOf = (data: typeof before) => (data.pageTree.data as { $id: string }).$id
    expect(idOf(before)).toMatch(/^site-tree-[0-9a-f]{16}$/)
    expect(idOf(same)).toBe(idOf(before))
    expect(idOf(added)).not.toBe(idOf(before))
    expect(idOf(renamed)).not.toBe(idOf(before))
  })

  it('站内地址到标题：页面加上功能的侧栏入口', async () => {
    const data = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }, sidebarLinks)
    expect(data.pageTitles).toEqual({ '/a': '甲', '/comments': '评论' })
  })

  it('功能给的页面树节点接在末尾，进站内地址到标题；节点变了根 $id 跟着换', async () => {
    const source = sourceWith({ '/content/a.page.tsx': { title: '甲' } })
    const nodesWith = (title: string) => [{ type: 'separator', name: '在读' } as const, { type: 'page', name: title, url: '/read/x' } as const]
    const data = await siteLayoutData({ source }, sidebarLinks, nodesWith('论文 X'))
    const children = (data.pageTree.data as { children: { type: string; name: unknown; url?: string }[] }).children
    expect(children.map((node) => [node.type, node.url ?? null])).toEqual([['page', '/a'], ['separator', null], ['page', '/read/x']])
    expect(data.pageTitles['/read/x']).toBe('论文 X')
    const renamed = await siteLayoutData({ source }, sidebarLinks, nodesWith('论文 X 改'))
    const idOf = (layout: typeof data) => (layout.pageTree.data as { $id: string }).$id
    expect(idOf(renamed)).not.toBe(idOf(data))
  })
})

describe('功能的 layout.server.ts', () => {
  const args = {} as LoaderFunctionArgs
  const base = {} as BaseSiteContext

  it('按功能名的先后接上各功能给的节点，没导出 pageTreeNodes 的功能跳过；参数原样交给功能', async () => {
    const received: unknown[] = []
    const server = siteFeatureLayoutServer({
      alpha: { pageTreeNodes: (gotArgs, gotBase) => (received.push(gotArgs, gotBase), [{ type: 'page', name: 'A', url: '/a' }]) },
      beta: {},
      gamma: { pageTreeNodes: async () => [{ type: 'separator', name: 'G' }] },
    })
    expect(server.pageTreeNodes.map((loader) => loader.feature)).toEqual(['alpha', 'gamma'])
    expect(await featurePageTreeNodes(server, args, base)).toEqual([{ type: 'page', name: 'A', url: '/a' }, { type: 'separator', name: 'G' }])
    expect(received).toEqual([args, base])
  })
})
