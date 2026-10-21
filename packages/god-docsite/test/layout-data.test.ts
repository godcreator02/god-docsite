import { loader } from 'fumadocs-core/source'
import { describe, expect, it } from 'vitest'
import { siteLayoutData } from '../src/site/layout.server.js'
import { htmlPageSource, tsxPageSource } from '../src/site/page-sources.js'
import type { SiteSource } from '../src/site/site-context.js'
import type { FeatureSections, SiteSection } from '../src/site/site-sections.js'

function sourceWith(pages: Record<string, { title: string }>): SiteSource {
  return loader({
    source: { tsx: tsxPageSource(pages), html: htmlPageSource({}) },
    baseUrl: '/',
  }) as unknown as SiteSource
}

const sidebarLinks = [{ name: '评论', url: '/comments', icon: null, order: 90 }]

type TestSite = { source: SiteSource }

const paperSection: SiteSection = {
  name: '论文',
  order: 20,
  searchUrl: '/papers',
  entries: [
    { name: 'Smith 2020', url: '/papers/smith-2020' },
    { separator: '视频' },
    { name: '一个视频', children: [{ name: '概述', url: '/papers/video' }, { name: '第 1 页', url: '/papers/video/1' }] },
  ],
}

describe('siteLayoutData', () => {
  it('根 $id 是内容摘要：同样的内容同一个 id，加一页或改标题就换', async () => {
    const before = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }, sidebarLinks, [])
    const same = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }, sidebarLinks, [])
    const added = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' }, '/content/b.page.tsx': { title: '乙' } }) }, sidebarLinks, [])
    const renamed = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲改' } }) }, sidebarLinks, [])
    const idOf = (data: typeof before) => (data.pageTree.data as { $id: string }).$id
    expect(idOf(before)).toMatch(/^site-tree-[0-9a-f]{16}$/)
    expect(idOf(same)).toBe(idOf(before))
    expect(idOf(added)).not.toBe(idOf(before))
    expect(idOf(renamed)).not.toBe(idOf(before))
  })

  it('站内地址到标题：页面加上功能的侧栏入口', async () => {
    const data = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }, sidebarLinks, [])
    expect(data.pageTitles).toEqual({ '/a': '甲', '/comments': '评论' })
  })

  it('功能的分区接在内容之后成 root 文件夹：最上面是「检索」，有子项的一项是不带 index 的文件夹；分区里的页并进站内地址到标题', async () => {
    const site: TestSite = { source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) }
    const seenSites: TestSite[] = []
    const notes: FeatureSections<TestSite> = {
      feature: 'notes',
      sections: (given) => {
        seenSites.push(given)
        return [{ name: '笔记', order: 10, searchUrl: '/notes', entries: [] }]
      },
    }
    const papers: FeatureSections<TestSite> = { feature: 'papers', sections: async () => [paperSection] }
    const data = await siteLayoutData(site, sidebarLinks, [papers, notes])
    expect(seenSites).toEqual([site])
    const children = (data.pageTree.data as { children: Array<Record<string, unknown>> }).children
    expect(children.map((node) => [node['type'], node['name'], node['root']])).toEqual([
      ['page', '甲', undefined],
      ['folder', '笔记', true],
      ['folder', '论文', true],
    ])
    const paperFolder = children[2] as { $id: string; index?: unknown; children: Array<{ type: string; name: string; url?: string; index?: unknown; children?: unknown[] }> }
    expect(paperFolder.$id).toBe('section:papers:论文')
    expect(paperFolder.index).toBeUndefined()
    expect(paperFolder.children.map((node) => [node.type, node.name, node.url])).toEqual([
      ['page', '检索', '/papers'],
      ['page', 'Smith 2020', '/papers/smith-2020'],
      ['separator', '视频', undefined],
      ['folder', '一个视频', undefined],
    ])
    expect(paperFolder.children[3]!.index).toBeUndefined()
    expect(paperFolder.children[3]!.children).toHaveLength(2)
    expect(data.pageTitles).toEqual({
      '/a': '甲',
      '/comments': '评论',
      '/papers/smith-2020': 'Smith 2020',
      '/papers/video': '概述',
      '/papers/video/1': '第 1 页',
    })
  })
})
