import { loader } from 'fumadocs-core/source'
import { describe, expect, it } from 'vitest'
import { siteLayoutData } from '../src/site/layout.server.js'
import { htmlPageSource, tsxPageSource } from '../src/site/page-sources.js'
import { pageTreeLinksPlugin } from '../src/site/page-tree-links.js'
import type { SiteSource } from '../src/site/site-context.js'

function sourceWith(pages: Record<string, { title: string }>): SiteSource {
  return loader({
    source: { tsx: tsxPageSource(pages), html: htmlPageSource({}) },
    baseUrl: '/',
    plugins: [pageTreeLinksPlugin([{ name: '评论', url: '/comments' }])],
  }) as unknown as SiteSource
}

describe('siteLayoutData', () => {
  it('根 $id 是内容摘要：同样的内容同一个 id，加一页或改标题就换', async () => {
    const before = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) })
    const same = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) })
    const added = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' }, '/content/b.page.tsx': { title: '乙' } }) })
    const renamed = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲改' } }) })
    const idOf = (data: typeof before) => (data.pageTree.data as { $id: string }).$id
    expect(idOf(before)).toMatch(/^site-tree-[0-9a-f]{16}$/)
    expect(idOf(same)).toBe(idOf(before))
    expect(idOf(added)).not.toBe(idOf(before))
    expect(idOf(renamed)).not.toBe(idOf(before))
  })

  it('站内地址到标题：页面加上页面树插件加的入口', async () => {
    const data = await siteLayoutData({ source: sourceWith({ '/content/a.page.tsx': { title: '甲' } }) })
    expect(data.pageTitles).toEqual({ '/a': '甲', '/comments': '评论' })
  })
})
