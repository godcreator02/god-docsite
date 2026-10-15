import { loader } from 'fumadocs-core/source'
import { isLinkItemActive } from '@fumadocs/base-ui/layouts/shared'
import { describe, expect, it } from 'vitest'
import { siteLayoutData } from '../src/site/layout.server.js'
import { htmlPageSource, tsxPageSource } from '../src/site/page-sources.js'
import { sidebarLayoutLinksOf } from '../src/site/sidebar-links.js'
import type { SiteSource } from '../src/site/site-context.js'

function sourceWith(pages: Record<string, { title: string }>): SiteSource {
  return loader({
    source: { tsx: tsxPageSource(pages), html: htmlPageSource({}) },
    baseUrl: '/',
  }) as unknown as SiteSource
}

const sidebarLinks = [{ name: '评论', url: '/comments' }]

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
})

describe('sidebarLayoutLinksOf', () => {
  it('侧栏入口只进侧栏，在入口地址下面的页面上也算当前（fumadocs 的 nested-url）', () => {
    const [calendar] = sidebarLayoutLinksOf([{ name: '日历', url: '/calendar' }])
    expect(calendar).toMatchObject({ text: '日历', url: '/calendar', on: 'menu' })
    expect(isLinkItemActive(calendar!, '/calendar')).toBe(true)
    expect(isLinkItemActive(calendar!, '/calendar/2026-10-12')).toBe(true)
    expect(isLinkItemActive(calendar!, '/calendar-notes')).toBe(false)
    expect(isLinkItemActive(calendar!, '/tasks')).toBe(false)
  })
})
